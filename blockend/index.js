const { SimpleKernel } = require('picostack')
// Lowlevel registers that hold block-state
const PeerCtrl = require('./slices/peers.reg')
const VibeCtrl = require('./slices/vibes.reg')
const ConversationCtrl = require('./slices/chats.reg')
const { InventorySlice, TransactionsSlice } = require('./slices/inv.reg')

// const StatsCtrl = require('./slices/stats')
// Kernel Modules (simply mixins)
const ChatModule = require('./mod/chat.mod')
const BufferedRegistry = require('./mod/buffered-registry.mod')
const GarbageCollector = require('./mod/gc.mod')
const PeersModule = require('./mod/peers.mod')
const VibesModule = require('./mod/vibes.mod')
const MonitorModule = require('./mod/monitor.mod')

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
  typeOfBlock
} = require('./util')
const Transactions = require('./transactions')

const debug = require('debug')
const D = debug('picochat:kernel')
// debug.enable('pico*')

class Kernel extends SimpleKernel {
  static Transactions = Transactions

  constructor (db, opts = {}) {
    super(db, opts)
    // Process opts
    this._vibeBox = opts.box ?? null // Vibe box-pair

    // Setup slices
    this.store.register(PeerCtrl()) // Register PeerStore that holds user profiles
    this.store.register(PeerCtrl.ProfileCtrl(() => this.pk))
    this._vibeController = new VibeCtrl() // TODO: return { resolveKeys: fn, controller: fn }
    this.store.register(this._vibeController)
    this.store.register(ConversationCtrl())
    this.store.register(InventorySlice())
    this.store.register(TransactionsSlice())
    // this.store.register(StatsCtrl())

    // Load Mixins/ Kernel Modules
    Object.assign(this, PeersModule())
    Object.assign(this, VibesModule())
    Object.assign(this, ChatModule())
    Object.assign(this, BufferedRegistry())
    // Object.assign(this, Network(this))
    Object.assign(this, GarbageCollector(this.store))
    Object.assign(this, MonitorModule())
  }

  /**
   * Restores session/data from store
   * returns {boolean} true if user exists
   */
  async boot () {
    if (this.__loading) return this.__loading
    this.__loading = (async () => {
      // If identity wasn't provided via opts.
      if (!this._secret) {
        try {
          // Attempt to restore existing identity
          this._secret = await this.repo.readReg(KEY_SK)
        } catch (err) {
          if (!err.notFound) throw err
        }
      }
      // Fallback to generate new identity
      /**
       * TODO: bugged state, before profile was assumed if
       * secret was available, SimpleKernel autogenerates
       * anonymous secret but profile is not guaranteed.
       * Think... Do i want to accidentally initialize
       * slices with wrong identity?
      if (!this._secret) {
        const { sk } = Feed.signPair()
        this._secret = sk
        await this.repo.writeReg(KEY_SK, sk)
      }
      */

      if (this._secret) {
        this._vibeBox = {
          sk: await this.repo.readReg(KEY_BOX_LIKES_SK),
          pk: await this.repo.readReg(KEY_BOX_LIKES_PK)
        }
        this._vibeController.setKeys(this.pk, this._vibeBox)
      }
      await this.store.load() // load stores
      this.ready = true

      if (this._secret && this.store.state.peer) {
        this.__setHasProfile(true)
        return true
      }
      return false
    })()
    return this.__loading
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
  async mergeStrategy (block, repo) { // TODO: expose loudFail flag? mergStr(b, r, !dryMerge && loud)
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
}

module.exports = Kernel
