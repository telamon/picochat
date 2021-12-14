const levelup = require('levelup')
const memdown = require('memdown')
const { next } = require('../blockend/nuro')
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
  D('Swarm spawned')
  return peers
}

function makeDatabase () {
  return levelup(memdown())
}

// Assumes peerA and peerB are already wired up.
async function makeChat (initiator, responder, reverseFarewell = false, nMessages = 3) {
  const rpk = responder.k.pk
  await until( // initiator sees responder
    initiator.k.$peers(),
    peers => !!peers.find(p => p.pk && p.pk.equals(rpk))
  )
  const chatId = await initiator.k.sendVibe(rpk)
  D('makeChat() vibe sent %h', chatId)
  await until( // responder sees vibe
    responder.k.$vibes(),
    vibes => vibes.find(v => v.id.equals(chatId))
  )
  D('makeChat() vibe received')
  await responder.k.respondVibe(chatId)

  // Conversation time
  for (let i = 0; i < nMessages; i++) {
    const iC = await until(
      initiator.k.$chat(chatId),
      chat => chat.state === 'active' && chat.myTurn
    )
    await iC.send(`Initiator Message ${i}`)
    D('makeChat() iMsg sent')
    const rC = await until(
      responder.k.$chat(chatId),
      chat => chat.state === 'active' && chat.myTurn
    )
    // skip response if responder should be first to finalize
    if (i + 1 === nMessages && reverseFarewell) continue

    await rC.send(`Initiator Message ${i}`)
    D('makeChat() rMsg sent')
  }

  const [a, b] = reverseFarewell
    ? [responder.k, initiator.k]
    : [initiator.k, responder.k]
  const chatA = await until(a.$chat(chatId), chat => chat.myTurn)
  await chatA.bye(0)
  D('makeChat() bye sent')
  const chatB = await until(b.$chat(chatId), chat => chat.myTurn)
  await chatB.bye(0)
  D('makeChat() bye_resp sent')
  await until(a.$chat(chatId), chat => chat.state === 'end')
  return chatId

  async function until (neuron, condition, timeout = -1) {
    let set, setErr
    const result = new Promise((resolve, reject) => { set = resolve; setErr = reject })
    let timerId = null
    if (timeout > 0) {
      timerId = setTimeout(() => {
        setErr(new Error('until($n) timed out'))
      }, timeout)
    }
    const unsub = neuron(value => {
      if (condition(value)) {
        if (timerId) clearTimeout(timerId)
        set(value)
      }
    })
    result.finally(unsub)
    return result
  }
}

module.exports = {
  makeMatch,
  spawnPeer,
  spawnSwarm,
  makeDatabase,
  makeChat,
  D
}
