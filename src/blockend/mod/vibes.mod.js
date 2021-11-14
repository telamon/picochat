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

      if (!this.store.state.vibes.own.find(v => v.equals(chatId))) throw new Error('NotYourVibe')

      const vibe = this.store.state.vibes.matches[chatId.toString('hex')]
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

    vibes (sub) {
      /* return this.$vibes(sub)
    },

    $vibes () {
      return mute(s => this.store.on('vibes', s),
        ({ sent, received, own, matches }) => {
        }
      ) */

      return this.store.on('vibes', ({ sent, received, own, matches }) => {
        const tasks = []
        const vibes = []
        for (const chatId of own) {
          const match = matches[chatId.toString('hex')]
          const initiator = this.pk.equals(match.a)
          const out = {
            ...initVibe(chatId),
            updatedAt: match.updatedAt,
            createdAt: match.createdAt,
            expiresAt: match.expiresAt,
            box: match.remoteBox,
            initiator: initiator ? 'local' : 'remote',
            localRejected: initiator && match.state === 'rejected',
            remoteRejected: !initiator && match.state === 'rejected',
            head: match.response
          }

          if (match.state === 'rejected') out.state = 'rejected'
          else if (match.a && match.b) out.state = 'match'
          else if (!initiator && !match.b) out.state = 'waiting_local'
          else if (initiator && !match.b) out.state = 'waiting_remote'
          else out.state = 'mental_error'
          // The 3 lines above can be replaced with: state = !initiator ? 'waiting_local' : 'waiting_remote'
          // given that there are no mental errors...

          // INNER JOIN profile on vibe
          // Attempt to remember who we sent what to.
          if (initiator) {
            const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
            chatId.copy(key, 1)
            key[0] = 84 // ASCII: 'T'
            tasks.push(
              this._readReg(key)
                .then(pk => this.profileOf(pk))
                .then(peer => { out.peer = peer })
            )
          } else {
            tasks.push(
              this.profileOf(match.a)
                .then(p => { out.peer = p })
            )
          }
          vibes.push(out)
        }

        // When all tasks finish invoke subscriber
        Promise.all(tasks)
          .then(() => sub(vibes))
          .catch(err => {
            console.error('Error occured during vibes derivation:', err)
            throw err
          })
      })

      function initVibe (id, peer, date) {
        return {
          id,
          peer,
          box: null,
          state: 'waiting',
          updatedAt: 0,
          createdAt: Infinity,
          remoteRejected: false,
          localRejected: false,
          head: null
        }
      }
    }
  }
}
