// SPDX-License-Identifier: AGPL-3.0-or-later
const Repo = require('picorepo')
const Store = require('@telamon/picostore')
const Feed = require('picofeed')
const KEY_SK = 'reg/sk'

class Kernel {
  constructor (db) {
    this.db = db
    this.repo = new Repo(db)
    this.store = new Store(this.repo)
  }

  async load () {
    await this.store.load() // returns notification
    this._sk = await this.repo.readReg(KEY_SK)
      .catch(err => {
        if (!err.notFound) throw err
      })

    return !!this._sk
  }

  get pk () {
    return this._sk.slice(32)
  }

  async register (profile) {
    // Generate new SK and save in storage
    const pair = Feed.signPair()
    await this.repo.writeReg(KEY_SK, pair.sk)
    this._sk = pair.sk

    // Creat New Profile Block
    // To Do move to update func

    const f = (await this.repo.loadHead(this.pk, 1)) || new Feed()
    // const seq = f.length ? parseBlock(f.last.body).seq + 1 : 0
    const data = { ...profile, date: new Date().getTime(), seq: 0 }

    f.append(JSON.stringify(data), pair.sk)
    f.inspect()
  }

  get profile () {
    return this.store.state.peers[this.pk.toString('hex')]
  }
}

module.exports = Kernel
