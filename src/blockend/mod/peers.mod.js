const D = require('debug')('picochat:mod:peers')
const Feed = require('picofeed')
const {
  toBuffer,
  boxPair,
  TYPE_PROFILE,
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK
} = require('../util')
const { mute, combine } = require('../nuro')

const ERR_PEER_NOT_FOUND = Object.freeze({ state: 'error', errorMessage: 'PeerNotFound' })
const PEER_PLACEHOLDER = Object.freeze({ state: 'loading' })

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

    async profileOf (key) {
      /*
    const tail = await this.repo.tailOf(key)
    const block = await this.repo.readBlock(tail)
    if (!block) throw new Error('Profile not found, error due to profileOf is WIP; Need multihead resolve + network query')
    if (!key.equals(block.key)) throw new Error('Wrong profile encountered')
    const profile = decodeBlock(block.body)
    if (profile.type !== TYPE_PROFILE) throw new Error('Tail is not a profile: ' + profile.type)
    */
      key = toPublicKey(key)
      const profile = this.store.state.peers[key.toString('hex')]
      if (!profile) {
        D('Peer does not exist in registry %h', key)
        // throw new Error('ProfileNotFound')
        return ERR_PEER_NOT_FOUND
      }
      return profile
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
     * Peer by id
     */
    $peer (id) {
      id = toPublicKey(id)
      return reducePeer(this.store, id, this.pk && this.pk.equals(id))
    },

    /**
     * List of known and active peers
     */
    $peers () {
      // TODO: make LRU-backed $profiles singleton-neuron
      const ownid = this.pk
      const $peers = mute(
        this.store.on.bind(this.store, 'peers'),
        peerMap => Object.values(peerMap).filter(p => !ownid.equals(p.pk))
      )
      const $chats = this.store.on.bind(this.store, 'chats')

      // Higher level profiles neuron
      const $profiles = mute(
        combine($peers, $chats),
        ([peers, chats]) => peers
          .map(peer => computeProfile([peer, chats]))
          .filter(p => p.state !== 'expired')
      )
      return $profiles
    },

    /**
     * Local peer/-profile
     */
    $profile () {
      if (this.ready) return reducePeer(this.store, this.pk, true)
      else {
        // Hotswap subscripition when kernel.register() finished
        return sub => {
          let temp = this.store.on('peer', peer => {
            if (peer.pk) {
              temp()
              temp = reducePeer(this.store, this.pk, true)(sub)
            } else sub(PEER_PLACEHOLDER)
          })
          return () => temp()
        }
      }
    }
  }
}

function reducePeer (store, id, isSelf) { // Yeah we're dropping this terminology now.
  const $peer = isSelf
    ? s => store.on('peer', s) // Fetch own profile from 'peer' slice
    : mute(
      s => store.on('peers', s), // Fetch others from 'peers' slice
      peers => peers[id.toString('hex')] || null
    )
  const $chats = s => store.on('chats', s)
  return mute(
    combine($peer, $chats),
    computeProfile
  )
}

function computeProfile ([peer, chats]) {
  if (!peer) return ERR_PEER_NOT_FOUND
  if (!peer.pk) throw new Error('kernel.$peers invoked before kernel.load() finished?')
  const stats = chats.stats[peer.pk.toString('hex')]
  const extraTime = !stats ? 0 : stats.nEnded * (7 * 60 * 1000)
  const expiresAt = peer.expiresAt + extraTime
  return {
    ...peer,
    stats,
    expiresAt,
    state: expiresAt < Date.now() ? 'expired' : peer.state
  }
}

function toPublicKey (key) {
  if (!key ||
    !(
      (Buffer.isBuffer(key) && key.length === 32) ||
      (typeof key !== 'string' && key.length === 64)
    )
  ) throw new Error(`PublicKey expected got "${key}"`)
  return toBuffer(key)
}

module.exports.PEER_PLACEHOLDER = PEER_PLACEHOLDER
module.exports.ERR_PEER_NOT_FOUND = ERR_PEER_NOT_FOUND
