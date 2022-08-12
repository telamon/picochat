const Feed = require('picofeed')
const {
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  VIBE_REJECTED,
  toBuffer,
  seal,
  boxPair
} = require('../util')
const { mute, combine, gate, init, until } = require('piconuro')
const { PEER_PLACEHOLDER } = require('./peers.mod')
const Transactions = require('../transactions')
const D = require('debug')('picochat:mod:vibes')

module.exports = function VibesModule () {
  return {
    /**
     * Sends a vibe to a peer giving initiating a private
     * channel for communication.
     * params:
     * - peerId {SignaturePublicKey} a peer's signing key
     */
    async sendVibe (peerId, transactions = []) {
      peerId = toBuffer(peerId)
      if (this.pk.equals(peerId)) throw new Error('SelfVibeNotAllowed')
      // Don't sendVibes to peers waiting for your response.
      const { matches, own } = this.store.state.vibes
      for (const ckey of own) {
        const match = matches[ckey.toString('hex')]
        // Send response to received vibes
        if (match.state === 'wait' && peerId.equals(match.a)) {
          return this.respondVibe(match.chatId)
        }
      }
      if (!Array.isArray(transactions)) transactions = [transactions]
      transactions = transactions.map(t => Transactions.validate(t))
      const cd = await until(this.$cooldowns(), cd => cd.state !== 'loading')
      if (!cd.canVibe) throw new Error('VibeNotReady')

      const msgBox = boxPair()
      const peer = await this.profileOf(peerId)
      if (peer.state === 'error') throw new Error(peer.errorMessage)
      const sealedMessage = seal(msgBox.pk, peer.box)
      const convo = await this.createBlock(TYPE_VIBE, {
        box: sealedMessage,
        t: transactions
      })
      const chatId = convo.last.sig
      await this._storeLocalChatKey(chatId, msgBox)
      // Store target ref
      const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
      chatId.copy(key, 1)
      key[0] = 84 // ASCII: 'T'
      await this._writeReg(key, peer.pk)
      return chatId
    },

    /**
     * Responds to a vibe by generating the second box pair
     * params:
     * - chatId {BlockSignature} id of the initial vibe-block.
     */
    async respondVibe (chatId, like = true) {
      chatId = toBuffer(chatId)
      const msgBox = boxPair()
      const { own, matches } = this.store.state.vibes
      if (!own.find(v => v.equals(chatId))) throw new Error('NotYourVibe')

      const vibe = matches[chatId.toString('hex')]
      if (!vibe) throw new Error('VibeNotFound')
      if (vibe.state !== 'wait') throw new Error('VibeResponseNotApplicable')
      const peer = await this.profileOf(vibe.a)

      if (!peer) throw new Error('PeerNotFound')
      const sealedMessage = seal(msgBox.pk, peer.box)

      const block = await this.repo.readBlock(chatId)
      if (!block) throw new Error('Vibe no longer exists')
      const convo = await this.createBlock(Feed.from(block), TYPE_VIBE_RESP, {
        box: !like ? VIBE_REJECTED : sealedMessage,
        link: this.store.state.peer.sig // Weak-ref to own checkpoint
      })
      if (!convo) throw new Error('Failed creating block')
      if (like) await this._storeLocalChatKey(vibe.chatId, msgBox)
      return chatId
    },

    $vibe (chatId) {
      return gate(init({ state: 'loading', type: 'vibe' }, this._vibe(chatId)))
    },
    _vibe (chatId) { // ungated/inited raw
      try {
        chatId = toChatId(chatId)
      } catch (err) {
        return init({
          state: 'error',
          errorMessage: err.message
        })
      }
      return mute(
        combine(
          s => this.store.on('chats', s),
          s => this.store.on('vibes', s)
        ),
        ([chats, { matches }]) => {
          const match = matches[chatId.toString('hex')]
          const chat = chats.chats[chatId.toString('hex')]
          if (!match) return { state: 'error', errorMessage: 'VibeNotFound' }
          const initiator = this.pk.equals(match.a)
          const vibe = computeVibe(chatId, match, initiator, chat)
          return joinPeer.bind(this)(vibe)
        }
      )
    },

    $vibes () {
      const joinPeers = async vibes => {
        // INNER JOIN profile of 'other' on vibe
        const out = []
        for (let i = 0; i < vibes.length; i++) {
          const vibe = { ...vibes[i] }
          await joinPeer.bind(this)(vibe)
          out.push(vibe)
        }
        D('emit $vibes async')
        return out
      }
      return gate(init([], mute(this._vibes(), joinPeers)))
    },
    // Lower-level alternative without
    // Vibe.peer joined in which requires readReg lookup
    _vibes () {
      return mute(
        combine(
          s => this.store.on('chats', s),
          s => this.store.on('vibes', s)
        ),
        ([chats, { sent, received, own, matches }], set) => {
          const vibes = []
          for (const chatId of own) {
            const match = matches[chatId.toString('hex')]
            const chat = chats.chats[chatId.toString('hex')]
            const initiator = this.pk.equals(match.a)
            const vibe = computeVibe(chatId, match, initiator, chat)
            if (vibe.state === 'expired') continue // let GC handle the rest
            if (chat && chat.state === 'end') continue
            vibes.push(vibe)
          }
          D('emit _vibes')
          return vibes
        }
      )
    }
  }
}

