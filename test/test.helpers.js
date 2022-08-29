const { MemoryLevel } = require('memory-level')
const { next, until } = require('piconuro')
const Kernel = require('../blockend/')
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
  const k = new Kernel(makeDatabase(), kOpts)
  await k.boot()
  await k.register({
    name,
    tagline: `${name} is awesome!`,
    sex: kOpts.sex ?? Math.floor(Math.random() * 3), // \("v")/
    age: kOpts.age ?? Math.floor(Math.random() * 18 + 50),
    picture: ':|'
  })
  const spawnWire = () => k.spawnWire()

  return {
    k,
    spawnWire,
    async dump (fname = 'repo.dot') {
      const dot = await k.inspect()
      require('fs').writeFileSync('repo.dot', dot)
    }
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
  D('Swarm spawned')
  return peers
}

function makeDatabase () {
  return new MemoryLevel('test', {
    keyEncoding: 'buffer',
    valueEncoding: 'buffer'
  })
}

// Assumes peerA and peerB are already wired up.
async function makeChat (initiator, responder, transactions) {
  const reverseFarewell = false
  const nMessages = 3
  const chatId = await doMatch(initiator, responder, transactions)

  const [a, b] = reverseFarewell
    ? [responder.k, initiator.k]
    : [initiator.k, responder.k]
  const chatA = await until(a.$chat(chatId), chat => chat.myTurn)

  D('makeChat() conversing')
  await converse(a, b, chatId, nMessages)
  await turn(a, chatId)
  await chatA.bye(0)
  D('makeChat() bye sent')
  const chatB = await until(b.$chat(chatId), chat => chat.myTurn)
  await chatB.bye(0)
  D('makeChat() bye_resp sent')
  await until(a.$chat(chatId), chat => chat.state === 'end')
  return chatId
}

/**
 * Functional helpers to drive a chain into desired state:
 * const cid = await doMatch(peerA, peerB) // Initiate time-lock
 * await doConverse(peerA, peerB, 3) // Interleaves 3 message blocks
 * await doBye(initiator, responder, gestures = [0, 0]) // ends conversation
 */
async function doMatch (a, b, transactions) {
  const rpk = b.k.pk
  await sees(a, b)
  const chatId = await a.k.sendVibe(rpk, transactions)
  D('makeChat() vibe sent %h', chatId)
  await until( // responder sees vibe
    b.k.$vibes(),
    vibes => vibes.find(v => v.id.equals(chatId))
  )
  D('makeChat() vibe received')
  await b.k.respondVibe(chatId)
  return chatId
}

// Returns chat reference
async function turn (kernel, chatId) {
  return await until(
    kernel.$chat(chatId),
    chat => chat.myTurn // && chat.state === 'active'
  )
}

async function sees (peerA, peerB) {
  return until(
    peerA.k.$peers(),
    peers => peers.find(p => p.pk.equals(peerB.k.pk))
  )
}

async function converse (kernelA, kernelB, chatId, nMessages = 3) {
  // Conversation time
  for (let i = 0; i < nMessages; i++) {
    const white = await turn(kernelA, chatId)
    await white.send(`White Message ${i}`)
    D('makeChat() wMsg sent')

    const black = await turn(kernelB, chatId)
    // Artifact
    // skip response if responder should be first to finalize
    // if (i + 1 === nMessages && reverseFarewell) continue
    await black.send(`Black Message ${i}`)
    D('makeChat() bMsg sent')
  }
}

// TODO: upgrade old tests to use this helper
// It's a lot more robust than the next/send pairs
async function turnSend (k, cid, message) {
  const chat = await turn(k, cid)
  return chat.send(message)
}
async function turnPass (k, cid) {
  const chat = await turn(k, cid)
  return chat.pass()
}
async function turnBye (k, cid, gesture = 0) {
  const chat = await turn(k, cid)
  return chat.bye(gesture)
}

module.exports = {
  makeMatch,
  spawnPeer,
  spawnSwarm,
  makeDatabase,
  makeChat,
  doMatch,
  turn,
  turnSend,
  turnPass,
  turnBye,
  sees,
  D
}
