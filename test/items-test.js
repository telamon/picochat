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
  ACTION_OFFER,
  ACTION_NETWORK_PURCHASE,
  ACTION_ATTACHMENT
} = require('..').Transactions

const { ITEMS, WATER } = require('../blockend/items.db')
const txBuyWater = Object.freeze({ t: ACTION_NETWORK_PURCHASE, p: { i: WATER, q: 1 } })
test('Peer has an inventory of items', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  const aProfile = await next(alice.k.$profile())
  const bProfile = await next(bob.k.$profile())
  t.equal(aProfile.inventory?.length, 0, "Alice's inventory empty")
  t.equal(bProfile.inventory?.length, 0, "Bob's inventory empty")
})

test('Two peers mint a glass of water', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  // Buyig water is free. (TODO: can onnly be bought once every 3 hours)
  const cid = await doMatch(alice, bob, txBuyWater)
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
// Gives away ownership of an item
test('ACTION_OFFER', async t => {
  const [alice, bob, gaul] = await spawnSwarm('Alice', 'Bob', 'Gaul')
  await makeChat(bob, alice, txBuyWater)

  let inv = await next(mute(bob.k.$profile(), p => p.inventory))
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Bob has water')
  t.equal(inv[0].qty, 1, '1 water')

  await makeChat(bob, gaul, { t: ACTION_OFFER, p: { i: WATER, q: 1 } })
  inv = await next(mute(bob.k.$profile(), p => p.inventory), 1)
  // inv = await until(mute(bob.k.$profile(), p => p.inventory), i => i?.length)
  // This test is brittle, we're testing low-level state
  // that does not filter qty:0 items and might not.
  t.ok(inv[0])
  t.equal(inv[0].id, WATER, 'Bob knows water')
  t.equal(inv[0].qty, 0, 'Bob gave it away')

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

// Disable on mint effect for now, getting the item is reward enough
test.skip('On mint effect', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  let a = await until(alice.k.$profile(), p => p.state !== 'loading')
  t.equal(a.balance, 0, 'Alice has zero decents')
  await makeChat(alice, bob, txBuyWater)
  a = await until(alice.k.$profile(), p => p.inventory?.length)
  t.equal(a.balance, 60 + 11, 'Alice item onpickup effect')
})

test('On attachment effect', async t => {
  const [alice, bob, gaul] = await spawnSwarm('Alice', 'Bob', 'Gaul')
  let g = await until(gaul.k.$profile(), p => p.state !== 'loading')
  t.equal(g.balance, 0, 'Gaul has zero decents')
  await makeChat(alice, bob, txBuyWater)
  await until(alice.k.$profile(), p => p.inventory?.length)
  await makeChat(alice, gaul, { t: ACTION_ATTACHMENT, p: WATER })
  g = await until(gaul.k.$profile(), p => p.balance > 0)
  t.equal(g.balance, 60 + 7, 'Alice offered gaul some water that he drank')
})

test('Use Item on self', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  await makeChat(alice, bob, txBuyWater)
  let a = await until(alice.k.$profile(), p => p.inventory?.length)
  t.equal(a.balance, 11)
  await alice.k.useItem(WATER)
  a = await next(alice.k.$profile())
  t.equal(a.balance, 11 + 60)
})

test('Purchase Gear from network', async t => {
  const BAB = 0xD201
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  await makeChat(alice, bob, txBuyWater)
  await alice.k.useItem(WATER)

  // TODO: this test will break if same-peer chats are prohibited.
  // If bob called alice and they ended, alice can call bob back but only once.
  const prev = await until(alice.k.$profile(), p => p.balance > 0)
  await makeChat(alice, bob, {
    t: ACTION_NETWORK_PURCHASE,
    p: {
      i: BAB,
      q: 1
    }
  })
  const a = await until(alice.k.$profile(), p => p.inventory?.length)
  t.ok(a.inventory.find(i => i.id === BAB && i.qty), 'Item in inventory')
  t.equal(a.balance - 11, prev.balance - ITEMS[BAB].price, 'Decents deducted')
})
