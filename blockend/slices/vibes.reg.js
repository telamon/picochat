const {
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_PROFILE,
  TYPE_BYE_RESP,
  TYPE_ITEMS,
  TYPE_ACTIVATE,
  EV_CHAT_END,
  VIBE_REJECTED,
  decodeBlock,
  unseal
} = require('../util')
const D = require('debug')('picochat:slices:vibes')

const {
  vibe_timeout: TTL,
  vibe_response_timeout: RESP_TTL
} = require('../../config')

class VibeCtrl { // TODO: use same pattern as aother reducers instead of class
  constructor (vibeTTL = TTL) {
    this._sk = null
    this._pk = null
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

  get name () { return 'vibes' }

  get initialValue () {
    return {
      // Register to maintain flood rules/timers
      seen: {},

      // Register chatId
      // ( ChatID is block.signature of first vibe )
      // TODO: introducing this register creates incentive to mess with it.
      // patch 3rd-party vibe-response by introducing a public hash(nonce) in init and reveal the nonce in reply
      // this will most likely superseed the sent/received[] registers
      matches: {},
      own: []
    }
  }

  filter ({ block, parentBlock, state }) {
    const data = decodeBlock(block.body)
    const { type } = data

    // Silently ignore unrelated blocks
    if (type !== TYPE_VIBE && type !== TYPE_VIBE_RESP) return true

    const parentType = parentBlock && decodeBlock(parentBlock.body).type

    // Assert vibes
    if (type === TYPE_VIBE) {
      // Ensure parent is either profile or own chat-head or tail?
      if (
        parentType !== TYPE_PROFILE &&
        parentType !== TYPE_BYE_RESP &&
        parentType !== TYPE_ITEMS &&
        parentType !== TYPE_ACTIVATE // Continue where we left off
      ) return `InvalidParent: ${parentType}`

      const key = block.key.toString('hex')
      // Reject block if vibe timestamp located in the future.
      if (data.date > new Date().getTime()) return 'Vibe from the future'
      const chatId = state.seen[key]
      if (chatId) {
        const m = state.matches[chatId.toString('hex')]
        if (m.expiresAt >= Date.now()) return 'Only 1 active vibe allowed'
      }
    }

    // Assert VibeResponses
    if (type === TYPE_VIBE_RESP) {
      // TODO: assert parent.nonce equals SHA(vibeRes.reveal)

      // VibeResponses only allowed onto a Vibe
      if (parentType !== TYPE_VIBE) return `InvalidParent: ${parentType}`
      // TODO: return 'Expired' if match.expiresAt < now()
    }
    D('Accepting Vibe %h', block.sig)
    return false // All good, accept block
  }

  // Reducer updates state with values from block
  reducer ({ block, state, parentBlock, root, schedule }) {
    const vibe = decodeBlock(block.body, 1)
    const { type } = vibe
    const chatId = type === TYPE_VIBE ? block.sig : block.parentSig
    const key = chatId.toString('hex')
    const rejected = VIBE_REJECTED.equals(vibe.box)

    if (type === TYPE_VIBE) {
      D('%s reducing vibe: %o %h', root.peer.name, !!state.matches[key], block.sig)
      if (state.matches[key]) throw new Error('InternalError: Vibe already registered')
      // Set lookup reference
      state.seen[block.key.toString('hex')] = chatId
      const match = state.matches[key] = mkMatch()
      match.chatId = chatId
      match.a = block.key
      match.updatedAt = vibe.date
      match.createdAt = vibe.date
      match.expiresAt = vibe.date + TTL
      match.state = 'wait'
    } else { // type === TYPE_VIBE_RESP
      const match = state.matches[key]
      if (!match) throw new Error('InternalError: MatchNotFound')
      match.response = block.sig
      match.b = block.key
      match.updatedAt = vibe.date
      match.expiresAt = match.createdAt + RESP_TTL
      match.state = rejected ? 'rejected' : 'match'
    }

    const peerId = root.peer.pk
    const match = state.matches[key]

    // Push sent vibes to "own" registry
    if (type === TYPE_VIBE && peerId.equals(block.key)) state.own.push(chatId)

    let decrypted = null
    if (!rejected && !peerId.equals(block.key) && this._sk) { // Attempt decryption
      try {
        decrypted = unseal(vibe.box, this._sk, this._pk)
      } catch (error) {
        if (error.message !== 'DecryptionFailedError') throw error
      }
    }

    if (decrypted) {
      // Push decryptable received vibes/responses to "own" registry
      if (!state.own.find(c => c.equals(chatId))) state.own.push(chatId)
      match.remoteBox = decrypted
    }

    this._reduceHasRun = true
    schedule('chat', match.chatId, match.expiresAt)
    return state // return new state
  }

  trap ({ code, payload, root, state }) {
    switch (code) {
      case EV_CHAT_END: {
        const strkey = payload.toString('hex')
        const chat = root.chats.chats[strkey]
        delete state.seen[chat.a.toString('hex')] // Release vibe-block
        // delete state.matches[strkey] // remove match to please single-vibe filter.
        // Question; should state.own be cleared here??
        // i know too little about what to do with completed chats.
        // they should most likely be archived.
        D('%s Peer Unseen %h => %h', root.peer.name, chat.a.toString('hex'), payload)
      } break
      default:
        return // return undefined, (interrupt ignored/state-unchanged)
    }
    return state
  }
}

const mkMatch = () => ({
  chatId: null, // tail blocksig
  response: null, // head blocksig
  updatedAt: 0, // Counter for garbage collection
  // Participants/Peers
  a: null,
  b: null,
  remoteBox: null
})

module.exports = VibeCtrl
