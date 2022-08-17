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

test.skip('Water is tradeable', async t => {
  const [alice, bob, gaul] = await spawnSwarm('Alice', 'Bob', 'Gaul')
  await makeChat(bob, alice, { t: ACTION_CONJURE_WATER })

  let inv = await next(mute(bob.k.$profile(), p => p.inventory))
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Bob has water')
  t.equal(inv[0].qty, 1, '1 water')

  await makeChat(bob, gaul, { t: ACTION_OFFER, p: { i: WATER, q: 1 } })
  inv = await next(mute(bob.k.$profile(), p => p.inventory))
  // inv = await until(mute(bob.k.$profile(), p => p.inventory), i => i?.length)
  t.ok(inv[0]) // low-level save 0qty item behaviour?
  t.equal(inv[0].id, WATER, 'Bob knows water')
  t.equal(inv[0].qty, 0, 'Bob no long')

  inv = await until(mute(gaul.k.$profile(), p => p.inventory), i => i?.length)
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Gaul knows water')
  t.equal(inv[0].qty, 1, '1 water')

  try { // Alice has no water to give, but tries to anyway
    await doMatch(alice, gaul, { t: ACTION_OFFER, p: { i: WATER, q: 5 } })
    t.fail('Invalid block was accepted')
  } catch (err) { t.equal(err.message, 'InvalidBlock: InventoryEmpty') }
  inv = await next(mute(gaul.k.$profile(), p => p.inventory))
  t.equal(inv[0].qty, 1, '1 water')
})

test('On mint effect', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  let a = await until(alice.k.$profile(), p => p.state !== 'loading')
  t.equal(a.balance, 0, 'Alice has zero decents')
  const transaction = { t: ACTION_CONJURE_WATER }
  await makeChat(alice, bob, transaction)
  a = await until(alice.k.$profile(), p => p.inventory?.length)
  t.equal(a.balance, 60 + 11, 'Alice item onpickup effect')
})
