// const Scheduler = require('pico-scheduler')
const {
  TYPE_VIBE,
  VIBE_REJECTED,
  decodeBlock,
  unseal
} = require('../util')
const debug = require('debug')('pico::vibes')

const TTL = 5 * 1000 * 60 // Defaults to 5 minutes

class VibeCtrl {
  constructor (vibeTTL = TTL) {
    this._sk = null
    this._pk = null
    // this._sched = new Scheduler()
    this._reduceHasRun = false
    this.ttl = vibeTTL
    this.reducer = this.reducer.bind(this)
  }

  setKeys (peerId, { sk, pk }) {
    if (this._sk) throw new Error('VibeBox secret has already been set')
    if (this._reduceHasRun) throw new Error('Reducer has already run without box secret')
    this._sk = sk
    this._pk = pk
    this._peerId = peerId
  }

  /*
  // Collect garbage
  gc (date = new Date().getTime()) {
    this._sched.tick(date)
  }
  */

  get name () { return 'vibes' }

  get initialValue () {
    return {
      sent: [],
      received: [],
      seen: {} // hashmap by author key
    }
  }

  filter ({ block, state }) {
    const data = decodeBlock(block.body)
    if (data.type !== TYPE_VIBE) return true // Ignore non-profile blocks.
    const key = block.key.toString('hex')
    const vibe = decodeBlock(block.body, 1)
    // Reject block if vibe timestamp located in the future.
    if (vibe.date > new Date().getTime()) return 'Vibe from the future'
    const prev = state.seen[key]
    if (prev && prev.date + this.ttl > vibe.date) return 'Vibe flood'
    return false // All good, accept block
  }

  // Reducer updates state with values from block
  reducer ({ block, state }) {
    const key = block.key.toString('hex')
    const vibe = decodeBlock(block.body, 1)
    // Set lookup reference
    state.seen[key] = {
      date: vibe.date,
      sig: block.sig // name sig- to make it easy to delete the block
    }

    const rejected = VIBE_REJECTED.equals(vibe.box)

    // Attempt to determine if someone vibes us
    if (this._sk) {
      try {
        const box = rejected ? null : unseal(vibe.box, this._sk, this._pk)
        const isResponse = !!state.sent.find(v => v.chatId.equals(block.parentSig))
        // TODO: chatId is sometimes parentId
        debug('Someone\'s intrested in you')
        state.received.push({
          chatId: isResponse ? block.parentSig : block.sig, // convesation ID
          from: block.key,
          date: vibe.date,
          isResponse,
          rejected,
          box // conversation Public key
        })
      } catch (error) {
        if (error.message !== 'DecryptionFailedError') throw error
      }
    }

    if (this._peerId && this._peerId.equals(block.key)) {
      const isResponse = !!state.received.find(v => v.chatId.equals(block.parentSig))
      state.sent.push({ // interesting, no clue to tell who we sent it too ('seal' algorithm prevents even sender from decrypting)
        chatId: isResponse ? block.parentSig : block.sig, // convesation ID
        date: vibe.date,
        rejected,
        isResponse
      })
    }

    this._reduceHasRun = true

    // Collect garbage
    {
      const before = [state.received.length, state.sent.length, Object.keys(state.seen).length]
      debug(`Collecting garbage. r/s/t: ${before}`)
      // All timestamps older/less than timout are considered expired
      const timeout = new Date().getTime() - this.ttl
      // TODO: somehow remove obsolete blocks from repo
      state.received = state.received.filter(v => !(v.date < timeout))
      state.sent = state.sent.filter(v => !(v.date < timeout))
      for (const key in state.seen) {
        if (state.seen[key].date < timeout) delete state.seen[key]
      }
      debug(`Collected. r/s/t: ${[state.received.length, state.sent.length, Object.keys(state.seen).length]}`)
    }

    return state // return new state
  }
}

module.exports = VibeCtrl
