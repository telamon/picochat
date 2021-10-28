// SPDX-License-Identifier: AGPL-3.0-or-later
const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
const { RPC } = require('./rpc')
const PeerStore = require('./slices/peers')
const VibeStore = require('./slices/vibes')
const {
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK,
  TYPE_PROFILE,
  TYPE_VIBE,
  VIBE_REJECTED,
  decodeBlock,
  encodeBlock,
  boxPair,
  seal
} = require('./util')
const debug = require('debug')
debug.enable('pico*')

class Kernel {
  constructor (db) {
    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo, mergeStrategy)
    // Setup sub-store
    this.store.register(PeerStore()) // Register PeerStore that holds user profiles
    this._vibeController = new VibeStore()
    this.store.register(this._vibeController)
  }

  /**
   * Restores session/data from store
   * returns {boolean} true if user exists
   */
  load () {
    // Experimental anti-pattern
    const deferredLoad = async () => {
      try {
        this._sk = await this.repo.readReg(KEY_SK)
      } catch (err) {
        if (!err.notFound) throw err
        else return false // short-circuit empty store / no identity
      }
      if (this._sk) {
        this._vibeBox = {
          sk: await this.repo.readReg(KEY_BOX_LIKES_SK),
          pk: await this.repo.readReg(KEY_BOX_LIKES_PK)
        }
        this._vibeController.setKeys(this.pk, this._vibeBox)
      }
      await this.store.load() // returns notification
      return !!this._sk
    }
    if (!this.__loading) this.__loading = deferredLoad()
    return this.__loading
  }

  /**
   * Returns user's public key (same thing as userId)
   */
  get pk () {
    return this._sk?.slice(32)
  }

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
  }

  /**
   * Creates a new profile-block
   */
  async updateProfile (profile) {
    return await this._createBlock(TYPE_PROFILE, {
      ...profile,
      box: this._vibeBox.pk
    })
  }

  /**
   * Get user's profile from store
   */
  get profile () {
    return this.store.state.peers[this.pk.toString('hex')]
  }

  /**
   * Returns user's personal feed
   * - *optional* limit {number} limit amount of blocks fetched.
   */
  async feed (limit = undefined) {
    this._checkReady()
    return this.repo.loadHead(this.pk, limit)
  }

  /**
   * Returns boolean if kernel has a user
   * e.g. isLoggedIn
   */
  get ready () {
    return !!this._sk
  }

  /**
   * Helper that throws error if kernel is not ready
   */
  _checkReady () {
    if (!this.ready) throw new Error('Kernel is not ready, still loading or user is not registerd')
  }

  /**
   * Returns the last block number of user
   * Block sequence starts from 0 and increments by 1 for each new user-block
   */
  async seq () {
    const feed = await this.feed(1)
    if (!feed) return -1
    return decodeBlock(feed.last.body).seq
  }

  /**
   * Sends a vibe to a peer giving initiating a private
   * channel for communication.
   * params:
   * - vibePk {BoxPublicKey} the key advertised in someone's profile.
   */
  async sendVibe (vibePk) {
    const msgBox = boxPair()
    const sealedMessage = seal(msgBox.pk, vibePk)
    const convo = await this._createBlock(TYPE_VIBE, {
      box: sealedMessage
    })
    const chatId = convo.last.sig
    await this._storeLocalChatKey(chatId, msgBox)
    return chatId
  }

  /**
   * Responds to a vibe by generating the second box pair
   * params:
   * - chatId {BlockSignature} id of the initial vibe-block.
   */
  async respondVibe (chatId, like = true) {
    const msgBox = boxPair()
    const vibe = this.store.state.vibes.received.find(v => v.chatId.equals(chatId))
    if (!vibe) throw new Error('Vibe not Found')
    const sealedMessage = seal(msgBox.pk, vibe.box)
    const block = await this.repo.readBlock(chatId)
    const convo = await this._createBlock(Feed.from(block), TYPE_VIBE, {
      box: !like ? VIBE_REJECTED : sealedMessage
    })
    if (!convo) throw new Error('Failed creating block')
    if (like) await this._storeLocalChatKey(vibe.chatId, msgBox)
  }

  /**
   * Creates a new block on parent feed and dispatches it to store
   *
   * - branch {Feed} the parent feed, OPTIONAL! defaults to user's private feed.
   * - type {string} (block-type: 'profile' | 'box' | 'message')
   * - payload {object} The data contents
   * returns list of modified stores
   */
  async _createBlock (branch, type, payload) {
    if (typeof branch === 'string') return this._createBlock(null, branch, type)
    this._checkReady() // Abort if not ready

    // Use provided branch or fetch user's feed
    // if that also fails then initialize a new empty Feed.
    branch = branch || (await this.feed()) || new Feed()

    const seq = (await this.seq()) + 1 // Increment block sequence
    const data = encodeBlock(type, seq, payload) // Pack data into string/buffer
    branch.append(data, this._sk) // Append data on selected branch

    const mut = await this.dispatch(branch.slice(-1), true) // Dispatch last block to store
    if (!mut.length) throw new Error('CreateBlock failed: rejected by store')
    if (this._badCreateBlockHook) this._badCreateBlockHook(branch.slice(-1))
    return branch
  }

  // the other kind of store
  vibes (sub) {
    const chats = {}
    function initChat (id, peer, date) {
      return {
        id,
        peer,
        received: 0,
        sent: 0,
        box: null,
        fetchPair: null,
        state: 'waiting',
        updatedAt: 0,
        createdAt: 0
      }
    }

    return this.store.on('vibes', ({ sent, received }) => {
      for (const vibe of received) {
        const id = vibe.chatId.toString('hex')
        chats[id] = chats[id] || initChat(vibe.chatId, vibe.date, vibe.from)
        chats[id].received = 1
        chats[id].respondedAt = vibe.date
        chats[id].box = vibe.box
        chats[id].peer = vibe.from
        chats[id].updatedAt = Math.max(chats[id].updatedAt, vibe.date)
        chats[id].createdAt = Math.min(chats[id].createdAt, vibe.date)
      }
      for (const vibe of sent) {
        const id = vibe.chatId.toString('hex')
        chats[id] = chats[id] || initChat(vibe.chatId)
        chats[id].sent = 1
        chats[id].fetchPair = () => this._getLocalChatKey(vibe.chatId)
        chats[id].updatedAt = Math.max(chats[id].updatedAt, vibe.date)
        chats[id].createdAt = Math.min(chats[id].createdAt, vibe.date)
      }
      sub(Object.values(chats))
    })
  }

  /**
   * Mutates store and reduced state
   * returns {string[]} names of stores that were modified by this action
   */
  async dispatch (patch, loudFail = false) {
    this._checkReady()
    return await this.store.dispatch(patch, loudFail)
  }

  // ---- Network stuff

  async enter (name) {
    // TODO: Make disposable scoped store
    // this.pub.store = new Store(makeDatabase(name))
    // await this.pub.store.load()
    const repo = this.repo
    const store = this.store

    const rpc = new RPC({
      onblocks: async feed => {
        const mut = await store.dispatch(feed)
        return mut.length
      },
      // Lookups and read hit the permanent store first and then secondaries
      queryHead: async key => (await this.repo.headOf(key)) || (await repo.headOf(key)),
      queryTail: async key => (await this.repo.tailOf(key)) || (await repo.tailOf(key)),
      onquery: async params => {
        const keys = Object.values(store.state.peers)
          // experimental
          // .filter(peer => peer.date > new Date().getTime() - 1000 * 60 * 60) // Only peers active last hour
          .sort((a, b) => a.date - b.date) // Newest first or something
          .map(peer => peer.pk)
        const feeds = []
        for (const key of keys) {
          const f = await repo.loadHead(key)
          if (f) feeds.push(f)
        }
        return feeds
      }
    })
    this._badCreateBlockHook = block => rpc.sendBlock(block)

    return (details = {}) => {
      // if (blocklist.contains(details.prop)) return
      console.log('connected')
      return rpc.createWire(send => { // on remote open
        // if (details.client)
        rpc.query(send, {})
      })
    }
  }

  // -- Conversation key management
  async _storeLocalChatKey (chatId, msgBox) {
    const CONVERSATION_PREFIX = 67 // Ascii 'C'
    // const CONVERSATION_PREFIX = 99 // Ascii 'c'
    const vLength = msgBox.sk.length + msgBox.pk.length
    if (vLength !== 64) throw new Error(`Expected box keypair to be 32bytes each, did algorithm change?: ${vLength}`)
    if (typeof chatId === 'string') chatId = Buffer.from(chatId, 'hex') // Attempt normalize to buffer
    if (!Buffer.isBuffer(chatId)) throw new Error('Expected chatId to be a Buffer')
    if (chatId.length !== Feed.SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')

    const value = Buffer.allocUnsafe(msgBox.sk.length + msgBox.pk.length)
    msgBox.sk.copy(value)
    msgBox.pk.copy(value, msgBox.sk.length)
    const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
    chatId.copy(key, 1)
    key[0] = CONVERSATION_PREFIX
    return await this.repo.writeReg(key, value)
  }

  async _getLocalChatKey (chatId) {
    const CONVERSATION_PREFIX = 67 // Ascii 'C'
    if (typeof chatId === 'string') chatId = Buffer.from(chatId, 'hex') // Attempt normalize to buffer
    if (!Buffer.isBuffer(chatId)) throw new Error('Expected chatId to be a Buffer')
    if (chatId.length !== Feed.SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')

    const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
    chatId.copy(key, 1)
    key[0] = CONVERSATION_PREFIX
    const value = await this.repo.readReg(key)
    const box = {
      pk: value.slice(32),
      sk: value.slice(0, 32)
    }
    return box
  }
}

async function mergeStrategy (block, repo) {
  const content = decodeBlock(block.body)
  if (content.type !== TYPE_VIBE) return false
  const pBlock = await repo.readBlock(block.parentSig)
  const pContent = decodeBlock(pBlock.body)
  if (pContent.type !== TYPE_VIBE) return false
  if (!VIBE_REJECTED.equals(content.box)) {
    console.info(`Match detected: ${block.key.slice(0, 4).toString('hex')} <3 ${pBlock.key.slice(0, 4).toString('hex')}`)
  } else {
    console.info(`Rejection detected: ${block.key.slice(0, 4).toString('hex')} </3 ${pBlock.key.slice(0, 4).toString('hex')}`)
  }
  return true
}
module.exports = Kernel
