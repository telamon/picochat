const Feed = require('picofeed')
const {
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  VIBE_REJECTED,
  toBuffer,
  seal,
  boxPair
} = require('../util')
const { mute } = require('../nuro')
const { PEER_PLACEHOLDER } = require('./peers.mod')
const D = require('debug')('picochat:mod:vibes')

module.exports = function VibesModule () {
  return {
    /**
     * Sends a vibe to a peer giving initiating a private
     * channel for communication.
     * params:
     * - peerId {SignaturePublicKey} a peer's signing key
     */
    async sendVibe (peerId) {
      peerId = toBuffer(peerId)
      if (this.pk.equals(peerId)) throw new Error('SelfVibeNotAllowed')
      const msgBox = boxPair()
      const peer = await this.profileOf(peerId)
      const sealedMessage = seal(msgBox.pk, peer.box)
      const convo = await this._createBlock(TYPE_VIBE, {
        box: sealedMessage
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
      const peer = await this.profileOf(vibe.a)

      if (!peer) throw new Error('PeerNotFound')
      const sealedMessage = seal(msgBox.pk, peer.box)

      const block = await this.repo.readBlock(chatId)
      const convo = await this._createBlock(Feed.from(block), TYPE_VIBE_RESP, {
        box: !like ? VIBE_REJECTED : sealedMessage,
        link: this.store.state.peer.sig // Weak-ref to own checkpoint
      })
      if (!convo) throw new Error('Failed creating block')
      if (like) await this._storeLocalChatKey(vibe.chatId, msgBox)
    },

    // Lower-level alternative without
    // Vibe.peer joined in
    _vibes () {
      return mute(s => this.store.on('vibes', s),
        ({ sent, received, own, matches }, set) => {
          const vibes = []
          for (const chatId of own) {
            const match = matches[chatId.toString('hex')]
            const initiator = this.pk.equals(match.a)
            const vibe = computeVibe(chatId, match, initiator)
            if (vibe.state === 'expired') continue // let GC handle the rest
            vibes.push(vibe)
          }
          D('emit _vibes')
          return vibes
        }
      )
    },

    $vibes () {
      const joinPeers = (vibes, set) => {
        const tasks = []
        // INNER JOIN profile of 'other' on vibe
        for (const vibe of vibes) {
          if (vibe.initiator === 'local') {
            // Attempt to remember who we sent what to.
            const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
            vibe.id.copy(key, 1)
            key[0] = 84 // ASCII: 'T'
            tasks.push(
              this._readReg(key)
                .then(pk => this.profileOf(pk))
                .then(peer => { vibe.peer = peer })
            )
          } else {
            tasks.push(
              this.profileOf(vibe.a)
                .then(p => { vibe.peer = p })
            )
          }
        }
        // When all tasks finish invoke subscriber
        Promise.all(tasks)
          .then(() => {
            D('emit $vibes async')
            set(vibes)
          })
          .catch(err => {
            console.error('Error occured resolving vibe.peer:', err)
            throw err
          })
        D('emit $vibes')
        return vibes
      }
      return mute(this._vibes(), joinPeers)
    }
  }
}

function computeVibe (chatId, match, initiator) {
  const out = {
    ...initVibe(chatId),
    updatedAt: match.updatedAt,
    createdAt: match.createdAt,
    expiresAt: match.expiresAt,
    box: match.remoteBox,
    initiator: initiator ? 'local' : 'remote',
    localRejected: initiator && match.state === 'rejected',
    remoteRejected: !initiator && match.state === 'rejected',
    a: match.a,
    b: match.b,
    head: match.response
  }

  if (match.state === 'rejected') out.state = 'rejected'
  else if (match.a && match.b) out.state = 'match'
  else if (!initiator && !match.b) out.state = 'waiting_local'
  else if (initiator && !match.b) out.state = 'waiting_remote'
  else out.state = 'mental_error'

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
      b: null
    }
  }
}
