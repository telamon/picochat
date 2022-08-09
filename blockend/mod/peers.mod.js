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
const { mute, combine, init, gate, when } = require('piconuro')
const { EXPIRED, stateOfPeer } = require('../slices/peers.reg.js')
const ERR_PEER_NOT_FOUND = Object.freeze({ state: 'error', errorMessage: 'PeerNotFound' })
const PEER_PLACEHOLDER = Object.freeze({ state: 'loading' })

module.exports = function PeersModule () {
  let setHasProfile = null
  const hasProfile = new Promise(resolve => { setHasProfile = resolve })
  return {
    __setHasProfile: setHasProfile, // Used by kernel.load()
    hasProfile,
    /**
     * Publishes a profile block.
     */
    async register (profile, sk) {
      sk = sk || Feed.signPair().sk
      // Signing identity
      this._secret = sk

      // A box for love-letters
      const box = boxPair()
      this._vibeBox = box
      this._vibeController.setKeys(this.pk, this._vibeBox)

      await this.updateProfile(profile)
      await this.repo.writeReg(KEY_SK, sk)
      await this.repo.writeReg(KEY_BOX_LIKES_PK, box.pk)
      await this.repo.writeReg(KEY_BOX_LIKES_SK, box.sk)
      setHasProfile(true)
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
      return await this.createBlock(TYPE_PROFILE, {
        ...profile,
        box: this._vibeBox.pk
      })
    },

    /**
     * Peer by id
     * same as _peer but introduces gate and default placeholder
     */
    $peer (id) {
      return gate(init(PEER_PLACEHOLDER, this._peer(id)))
    },

    _peer (id) { // raw neuron
      try {
        id = toPublicKey(id)
      } catch (err) {
        return init({
          ...ERR_PEER_NOT_FOUND,
          errorMessage: err.message
        })
      }

      if (this.pk.equals(id)) return this.$profile()

      const $peer = mute(
        s => this.store.on('peers', s),
        peers => peers[id.toString('hex')] || ERR_PEER_NOT_FOUND
      )
      const $chats = s => this.store.on('chats', s)
      const $vibes = s => this.store.on('vibes', s)
      const $inv = s => this.store.on('inv', s)
      return mute(
        combine($peer, $vibes, $chats, $inv),
        computeProfile
      )
    },

    /**
     * List of known and active peers
     */
    $peers () {
      // TODO: make LRU-backed $profiles singleton-neuron
      const $peers = mute( // filter own profile.
        this.store.on.bind(this.store, 'peers'),
        peerMap => this.pk
          ? Object.values(peerMap).filter(p => !this.pk.equals(p.pk))
          : Object.values(peerMap)
      )
      const $chats = this.store.on.bind(this.store, 'chats')
      const $vibes = s => this.store.on('vibes', s)
      const $inv = s => this.store.on('inv', s)
      // Higher level profiles neuron
      const $profiles = gate(init([],
        mute(
          combine($peers, $vibes, $chats, $inv),
          stores => stores[0] // store[0]: peers
            .map(peer => computeProfile(stores))
            .filter(p => p.state !== EXPIRED)
        )
      ))
      return $profiles
    },

    /**
     * Local peer/-profile
     */
    $profile () {
      const $chats = s => this.store.on('chats', s)
      const $vibes = s => this.store.on('vibes', s)
      const $inv = s => this.store.on('inv', s)
      const $loaded = when(this.boot())
      return gate(init(PEER_PLACEHOLDER,
        mute(
          combine(
            mute(
              s => this.store.on('peer', s),
              async peer => {
                await hasProfile
                return peer
              }
            ),
            $vibes,
            $chats,
            $inv,
            $loaded
          ),
          computeProfile
        )
      ))
    }
  }
}

function computeProfile ([peer, vibes, chats, inv]) {
  if (!peer) return ERR_PEER_NOT_FOUND // TODO: most likely redundant
  if (peer.date === null) return PEER_PLACEHOLDER // when neuron invoked pre-kernel load.
  if (peer.state === 'error') return peer
  if (!peer.pk) throw new Error('kernel.$peers invoked before kernel.load() finished?')
  const pid = peer.pk.toString('hex')
  const stats = chats.stats[pid] || {
    nEnded: 0,
    nStarted: 0,
    nMessages: 0,
    nPassed: 0,
    nExhausted: 0
  }
  const extraTime = !stats ? 0 : stats.nEnded * (7 * 60 * 1000)
  // TODO: bug, next line should be valid but score is 0
  // const extraTime = peer.score * 60 * 1000
  // console.info('PEER SCORE', peer.score, stats.nEnded)
  const expiresAt = peer.expiresAt + extraTime
  const inventory = Object.values(inv[pid]) || []
  return {
    ...peer,
    stats,
    expiresAt,
    state: expiresAt < Date.now() ? EXPIRED : stateOfPeer(peer, vibes, chats),
    inventory
  }
}

function toPublicKey (key) {
  if (!key ||
    !(
      (Buffer.isBuffer(key) && key.length === 32) ||
      (typeof key !== 'string' && key.length === 64)
    )
  ) {
    throw new Error(`PublicKey expected got "${key}"`)
  }
  return toBuffer(key)
}

module.exports.PEER_PLACEHOLDER = PEER_PLACEHOLDER
module.exports.ERR_PEER_NOT_FOUND = ERR_PEER_NOT_FOUND
