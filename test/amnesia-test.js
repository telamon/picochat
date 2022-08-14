const test = require('tape')
const { next, until } = require('piconuro')
const {
  spawnSwarm,
  spawnPeer,
  makeMatch
} = require('./test.helpers')

test('Profile expires', async t => {
  const peers = await spawnSwarm('alice', 'bob', 'charlie', 'daphne')
  const [alice] = peers
  let profiles = await until(
    alice.k.$peers(),
    ps => ps.length === 3
  )
  await alice.k._collectGarbage(Date.now() + 86400000)
  profiles = Object.values(await next(s => alice.k.store.on('peers', s), 0))
  t.equal(profiles.length, 1) // Eh what to do about own profile????
})

test('Vibes deleted', async t => {
  const { bob } = await makeMatch()
  let vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 1)

  await bob.k._collectGarbage(Date.now() + 86400000)
  vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 0)
})

test('Chats deleted', async t => {
  const { bob, alice, chatId } = await makeMatch()
  let vibes = await next(bob.k._vibes(), 0)
  t.equal(vibes.length, 1)

  let bChat = await next(bob.k.$chat(chatId), 1)
  await bChat.send('Marry me!')
  const aChat = await next(alice.k.$chat(chatId), 2)
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
  t.equal(bChat.errorMessage, 'ChatNotFound')
})

test('Vibes for active chat not deleted', async t => {
  const { bob, alice, chatId } = await makeMatch()
  let vibes = await next(bob.k.$vibes())
  t.equal(vibes.length, 1)
  const initialTimeout = vibes[0].expiresAt
  let bChat = await next(bob.k.$chat(chatId))
  await bChat.send('Can I ask you something?')
  let aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('Sure')
  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('What`s the airspeed veolicty of an unladen European swallow?')

  // Ensure all blocks transfered
  aChat = await next(alice.k.$chat(chatId), 2)
  bChat = await next(bob.k.$chat(chatId))
  t.equal(aChat.messages.length, bChat.messages.length, 'parties in sync')

  const vibe = await next(bob.k.$vibe(chatId))
  t.notEqual(vibe.expiresAt, initialTimeout)
  t.equal(vibe.expiresAt, bChat.expiresAt)

  await bob.k._collectGarbage(bChat.expiresAt - 5000)

  vibes = await next(bob.k.$vibes())
  t.equal(vibes.length, 1)
})

test('_tracePath(head) searches backwards for profile block(s)', async t => {
  const kent = await spawnPeer('Kent')
  const f = await kent.k.feed()
  const { heads } = await kent.k._tracePath(f.last.sig)
  t.ok(Array.isArray(heads))
  t.equal(heads.length, 1)
  t.ok(f.first.sig.equals(heads[0]))
})

test('_tracePath(head) searches backwards finds both tails', async t => {
  const { alice, bob, chatId } = await makeMatch()
  const chatA = await alice.k.loadChat(chatId)
  const chatB = await bob.k.loadChat(chatId)
  t.ok(chatA.last.sig.equals(chatB.last.sig), 'Chats are in sync')
  const fB = await bob.k.feed()
  t.ok(fB.last.sig.equals(chatA.last.sig), 'k.feed() includes remote blocks on initiators feed')

  const profA = await alice.k.repo.tailOf(alice.k.pk)
  const profB = fB.first.sig

  const aHead = await alice.k.repo._getLatestPtr(alice.k.pk)
  const searchA = await alice.k._tracePath(aHead)

  t.equal(searchA.heads.length, 2, 'search by AHEAD produces both tails')
  t.ok(profA.equals(searchA.heads[1]), 'Pa found via vr.link')
  t.ok(profB.equals(searchA.heads[0]), 'Pb found via v.parent')

  const searchB = await bob.k._tracePath(fB.last.sig)

  t.equal(searchB.heads.length, 2, 'search by BHEAD also finds both tails')
  t.ok(profA.equals(searchB.heads[1]))
  t.ok(profB.equals(searchB.heads[0]))
})
