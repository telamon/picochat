const D = require('debug')('picochat:mod:gc')
const { EXPIRED } = require('../slices/peers.reg.js')
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
    async _collectGarbage (now) {
      D('Locking store')
      return store._lockRun(async () => collectGarbage.bind(this)(now))
    },

    startGC (interval = 3 * 1000) {
      if (!this.ready || timerId) return
      timerId = setInterval(this._collectGarbage.bind(this), interval)
    },

    stopGC () {
      if (!timerId) return
      clearInterval(timerId)
      timerId = null
    }
  }

  async function collectGarbage (now = Date.now()) {
    D('Starting collecting garbage...')
    const pending = await tickQuery(repo._db, now)
    D('Fetched pending from store:', pending.length)
    let mutated = new Set()
    const segments = []
    for (const p of pending) {
      const { type, id } = unpackValue(p.value)
      if (!type) throw new Error('GC OP missing')
      await sweep({ // TOO PHAT CONTEXT
        now,
        id,
        gcType: type,
        rootState: store.state,
        didMutate: n => mutated.add(n),
        drop: head => segments.push([head, type === 'chat' ? id : null])
      })
    }
    const evicted = []
    for (const [ptr, segmentId] of segments) {
      // const owner = await this.repo._traceOwnerOf(ptr) // repo.ownerOf(ptr)
      try {
        const s = await this._tracePath(ptr)
        if (segmentId) { // Delete a chat/vibe off a user-profile
          if (!segmentId.equals(s.chatId)) throw new Error('InternalError: Attempted to evict wrong segment')
          const d = await this.repo.rollback(s.keys[0], s.heads[0])
          evicted.push(d)
        } else { // Clear out stale profiles
          evicted.push(await this.repo.rollback(s.keys[0]))
        }
      } catch (err) {
        if (err.message === 'FeedNotFound') {
          D('RollbackFailed, Feed already gone', err)
        } else console.error('Rollback failed', err)
      }
    }
    // notify all affected stores
    mutated = Array.from(mutated)
    store._notifyObservers(mutated)
    D('Stores mutated', mutated, 'segments evicted', evicted.length)
    /// D(evicted.map(f => f.inspect(true)))
    return { mutated, evicted }
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
      const expiresAt = (chat?.expiresAt || match?.expiresAt || 0)
      const hasExpired = expiresAt < now
      D('Chat[%h] expired: %s, timeLeft: %d', id, hasExpired, expiresAt - now)
      if (!hasExpired) return // not yet

      // Clear chat registry
      if (chat) {
        const { chats, heads, own } = rootState.chats
        delete chats[id.toString('hex')]
        delete heads[head.toString('hex')]
        const idx = own.findIndex(b => b.equals(id))
        if (~idx) own.splice(idx, 1)
        didMutate('chats')
        del = true
      }

      // Clear vibes registry
      if (match) {
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
      if (del) drop(head, id) // id: chatId, head: lastBlock on chat
    } else if (gcType === 'peer') {
      const { peers } = rootState
      const isSelf = rootState.peer.pk?.equals(id)
      if (isSelf && rootState.peer.expiresAt < now) {
        rootState.peer.state = EXPIRED // Not sure if should delete.
        didMutate('peer')
      }
      const peer = peers[id.toString('hex')]
      if (peer && peer.expiresAt < now) {
        peer.state = EXPIRED
        didMutate('peers')
        if (!isSelf) {
          delete peers[id.toString('hex')]
          drop(peer.sig)
        }
      }
    } else throw new Error(`Garbage collection for "${gcType}" not supported!`)
  }
}

// TODO; Accuracy of browser might overwrite previous index,
// add couple bytes of signature to end and maybe slice name
// String conversion has to be faster than byte-alloc?
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
    iter.close(err => err ? reject(err) : resolve())
  })
  return result
}
