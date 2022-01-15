const test = require('tape')
const { next } = require('../blockend/nuro')
const {
  spawnPeer,
  spawnSwarm,
  makeMatch,
  makeChat
} = require('./test.helpers')

test('Own vibes should be visible', async t => {
  const [alice, bob, charlie, daphne] = await spawnSwarm('alice', 'bob', 'charlie', 'daphne')
  const peers = await next(alice.k.$peers(), 1)
  t.equal(peers.length, 3, 'Peers discovered')
  charlie.k.sendVibe(alice.k.pk)
  daphne.k.sendVibe(alice.k.pk)
  await alice.k.sendVibe(bob.k.pk)
  const vibes = await next(alice.k.$vibes(), 3)
  t.equal(vibes.length, 3)
})

test('Send vibe to peer', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  // Connect them
  bob.spawnWire({ client: true }).open(alice.spawnWire())

  // Await profiles to be exchanged
  const state = await next(s => bob.k.store.on('peers', s))
  const aliceProfile = Object.values(state).find(p => p.name === 'Alice')
  t.ok(Buffer.isBuffer(aliceProfile.pk))
  t.ok(Buffer.isBuffer(aliceProfile.box))

  // Bob approaches Alice causing a new chatId to be generated
  const chatId = await bob.k.sendVibe(aliceProfile.pk)

  // Alice should have received a vibe (inspect lowlevel registers)
  let vibes = await next(s => alice.k.store.on('vibes', s))
  t.equal(vibes.own.length, 1)
  const match = vibes.matches[vibes.own[0].toString('hex')]
  t.ok(bob.k.pk.equals(match.a))
  t.ok(Buffer.isBuffer(match.remoteBox))

  // Bob should see the sent vibe
  vibes = await next(bob.k.$vibes(), 1)
  t.equal(vibes.length, 1, 'Bob sees sent vibe')
  let vibe = vibes[0]
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id), 'chatId equals vibeId')
  t.equal(vibe.state, 'waiting_remote')
  t.equal(vibe.peer.name, 'Alice')

  // Alice should see she has a potential match (inspect highlevel outputs)
  vibes = await next(alice.k.$vibes(), 1)
  t.equal(vibes.length, 1)
  vibe = vibes[0]
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id))

  t.equal(vibe.state, 'waiting_local')
  t.equal(vibe.peer.name, 'BoB', 'Alice sees the vibe')

  // Alice sends response
  await alice.k.respondVibe(vibe.id, true)

  vibe = (await next(alice.k.$vibes(), 1))[0]
  t.ok(vibe)
  t.equal(vibe.state, 'match') // <3

  // Bob receives alice response
  vibe = (await next(bob.k.$vibes(), 2))[0]
  t.ok(vibe)
  t.equal(vibe.state, 'match') // <3
  t.end()
})

test('Vibe rejected by remote', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  bob.spawnWire({ client: true }).open(alice.spawnWire()) // connect peers

  await next(bob.k.$peers()) // await profile exchange

  const chatId = await bob.k.sendVibe(alice.k.pk)

  await next(alice.k.$vibes(), 1) // await vibe recv
  await alice.k.respondVibe(chatId, false)

  const vibe = (await next(bob.k.$vibes(), 2))[0] // await vibe resp
  t.equal(vibe.state, 'rejected')
  t.end()
})

test('First notify after block-creation should contain peer', async t => {
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')
  bob.spawnWire({ client: true }).open(alice.spawnWire()) // connect peers
  await next(bob.k.$peers(), 1) // await profile exchange
  // Subscribe on vibes-list ahead
  let n = 0
  const p = new Promise((resolve, reject) => {
    const unsub = bob.k.$vibes()(vibes => {
      n++
      if (!vibes.length) return
      t.equal(vibes.length, 1)
      t.equal(vibes[0].peer.name, 'Alice')
      unsub()
      resolve()
    })
  })
  await bob.k.sendVibe(alice.k.pk)
  await p
  t.equal(n, 2)
  t.end()
})

test('Vibe receiver should not have double vibes', async t => {
  const { alice, bob } = await makeMatch()
  const aVibes = await next(alice.k.$vibes())
  const bVibes = await next(bob.k.$vibes())
  t.equal(aVibes.length, 1, 'Alice has 1 vibe')
  t.equal(bVibes.length, 1, 'Bob has 1 vibe')
  t.end()
})

test('Sending vibe to someone who`s waiting for reply should result in match', async t => {
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')
  bob.spawnWire({ client: true }).open(alice.spawnWire()) // connect peers
  await next(bob.k.$peers()) // await profile exchange
  const bCID = await bob.k.sendVibe(alice.k.pk)
  let aVibes = await next(alice.k.$vibes(), 1)
  let bVibes = await next(bob.k.$vibes(), 1)
  t.equal(aVibes.length, 1)
  t.equal(aVibes.length, bVibes.length)
  const aCID = await alice.k.sendVibe(bob.k.pk)
  t.ok(bCID.equals(aCID))
  bVibes = await next(bob.k.$vibes(), 2)
  aVibes = await next(alice.k.$vibes())
  t.equal(aVibes.length, 1)
  t.equal(aVibes.length, bVibes.length)
  t.equal(bVibes[0].state, 'match')
})

test('Store rejects sendVibe if previous has not timed out', async t => {
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')
  bob.spawnWire({ client: true }).open(alice.spawnWire()) // connect peers
  await next(bob.k.$peers()) // await profile exchange
  await bob.k.sendVibe(alice.k.pk)
  let bVibes = await next(bob.k.$vibes())
  // Bob is to urgent
  try {
    await bob.k.sendVibe(alice.k.pk)
    t.fail('Should have thrown')
  } catch (error) {
    t.ok(error, error.message)
  }
  bVibes = await next(bob.k.$vibes())
  t.equal(bVibes.length, 1)
})

test('Initiator can send vibe after chat end', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  const chatAB = await makeChat(alice, bob)
  t.ok(chatAB)
  // await alice.k._inspectChat(chatAB)
  const chatAC = await makeChat(alice, charlie)
  t.ok(chatAC)
  // await alice.k._inspectChat(chatAC)
})

test.only('Kernel.$chats() contains list of own chats', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  const chatAB = await makeChat(alice, bob)
  const chatAC = await makeChat(charlie, alice)
  console.log('=================')
  const chats = await next(alice.k.$chats(), 0)
  t.equal(chats.length, 2)
})
