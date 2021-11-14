const levelup = require('levelup')
const memdown = require('memdown')
const { nextState } = require('../src/blockend/nuro')
const Kernel = require('../src/blockend/')

// Alice and Bob sits down at a table
async function makeMatch (kOpts = {}) {
  const alice = await spawnPeer('Alice', kOpts)
  const bob = await spawnPeer('BoB', kOpts)
  const disconnect = bob.spawnWire({ client: true })(alice.spawnWire()) // connect peers
  await nextState(s => bob.k.store.on('peers', s)) // await profile exchange
  const chatId = await bob.k.sendVibe(alice.k.pk)
  await nextState(s => alice.k.vibes(s)) // await vibe recv
  await alice.k.respondVibe(chatId)
  await nextState(s => bob.k.vibes(s)) // await vibe resp
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
    const b = await spawnPeer(name)
    if (peers.length) {
      const a = peers[peers.length - 1]
      b.spawnWire({ client: true })(a.spawnWire())
    }
    peers.push(b)
  }
  return peers
}

function makeDatabase () {
  return levelup(memdown())
}

module.exports = {
  makeMatch,
  spawnPeer,
  spawnSwarm,
  makeDatabase
}
