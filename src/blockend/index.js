// SPDX-License-Identifier: AGPL-3.0-or-later
const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
const PeerStore = require('./slices/peers')
const {
  KEY_SK,
  TYPE_PROFILE,
  parseBlock,
  encodeBlock
} = require('./util')

class Kernel {
  constructor (db) {
    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo)
    // Setup sub-store
    this.store.register(PeerStore) // Register PeerStore that holds user profiles
  }

  /**
   * Restores session/data from store
   * returns {boolean} true if user exists
   */
  async load () {
    await this.store.load() // returns notification
    this._sk = await this.repo.readReg(KEY_SK)
      .catch(err => {
        if (!err.notFound) throw err
      })

    return !!this._sk
  }

  /**
   * Returns user's public key (same thing as userId)
   */
  get pk () {
    return this._sk.slice(32)
  }

  /**
   * Generates a new user identity and creates the first profile block
   */
  async register (profile) {
    // Generate new KeyPair and save secretKey in storage
    const pair = Feed.signPair()
    await this.repo.writeReg(KEY_SK, pair.sk)
    this._sk = pair.sk
    return this.updateProfile(profile)
  }

  /**
   * Creates a new profile-block
   */
  async updateProfile (profile) {
    return await this._createBlock(TYPE_PROFILE, profile)
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
    return parseBlock(feed.last.body).seq
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
    return await this.dispatch(branch.slice(-1)) // Dispatch last block to store
  }

  /**
   * Mutates store and reduced state
   * returns {string[]} names of stores that were modified by this action
   */
  async dispatch (patch) {
    this._checkReady()
    return await this.store.dispatch(patch)
  }
}

module.exports = Kernel