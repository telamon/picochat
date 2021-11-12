const Feed = require('picofeed')
const {
  boxPair,
  TYPE_PROFILE,
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK
} = require('../util')
const { memo, mute, combine } = require('../nuro')

module.exports = function PeersModule () {
  return {
    /**
     * Generates a new user identity and creates the first profile block
     */
    async register (profile) {
      // Signing identity
      const { sk } = Feed.signPair()
      this._sk = sk

      // A box for love-letters
      const box = boxPair()
      this._vibeBox = box
      this._vibeController.setKeys(this.pk, this._vibeBox)

      await this.updateProfile(profile)
      await this.repo.writeReg(KEY_SK, sk)
      await this.repo.writeReg(KEY_BOX_LIKES_PK, box.pk)
      await this.repo.writeReg(KEY_BOX_LIKES_SK, box.sk)
    },

    /**
     * Creates a new profile-block
     */
    async updateProfile (profile) {
      return await this._createBlock(TYPE_PROFILE, {
        ...profile,
        box: this._vibeBox.pk
      })
    },

    /**
     * Returns user's personal feed
     * - *optional* limit {number} limit amount of blocks fetched.
     */
    async feed (limit = undefined) {
      this._checkReady()
      return this.repo.loadHead(this.pk, limit)
    },

    getProfile (sub) {
      return reducePeer(this.store, this.pk, true)(sub)
    }
  }
}

function reducePeer (store, id, isSelf) { // Yeah we're dropping this terminology now.
  const $peer = isSelf
    ? s => store.on('peer', s) // Fetch own profile from 'peer' slice
    : mute(
      s => store.on('peers', s), // Fetch others from 'peers' slice
      peers => peers[id.toString('hex')] || { state: 'error', errorMessage: 'PeerNotFound' }
    )
  const $chats = memo(s => store.on('chats', s))

  const $profile = mute(
    combine($peer, $chats),
    ([peer, chats]) => {
      const stats = chats.stats[id.toString('hex')]
      const extraTime = !stats ? 0 : stats.nEnded * (7 * 60 * 1000)
      return {
        ...peer,
        expiresAt: peer.expiresAt + extraTime
      }
    }
  )

  // const p = get($profile)
  // debugger
  return $profile
}
