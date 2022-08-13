const test = require('tape')
const { next, mute, until } = require('piconuro')
const {
  spawnSwarm,
  makeChat,
  doMatch,
  turnBye,
  turnSend
} = require('./test.helpers')

const {
  ACTION_CONJURE_WATER,
  ACTION_OFFER
} = require('..').Transactions

const WATER = 0xD700

test('Peer has an inventory of items', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  const aProfile = await next(alice.k.$profile())
  const bProfile = await next(bob.k.$profile())
  t.equal(aProfile.inventory?.length, 0, "Alice's inventory empty")
  t.equal(bProfile.inventory?.length, 0, "Bob's inventory empty")
})

test('Two peers mint a glass of water', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  const transaction = { t: ACTION_CONJURE_WATER }
  const cid = await doMatch(alice, bob, transaction)
  await turnSend(alice.k, cid, 'Thank you, i was dying of thirst!')
  await turnSend(bob.k, cid, 'You\'re welcome, staying hydrated n all?')
  await turnSend(alice.k, cid, 'Naw, I was out running and remembered to check in')
  await turnSend(bob.k, cid, '2022, socializing is broeken')
  await turnBye(alice.k, cid, 0)
  await turnBye(bob.k, cid, 0)

  const aProfile = await next(alice.k.$profile(), 2)
  const aWater = aProfile.inventory.find(i => i.id === WATER)
  t.equal(aWater.id, WATER)
  t.equal(aWater.qty, 1)
  t.ok(aWater, 'A fresh glass of water was minted')
})

// TODO: Long lost SimpleKernel/RPC issue captured.
// this test races 2 of 10 fails when
// G receives B's vibe before B's profile.
test('Unordered blocks', async t => {
  const [a, b, g] = await spawnSwarm('Alice', 'Bob', 'Gaul')
  await makeChat(b, a)
  t.pass('FirstChat')
  const id = await makeChat(b, g)
  t.pass('Second chat')
  await Promise.all([
    until(a.k.$chat(id), c => c.state === 'end'),
    until(b.k.$chat(id), c => c.state === 'end'),
    until(g.k.$chat(id), c => c.state === 'end')
  ])
  t.pass('finito')
})

test.only('Water was given', async t => {
  const [alice, bob, gaul] = await spawnSwarm('Alice', 'Bob', 'Gaul')
  await makeChat(bob, alice, { t: ACTION_CONJURE_WATER })

  let inv = await next(mute(bob.k.$profile(), p => p.inventory))
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Bob knows water')
  t.equal(inv[0].qty, 1, '1 water')

  await makeChat(bob, gaul, { t: ACTION_OFFER, p: { i: WATER, q: 1 } })

  inv = await next(mute(bob.k.$profile(), p => p.inventory))
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Bob knows water')
  t.equal(inv[0].qty, 0, '0 water')

  inv = await next(mute(gaul.k.$profile(), p => p.inventory))
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Gaul knows water')
  t.equal(inv[0].qty, 1, '1 water')
})