async function joinPeer (vibe) {
  try {
    if (!vibe.peerId && vibe.initiator) {
      // Attempt to remember who we sent what to.
      const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
      vibe.id.copy(key, 1)
      key[0] = 84 // ASCII: 'T'
      const pk = await this._readReg(key)
      vibe.peerId = pk
    }

    if (vibe.peer.state === 'loading') {
      vibe.peer = await this.profileOf(vibe.peerId)
    }
  } catch (err) {
    console.warn('Failed resolving vibe.peer', err)
    vibe.peer = { state: 'error', errorMessage: err.message }
  }
  return vibe
}

function computeVibe (chatId, match, initiator, chat) {
  const out = {
    ...initVibe(chatId),
    updatedAt: match.updatedAt,
    createdAt: match.createdAt,
    expiresAt: chat?.expiresAt || match.expiresAt,
    box: match.remoteBox,
    initiator, // : initiator ? 'local' : 'remote',
    localRejected: initiator && match.state === 'rejected',
    remoteRejected: !initiator && match.state === 'rejected',
    a: match.a,
    b: match.b,
    head: match.response
  }
  if (!initiator) out.peerId = out.a
  else if (match.b) out.peerId = out.b
  // else gotta lookup using _readReg(chatId), handled higher up

  if (match.state === 'rejected') out.state = 'rejected'
  else if (match.a && match.b) out.state = 'match'
  else if (!initiator && !match.b) out.state = 'waiting_local'
  else if (initiator && !match.b) out.state = 'waiting_remote'
  else out.state = 'mental_error'

  out.myTurn = out.state === 'match'
    ? !chat
        ? initiator
        : !((chat.mLength % 2) ^ (initiator ? 0 : 1))
    : out.state === 'waiting_local'
  if (chat?.state === 'end') out.myTurn = false

  out.health = !chat
    ? 3
    : Math.floor(chat.hp)

  if (
    ~['waiting_remote', 'waiting_local'].indexOf(out.state) &&
    out.expiresAt < Date.now()
  ) out.state = 'expired'
  return out

  function initVibe (id) {
    return {
      id,
      head: null,
      peer: PEER_PLACEHOLDER,
      peerId: null,
      box: null,
      state: 'waiting',
      updatedAt: 0,
      createdAt: Infinity,
      expiresAt: 0,
      remoteRejected: false,
      localRejected: false,
      a: null,
      b: null,
      myTurn: false,
      health: -1
    }
  }
}

function toChatId (key) {
  if (!key ||
    !(
      (Buffer.isBuffer(key) && key.length === 64) ||
      (typeof key !== 'string' && key.length === 128)
    )
  ) {
    throw new Error(`ChatID expected got "${key}"`)
  }
  return toBuffer(key)
}
