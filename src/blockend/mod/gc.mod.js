const { decodeBlock, TYPE_VIBE_RESP } = require('../util')
const D = require('debug')('picochat:mod:gc')
const REG_TIMER = 116 // 't'
module.exports = function GarbageCollectModule (store) {
  const repo = store.repo
  let timerId = null
  function schedule (type, id, date) {
    const key = mkKey(date)
    // console.info('Scheduing removal', type, new Date(date))
    repo._db.put(key, packValue(type, id))
      .catch(error => console.error('Failed queing GC: ', error))
  }

  // Guerilla-patch store reducers to include the gc function.
  for (const slice of store._stores) {
    slice._originalReducer = slice.reducer
    slice.reducer = ctx => slice._originalReducer({
      ...ctx,
      schedule
    })
  }

  return {
    async _collectGarbage (now = Date.now()) {
      D('Attempting to aquire lock, queue %d', store._queue.length)
      const unlock = await store._waitLock()

      D('Starting collecting garbage...')
      const slices = store._stores.reduce((m, s) => { m[s.name] = s; return m }, {})
      const pending = await tickQuery(repo._db, now)
      D('Fetched pending from store:', pending.length)
      let mutated = new Set()
      const batch = []
      const evictRange = []
      for (const p of pending) {
        const { type, id } = unpackValue(p.value)
        if (!type) throw new Error('GC OP missing')
        await sweep({ // TOO PHAT CONTEXT
          now,
          id,
          gcType: type,
          rootState: store.state,
          didMutate: n => mutated.add(n),
          drop (head, tail, peers) {
            evictRange.push([head, tail])
          }
        })
        batch.push({ type: 'del', key: p.key })
      }
      await repo._db.batch(batch) // Clear out keys
      const evicted = []
      // Evict blocks
      for (const [head, tail] of evictRange) {
        const keys = new Set()
        const idHead = {}
        const idTail = {}
        const feed = await repo.loadFeed(head, (block, abort) => {
          // Detect if built in signing-identity heads need to be adjusted in repo
          if (!idHead[block.key.toString('hex')]) idHead[block.key.toString('hex')] = block.sig
          keys.add(block.key)

          { // Faulty code
            const data = decodeBlock(block.body)
            const { type } = data
            if (type === TYPE_VIBE_RESP) idTail[block.key.toString('hex')] = data.link // follow weak-ref
            else idTail[block.key.toString('hex')] = block.parentSig // TODO: parent is not guaranteed to be own block..
            // TODO: one more issue, given alice chatting with bob and charlie simultaneously her head is going to be reset to her link: profile.
          }
          // end of range reached
          if (block.sig.equals(tail)) abort(true)
        })
        for (const key of keys) {
          const stored = await repo._getHeadPtr(key)
          // Rollback internal repo headPtr before deletion
          if (idHead[key.toString('hex')].equals(stored)) {
            const newHead = idTail[key.toString('hex')]
            // console.warn('Rolling back heads', stored.toString('hex'), ' => ', newHead.toString('hex'))
            await repo._setHeadPtr(key, newHead)
            // TODO: tailpointer needs to be cleared if newHead === GENESIS
          }
        }
        for (const block of feed.blocks()) {
          await repo.deleteBlock(block.sig)
        }
        evicted.push(feed)
      }

      // notify all affected stores
      mutated = Array.from(mutated)
      for (const name of mutated) {
        // TODO: expose external state mutation in PicoStore?
        // right now this mutated state does not get persisted until next version is dispatched.
        for (const sub of slices[name].observers) sub(slices[name].value)
      }
      D('Stores mutated', mutated, 'feeds evicted', evicted.length)
      /// D(evicted.map(f => f.inspect(true)))
      unlock()
      return { mutated, evicted }
    },

    startGC (inteval = 3 * 1000) {
      if (!this.ready || timerId) return
      timerId = setInterval(this._collectGarbage.bind(this), inteval)
    },

    stopGC () {
      if (!timerId) return
      clearInterval(timerId)
      timerId = null
    }
  }

  // TODO: if this hack works, move the time-based GarbageCollector functionality to PicoStore
  // and allow store.register() to include a sweep function, `expiresAt` prop becomes a first citizen.
  function sweep ({ now, rootState, drop, gcType, id, didMutate }) {
    if (gcType === 'chat') {
      const match = rootState.vibes.matches[id.toString('hex')]
      const chat = rootState.chats.chats[id.toString('hex')]
      const head = chat?.head || match?.response || match?.chatId
      let del = false
      if (!head) return // nothing to do

      // GC chats
      if (chat && chat.expiresAt < now) {
        const { chats, heads, own } = rootState.chats
        delete chats[id.toString('hex')]
        delete heads[head.toString('hex')]
        const idx = own.findIndex(b => b.equals(id))
        if (~idx) own.splice(idx, 1)
        didMutate('chats')
        del = true
      }

      // GC vibes
      const vibeExpiresAt = chat ? chat.expiresAt : match.expiresAt
      if (match && vibeExpiresAt < now) {
        // Restore state
        const { seen, matches, own } = rootState.vibes
        if (match.a && seen[match.a.toString('hex')]?.equals(id)) delete seen[match.a.toString('hex')]
        if (match.b && seen[match.b.toString('hex')]?.equals(id)) delete seen[match.b.toString('hex')] // redundant?
        delete matches[id.toString('hex')]
        const idx = own.findIndex(b => b.equals(id))
        if (~idx) own.splice(idx, 1)
        didMutate('vibes')
        del = true
      }
      if (del) drop(head, id)
    } else if (gcType === 'peer') {
      const { peers } = rootState
      const isSelf = rootState.peer.pk.equals(id)
      if (isSelf && rootState.peer.expiresAt < now) {
        // Notify that we need to re-issue a new profile or heartbeat block
        rootState.peer.state = 'expired'
        didMutate('peer')
      }
      const peer = peers[id.toString('hex')]
      if (peer && peer.expiresAt < now) {
        peer.state = 'expired'
        didMutate('peers')
        if (!isSelf) {
          delete peers[id.toString('hex')]
          drop(peer.sig, peer.sig)
        }
      }
    } else throw new Error(`Garbage collection for "${gcType}" not supported!`)
  }
}

// TODO; Accuracy of browser might overwrite previous index,
// add couple bytes of signature to end and maybe slice name
function mkKey (date) {
  const b = Buffer.alloc(9)
  b.writeBigUInt64BE(BigInt(date), 1)
  b[0] = REG_TIMER
  return b
}

function packValue (sliceName, id) {
  sliceName = Buffer.from(sliceName)
  const sz = id.length
  const b = Buffer.alloc(1 + sz + sliceName.length)
  id.copy(b, 1)
  sliceName.copy(b, sz + 1)
  b[0] = sz
  return b
}

function unpackValue (b) {
  const len = b[0]
  return {
    type: b.slice(len + 1).toString(),
    id: b.slice(1, len + 1)
  }
}

async function tickQuery (db, now) {
  const query = {
    gt: mkKey(0),
    lt: mkKey(now)
  }

  const iter = db.iterator(query)
  const result = []
  while (true) {
    try {
      const [key, value] = await new Promise((resolve, reject) => {
        iter.next((err, key, value) => {
          if (err) reject(err)
          else resolve([key, value])
        })
      })
      if (!key) break
      result.push({ key, value })
    } catch (err) {
      console.warn('Iterator died with an error', err)
      break
    }
  }
  await new Promise((resolve, reject) => {
    iter.end(err => err ? reject(err) : resolve())
  })
  return result
}
