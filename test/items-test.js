const test = require('tape')
const { next } = require('piconuro')
const {
  spawnSwarm,
  doMatch,
  turnBye,
  turnSend
} = require('./test.helpers')

const {
  ACTION_CONJURE_WATER
} = require('..').Transactions

test('Peer has an inventory of items', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob')
  const aProfile = await next(alice.k.$profile())
  const bProfile = await next(bob.k.$profile())
  t.equal(aProfile.inventory?.length, 0, "Alice's inventory empty")
  t.equal(bProfile.inventory?.length, 0, "Bob's inventory empty")
})

test('Two peers mint a glas of water', async t => {
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
  // const bProfile = await next(bob.k.$profile())
  const aWater = aProfile.inventory.find(i => i.id === 0xD700)
  t.ok(aWater, 'A fresh glass of water was minted')
  // console.log(aWater)
})
