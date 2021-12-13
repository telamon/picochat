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

module.exports = {
  makeMatch,
  spawnPeer,
  spawnSwarm,
  makeDatabase,
  D
}
