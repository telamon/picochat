const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
// Lowlevel registers that hold block-state
const PeerCtrl = require('./slices/peers.reg')
const VibeCtrl = require('./slices/vibes.reg')
const ConversationCtrl = require('./slices/chats.reg')
// const StatsCtrl = require('./slices/stats')
// Kernel Modules (simply mixins)
const ChatModule = require('./mod/chat.mod')
const Network = require('./mod/net.mod')
const BufferedRegistry = require('./mod/buffered-registry.mod')
const GarbageCollector = require('./mod/gc.mod')
const PeersModule = require('./mod/peers.mod')
const VibesModule = require('./mod/vibes.mod')

// Util
const {
  KEY_SK,
  KEY_BOX_LIKES_PK,
  KEY_BOX_LIKES_SK,
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  TYPE_PROFILE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  VIBE_REJECTED,
  decodeBlock,
  encodeBlock,
  typeOfBlock
} = require('./util')
const debug = require('debug')
const D = debug('picochat:kernel')
const { writable, combine, get } = require('./nuro')
// debug.enable('pico*')

function initialState () {
  const [loaded, setLoaded] = writable(false)
  // Passive nodes participate in the network
  // but do not publish blocks of their own. (upgraded simply by injecting sk)
  // ( NOT YET SUPPORTED!! )
  const [passive, setPassive] = writable(true)
  const [connected, setConnected] = writable(false)
  const [entered, setEntered] = writable(false)
  return [
    combine({ loaded, passive, connected, entered }),
    { setLoaded, setPassive, setConnected, setEntered }
  ]
}

class Kernel {
  constructor (db, config = {}) {
    this.config = Object.freeze({
      profile_ttl: config ?? 3 * 60 * 60000, // 3hours
      vibe_ttl: config ?? 5 * 60000, // 5 minutes
      chat_ttl: config ?? 30 * 60000, // 30minutes
      now: config.now ?? (() => Date.now())
    })

    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo, mergeStrategy)
    this._state = initialState()
    // Process opts
    this._sk = null // Signing secret + public key
    this._vibeBox = null // Vibe box-pair

    // Setup slices
    this.store.register(PeerCtrl.ProfileCtrl(() => this.pk))
    this.store.register(PeerCtrl()) // Register PeerStore that holds user profiles
    this._vibeController = new VibeCtrl() // TODO: return { resolveKeys: fn, controller: fn }
    this.store.register(this._vibeController)
    this.store.register(ConversationCtrl())
    // this.store.register(StatsCtrl())

    // Load Mixins
    Object.assign(this, PeersModule())
    Object.assign(this, VibesModule())
    Object.assign(this, ChatModule())
    Object.assign(this, BufferedRegistry())
    Object.assign(this, Network(this))
    Object.assign(this, GarbageCollector(this.store))
  }

  get state () { return get(this._state[0]) }
  get $state () { return this._state[0] }

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
      if (this._sk && this.store.state.peer) this.__setHasProfile(true)
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
    return this.repo.loadHead(this.pk)
  }

  async _tracePath (head) {
    const keys = []
    const heads = []
    let chatId = null
    let nLoaded = 0
    const feed = await this.repo.loadFeed(head, (block, abort) => {
      const type = typeOfBlock(block.body)
      switch (type) {
        case TYPE_VIBE_RESP:
          keys[1] = block.key
          heads[1] = decodeBlock(block.body).link
          break

        case TYPE_PROFILE:
        case TYPE_BYE_RESP:
          keys[0] = block.key
          heads[0] = block.sig
          // If this is not the first block encountered
          // and we reached a bye or profile, then we've reached
          // end of segment and should not load further.
          // to load that next segment rerun tracepath with exported
          // head[0]
          if (nLoaded) abort()
          // abort(!nLoaded && type !== TYPE_BYE_RESP)
          break
        case TYPE_VIBE:
          chatId = block.sig
          break
      }
      nLoaded++
    })
    if (!feed) throw new Error('FeedNotFound')
    return { keys, heads, feed, chatId }
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
   * Mutates store and reduced state
   * returns {string[]} names of stores that were modified by this action
   */
  async dispatch (patch, loudFail = false) {
    this._checkReady()
    return await this.store.dispatch(patch, loudFail)
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
}

// The idea of merge strategy needs to be reworked a bit.
// besides passing block here, pico-repo should pass an array
// of keys that are already encountered in the feed.
//
// Strategy attempts to answer the question:
//  "When block with foreign identity encountered,
//  should the block be allowed to bump the peer's head?"
//
// Vibe is an invitation to participate so: yes. (if it was adressed to you)
// Message? "yes" if you were the one that was adressed.
// Same thing with bye.
// There are identity checks in store-filters but
// maybe should be handled on strategy level.
async function mergeStrategy (block, repo) { // TODO: expose loudFail flag? mergStr(b, r, !dryMerge && loud)
  const content = decodeBlock(block.body)
  const { type } = content
  const pBlock = await repo.readBlock(block.parentSig)
  const parentType = typeOfBlock(pBlock.body)

  // Allow VibeResponses to be merged onto foreign vibes
  if (type === TYPE_VIBE_RESP) {
    const pBlock = await repo.readBlock(block.parentSig)
    if (parentType !== TYPE_VIBE) return false
    if (!VIBE_REJECTED.equals(content.box)) {
      D('Match detected: %h <3 %h', block.key, pBlock.key)
    } else {
      D('Rejection detected: %h </3 %h', block.key, pBlock.key)
    }
    return true // All good, merge permitted
  }

  // Allow Messages onto foreign VibeResponses or Messages
  if (type === TYPE_MESSAGE) {
    if (parentType === TYPE_MESSAGE) return true
  }
  if (type === TYPE_BYE && parentType === TYPE_MESSAGE) return true
  if (type === TYPE_BYE_RESP && parentType === TYPE_BYE) return true

  console.warn('MergeStrategy rejected', parentType, '<--', type)
  return false // disallow by default
}

module.exports = Kernel
