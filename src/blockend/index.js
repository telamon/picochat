//
const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
// Block state controllers
const PeerCtrl = require('./slices/peers')
const VibeCtrl = require('./slices/vibes')
const ConversationCtrl = require('./slices/chats')
// const StatsCtrl = require('./slices/stats')
// Kernel Modules (simply mixins)
const ChatModule = require('./mod/chat.mod')
const Network = require('./mod/net.mod')
const BufferedRegistry = require('./mod/buffered-registry.mod')
const GarbageCollector = require('./mod/gc.mod')
const PeersModule = require('./mod/peers.mod')

// Util
const {
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK,
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  VIBE_REJECTED,
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
  constructor (db, opts = {}) {
    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo, mergeStrategy)

    // Process opts
    this._now = opts.now || (() => Date.now())

    // Setup slices
    this.store.register(PeerCtrl.ProfileCtrl(() => this.pk))
    this.store.register(PeerCtrl()) // Register PeerStore that holds user profiles
    this._vibeController = new VibeCtrl() // TODO: return { resolveKeys: fn, controller: fn }
    this.store.register(this._vibeController)
    this.store.register(ConversationCtrl())
    // this.store.register(StatsCtrl())

    // Load Mixins
    Object.assign(this, PeersModule())
    Object.assign(this, ChatModule())
    Object.assign(this, BufferedRegistry())
    Object.assign(this, Network())
    Object.assign(this, GarbageCollector(this.store))
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
    await this._writeReg(key, peer.pk)
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

  // the other kind of store
  vibes (sub) {
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

  /**
   * Mutates store and reduced state
   * returns {string[]} names of stores that were modified by this action
   */
  async dispatch (patch, loudFail = false) {
    this._checkReady()
    return await this.store.dispatch(patch, loudFail)
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
  console.warn('MergeStrategy rejected', type)
  // Allow Messages onto foreign VibeResponses or Messages
  if (type === TYPE_MESSAGE) {
    // debugger
  }
  return false // disallow by default
}
module.exports = Kernel
