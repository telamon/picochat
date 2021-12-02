const test = require('tape')
const { next } = require('../src/blockend/nuro')
// const Kernel = require('../src/blockend/')
const {
  spawnSwarm,
  makeMatch
} = require('./test.helpers')

test('GC: Profile expires', async t => {
  const peers = await spawnSwarm('alice', 'bob', 'charlie', 'daphne')
  const [alice] = peers

  let profiles = Object.values(await next(s => alice.k.store.on('peers', s), 1))
  t.equal(profiles.length, 4)
  await alice.k._collectGarbage(Date.now() + 86400000)
  profiles = Object.values(await next(s => alice.k.store.on('peers', s), 0))
  t.equal(profiles.length, 1) // Eh what to do about own profile????
})

test('GC: Vibes deleted', async t => {
  const { bob } = await makeMatch()
  let vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 1)

  await bob.k._collectGarbage(Date.now() + 86400000)
  vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 0)
})

test('GC: Chats deleted', async t => {
  const { bob, alice, chatId } = await makeMatch()
  let vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 1)

  let bChat = await next(bob.k.$chat(chatId), 0)
  await bChat.send('Marry me!')
  const aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.send('leave me alone you creep!')
  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('But i love you!')
  // Alice's feed is not timelocked and refuses reply

  // I'm sorry bro, it's time to forget her...
  await bob.k._collectGarbage(Date.now() + 86400000)
  vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 0)
  bChat = await next(bob.k.$chat(chatId), 0)
  t.equal(bChat.state, 'error')
  t.equal(bChat.errorMessage, 'VibeNotFound')
})
