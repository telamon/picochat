const test = require('tape')
const Kernel = require('../src/blockend')
const { next, get } = require('../src/blockend/nuro')
const {
  spawnPeer,
  spawnSwarm,
  makeDatabase,
  makeMatch
} = require('./test.helpers')

/*
 * Further insanity; How to measure staticics in a decentralized way:
 *
 *  const stats = makeAssumptions()
 *  let isAcknowledged = false
 *  while (!isAcknowledged) propagateAsTruth(stats)
 *
 */

test('kernel.$profile', async t => {
  const app = new Kernel(makeDatabase())
  const loggedIn = await app.load()
  t.equal(loggedIn, false, 'Not logged in on first run')

  // Create a new profile
  await app.register({
    picture: ':]',
    name: 'Batman',
    tagline: 'I love driving around at night',
    age: 42,
    sex: 1
  })
  const profile = get(app.$profile())

  t.equal(profile.name, 'Batman', 'Correct username registered')
  t.equal(profile.tagline, 'I love driving around at night')
  t.equal(profile.age, 42)
  t.equal(profile.sex, 1)
  t.ok(profile.pk, 'Public key is exposed')
  t.end()
})

test('kernel.$peers(id)', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  // Alice gave her PK to bob last night
  const aPromiseOfAlice = next(bob.k.$peer(alice.k.pk), 1)

  // Alice is not there yet
  let profile = get(bob.k.$peer(alice.k.pk))
  t.equal(profile.state, 'error')
  t.equal(profile.errorMessage, 'PeerNotFound')

  // They meet up
  bob.spawnWire({ client: true })(alice.spawnWire())

  profile = await aPromiseOfAlice
  t.equal(profile.state, 'active')
  t.equal(profile.name, 'Alice')
})

test('kernel.$peers streams profile array', async t => {
  const [alice] = await spawnSwarm('Alice', 'Bob', 'Charlie', 'Daphne')
  const peers = await next(alice.k.$peers(), 2)
  t.notOk(peers.find(p => p.pk.equals(alice.k.pk)), 'Should not contain self') // under consideration
  t.equal(peers.length, 3)
})

test('Successful conversation should add peer time', async t => {
  const { alice, bob, chatId } = await makeMatch()
  const d1 = await next(bob.k.$profile(), 0)

  let bChat = await next(bob.k.$chat(chatId), 0)
  await bChat.send('Hello')

  let aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.send('Hi')

  bChat = await next(bob.k.$chat(chatId), 1)
  await bChat.send('Do you like cats?')

  aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.send('Yes but i`m a dog person')

  bChat = await next(bob.k.$chat(chatId), 1)
  await bChat.send('I`m sorry but i`m looking for someone else')

  aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.send('Why????? I`m cute and I smell nice!')

  bChat = await next(bob.k.$chat(chatId), 1)
  await bChat.bye(0)

  aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.bye(2)

  const d2 = await next(bob.k.$profile())
  const af = await alice.k.feed()
  const bf = await alice.k.feed()

  t.equal(d2.expiresAt - d1.expiresAt, 7 * 60 * 1000)
})
