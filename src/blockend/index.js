// SPDX-License-Identifier: AGPL-3.0-or-later
const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
const { RPC } = require('./rpc')
const PeerCtrl = require('./slices/peers')
const VibeCtrl = require('./slices/vibes')
const ConversationCtrl = require('./slices/chats')
const {
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK,
  TYPE_PROFILE,
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  VIBE_REJECTED,
  PASS_TURN,
  decodeBlock,
  encodeBlock,
  boxPair,
  seal,
  toBuffer
} = require('./util')
const debug = require('debug')
const D = debug('picochat:Kernel')

// debug.enable('pico*')

class Kernel {
  constructor (db) {
    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo, mergeStrategy)

    // Setup slices
    this.store.register(PeerCtrl.ProfileCtrl(() => this.pk))
    this.store.register(PeerCtrl()) // Register PeerStore that holds user profiles
    this._vibeController = new VibeCtrl() // TODO: return { resolveKeys: fn, controller: fn }
    this.store.register(this._vibeController)
    this.store.register(ConversationCtrl())
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
    await this.repo.writeReg(key, peer.pk)
    return chatId
  }

  /**
   * Responds to a vibe by generating the second box pair
   * params:
   * - chatId {BlockSignature} id of the initial vibe-block.
   */
  async respondVibe (chatId, like = true) {
    chatId = toBuffer(chatId)
    const msgBox = boxPair()
    const vibe = this.store.state.vibes.received.find(v => v.chatId.equals(chatId))
    if (!vibe) throw new Error('VibeNotFound')
    const peer = await this.profileOf(vibe.from)
    if (!peer) throw new Error('PeerNotFound')
    const sealedMessage = seal(msgBox.pk, peer.box)
    const block = await this.repo.readBlock(chatId)
    const convo = await this._createBlock(Feed.from(block), TYPE_VIBE_RESP, {
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

    const mut = await this.dispatch(branch, true) // Dispatch last block to store
    if (!mut.length) throw new Error('CreateBlock failed: rejected by store')
    if (this._badCreateBlockHook) this._badCreateBlockHook(branch.slice(-1))
    return branch
  }

  async profileOf (key) {
    /*
    const tail = await this.repo.tailOf(key)
    const block = await this.repo.readBlock(tail)
    if (!block) throw new Error('Profile not found, error due to profileOf is WIP; Need multihead resolve + network query')
    if (!key.equals(block.key)) throw new Error('Wrong profile encountered')
    const profile = decodeBlock(block.body)
    if (profile.type !== TYPE_PROFILE) throw new Error('Tail is not a profile: ' + profile.type)
    */
    key = toBuffer(key)
    const profile = this.store.state.peers[key.toString('hex')]
    if (!profile) {
      // debugger
      throw new Error('ProfileNotFound')
    }
    return profile
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
        createdAt: Infinity,
        respondedAt: -1,
        remoteRejected: false,
        localRejected: false,
        head: null
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
        chats[id].initiator = !vibe.isResponse ? 'remote' : 'local'
        chats[id].remoteRejected = vibe.rejected
        if (vibe.isResponse) chats[id].head = vibe.sig
      }
      for (const vibe of sent) {
        const id = vibe.chatId.toString('hex')
        chats[id] = chats[id] || initChat(vibe.chatId)
        chats[id].sent = 1
        chats[id].fetchPair = () => this._getLocalChatKey(vibe.chatId)
        chats[id].updatedAt = Math.max(chats[id].updatedAt, vibe.date)
        chats[id].createdAt = Math.min(chats[id].createdAt, vibe.date)
        chats[id].initiator = !vibe.isResponse ? 'local' : 'remote'
        chats[id].localRejected = vibe.rejected
        if (vibe.isResponse) chats[id].head = vibe.sig
      }
      const tasks = []
      for (const vibe of Object.values(chats)) {
        if (vibe.received && vibe.remoteRejected) vibe.state = 'rejected'
        else if (vibe.sent && vibe.localRejected) vibe.state = 'rejected'
        else if (vibe.received && !vibe.sent) vibe.state = 'waiting_local'
        else if (vibe.sent && !vibe.received) vibe.state = 'waiting_remote'
        else if (vibe.sent && vibe.received) vibe.state = 'match'
        else vibe.state = 'mental_error'

        // INNER JOIN profile on vibe
        // Attempt to remember who we sent what to.
        if (!vibe.peer && vibe.initiator === 'local') {
          const key = Buffer.allocUnsafe(Feed.SIGNATURE_SIZE + 1)
          vibe.id.copy(key, 1)
          key[0] = 84 // ASCII: 'T'
          tasks.push(
            this.repo.readReg(key)
              .then(pk => this.profileOf(pk))
              .then(peer => { vibe.peer = peer })
          )
        } else if (Buffer.isBuffer(vibe.peer)) {
          tasks.push(
            this.profileOf(vibe.peer)
              .then(p => { vibe.peer = p })
          )
        }
      }

      // When all tasks finish invoke subscriber
      Promise.all(tasks)
        .then(() => sub(Object.values(chats)))
        .catch(err => {
          console.error('Error occured during vibes derivation:', err)
          throw err
        })
    })
  }

  /*
   * A reactive store whose value is conversation object
   * containing all then necesarry tidbits and bound actions
   * to progress the conversation
   */
  getChat (chatId, subscriber) {
    chatId = toBuffer(chatId)
    let head = chatId
    // Actions
    const send = async message => {
      if (!chat.myTurn) throw new Error('NotYourTurn')
      if (typeof message !== 'string') throw new Error('Message should be a string')
      if (!message.length) throw new Error('EmptyMessage')
      // const { sk } = await this._getLocalChatKey(chatId) // Local Secret Key
      const pk = await this._getRemoteChatKey(chatId) // Remote Public Key
      const branch = await this.repo.loadFeed(head)
      await this._createBlock(branch, TYPE_MESSAGE, {
        content: message ? seal(toBuffer(message), pk) : null
      })
    }
    const pass = async () => {
      if (!chat.myTurn) throw new Error('NotYourTurn')
      return send(PASS_TURN)
    }
    const bye = async () => {} // TODO: black magic

    // State
    let dirty = true
    const chat = {
      id: chatId,
      state: 'init',
      myTurn: true,
      messages: [],
      updatedAt: 0,
      remoteBox: 0,
      send,
      pass,
      bye
    }

    const subs = [
      this.vibes(vibes => {
        const vibe = vibes.find(v => chatId.equals(v.id))
        // All conversations must start with a vibe
        if (!vibe) set({ state: 'error', message: 'VibeNotFound' })
        head = vibe.head
        if (vibe.state === 'match') set({ state: 'active' })
        else if (vibe.state === 'rejected') set({ state: 'inactive' })
        set({
          updatedAt: Math.max(chat.updatedAt, vibe.updatedAt),
          createdAt: vibe.createdAt
        })
        if (!chat.messages.length && vibe.state === 'match') {
          // First to vibe is first to write
          set({ myTurn: vibe.initiator === 'local' })
        }
        notify()
      })
    ]
    notify()
    return () => { for (const unsub of subs) unsub() }

    function notify (force = true) {
      if (!force && !dirty) return
      dirty = false
      subscriber(chat)
    }
    function set (patch) {
      for (const k in patch) {
        if (chat[k] !== patch[k]) dirty = true
        chat[k] = patch[k]
      }
    }
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
    if (!value) throw new Error('BoxPairNotFound')
    const box = {
      pk: value.slice(32),
      sk: value.slice(0, 32)
    }
    return box
  }

  async _getRemoteChatKey (chatId) {
    const vibe = this.store.state.vibes.received.find(v => v.chatId.equals(chatId))
    if (!vibe) throw new Error('ConversationNotFound')
    if (!vibe.box) throw new Error('BoxPublicKeyNotAvailable')
    return vibe.box
  }
}

// This function is called by repo when a non-linear block is encountered
async function mergeStrategy (block, repo) { // TODO: expose loudFail flag? mergStr(b, r, !dryMerge && loud)
  const content = decodeBlock(block.body)
  const { type } = content

  // Allow VibeResponses to be merged onto foreign vibes
  if (type === TYPE_VIBE_RESP) {
    const pBlock = await repo.readBlock(block.parentSig)
    const pContent = decodeBlock(pBlock.body)
    if (pContent.type !== TYPE_VIBE) return false
    if (!VIBE_REJECTED.equals(content.box)) {
      D(`Match detected: ${block.key.slice(0, 4).toString('hex')} <3 ${pBlock.key.slice(0, 4).toString('hex')}`)
    } else {
      D(`Rejection detected: ${block.key.slice(0, 4).toString('hex')} </3 ${pBlock.key.slice(0, 4).toString('hex')}`)
    }
    return true // All good, merge permitted
  }

  return false // disallow by default
}
module.exports = Kernel
