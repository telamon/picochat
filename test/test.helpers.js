const levelup = require('levelup')
const memdown = require('memdown')
const { next } = require('../src/blockend/nuro')
const Kernel = require('../src/blockend/')
const D = require('debug')('picochat:test')

// Alice and Bob sits down at a table
async function makeMatch (kOpts = {}) {
  const alice = await spawnPeer('Alice', kOpts)
  const bob = await spawnPeer('BoB', kOpts)
  const aPlug = alice.spawnWire()
  await bob.spawnWire({ client: true }).open(aPlug) // connect peers
  await next(s => bob.k.store.on('peers', s)) // await profile exchange
  const chatId = await bob.k.sendVibe(alice.k.pk)
  await next(s => alice.k.store.on('vibes', s)) // await vibe recv
  await alice.k.respondVibe(chatId)
  await next(s => bob.k.store.on('vibes', s)) // await vibe resp
  const disconnect = () => {
    const c = aPlug.closed
    aPlug.close()
    return c
  }
  return { alice, bob, chatId, disconnect }
}

// Guy walks into a bar
async function spawnPeer (name, kOpts = {}) {
  const app = new Kernel(makeDatabase(), kOpts)
  monkeyPatchStoreMutex(name, app)
  await app.load()
  await app.register({
    name,
    tagline: `${name} is awesome!`,
    sex: Math.floor(Math.random() * 3), // \("v")/
    age: Math.floor(Math.random() * 18 + 50),
    picture: ':|'
  })
  const spawnWire = await app.enter('Abyss')

  return {
    k: app,
    spawnWire
  }
}

async function spawnSwarm (...actors) {
  const peers = []
  for (const name of actors) {
    D('Spawning peer', name)
    const b = await spawnPeer(name)
    if (peers.length) {
      const a = peers[peers.length - 1]
      b.spawnWire({ client: true }).open(a.spawnWire())
    }
    peers.push(b)
  }
  D('Swarm spawned', peers)
  return peers
}

function makeDatabase () {
  return levelup(memdown())
}

function monkeyPatchStoreMutex (name, kernel) {
  const waitLock = kernel.store._waitLock.bind(kernel.store)
  // const stacks = []
  kernel.store._waitLock = async function () {
    // let stack = null
    const queue = this._queue
    // try { throw new Error('mutex') } catch (err) { stack = err.stack }
    D('Mutex REQUESTED', name, queue.length) //, stack)
    const unlock = await waitLock()
    D('Mutex ACQUIRED', name, queue.length)
    return () => {
      unlock()
      D('Mutex RELEASED', name, queue.length)
    }
  }
  return kernel
}

module.exports = {
  makeMatch,
  spawnPeer,
  spawnSwarm,
  makeDatabase,
  D
}
