const test = require('tape')
const { next, isSync } = require('piconuro')
const Kernel = require('../blockend/')
const Feed = require('picofeed')
const {
  makeDatabase,
  spawnPeer,
  makeMatch
} = require('./test.helpers')

test('Public API neurons provide an initial value', async t => {
  const { alice, bob, chatId } = await makeMatch()
  const k = alice.k
  t.ok(await isSync(k.$profile()), '$profile')
  t.ok(await isSync(k.$peers()), '$peers')
  t.ok(await isSync(k.$peer(bob.k.pk)), '$peer(id)')
  t.ok(await isSync(k.$vibes()), '$vibes')
  t.ok(await isSync(k.$vibe(chatId)), '$vibe(id)')
  t.ok(await isSync(k.$chat(chatId)), '$chat(id)')
})

test('Synchronity of internal APIs', async t => {
  // Test internal API while we're at it.
  // internal API is by design async to reduce
  // amount of notifies/gates needed.
  // It does all the heavy lifting
  const { alice, bob, chatId } = await makeMatch()
  const k = alice.k
  t.ok(await isSync(k._peer(bob.k.pk)), '_peer(id) has no async ops')
  // t.notOk(await isSync(nfo(k._vibes())), '_vibes') // fails, produces semi-loaded vibes...
  t.notOk(await isSync(k._vibe(chatId)), '_vibe(id)')
  // t.notOk(await isSync(k._chat(chatId)), '_chat(id)') // not required yet
})

test.skip('Kernel states', async t => {
  // Things that should be encoded and available in a TYPE_PUB block
  // that should serve as an invitation.
  // (whoa I almost centralized the whole thing.)
  // Gonna take it easy with this test until the new frontend has more
  // stuff goin on.
  const Config = {
    pub: 'HardCode',
    geo: 0xffff, // Geohash of current human.
    key: PUB_PK
  }

  const a = new Kernel(makeDatabase(), Config)
  t.deepEqual(a.state, { loaded: false, passive: true, connected: false, entered: false })
  await a.load()
  t.deepEqual(a.state, { loaded: true, passive: true, connected: false, entered: false })

  await a.upgrade(Feed.signPair().sk) // Enable block-creation
  t.deepEqual(a.state, { loaded: true, passive: false, connected: false, entered: false })
  await a.enter(Feed.signPair().sk, { name: 'Amiss', tagline: 'yay', age: 24, sex: 0, picture: 'a' })
})

test.skip('Enter pub see peers', async t => {
  const PUB = 'Abyss'
  const alice = new Kernel(makeDatabase())
  const bob = new Kernel(makeDatabase())
  const robo = new Kernel(makeDatabase()) // passive node.
  await robo.load()
  await alice.load()
  await bob.load()
  await alice.enter({ name: 'Amiss', tagline: 'yay', age: 24, sex: 0, picture: 'a' })

  // Upon entering same bar/topic
  const spawnWireA = await alice.connect(PUB)
  const spawnWireB = await bob.connect(PUB)
  const spawnWireR = await robo.connect(PUB)

  await bob.enter({ name: 'Bobby', tagline: 'hey', age: 27, sex: 1, picture: 'b' })

  const b = spawnWireB()
  spawnWireR({ client: true }).open(spawnWireA()) // Connect passive node
  spawnWireA({ client: true }).open(b)

  const aPeers = Object.values(await next(s => alice.store.on('peers', s)))
  t.equal(aPeers.length, 2)
  t.ok(aPeers.find(p => p.name === 'Bobby'), 'Alice sees bob')
  const peers = await next(robo.$peers(), 1)
  t.equal(peers.length, 2)
  t.end()
})

// TODO: In next chat, fastforward match, and verify availablity of all box keys
test('After match each peer has a pair and the remote public key', async t => {
  const { alice, bob, chatId } = await makeMatch()

  // Conversation keys
  const aPair = await alice.k._getLocalChatKey(chatId)
  const aPub = await alice.k._getRemoteChatKey(chatId)

  const bPair = await bob.k._getLocalChatKey(chatId)
  const bPub = await bob.k._getRemoteChatKey(chatId)

  t.ok(aPair.sk, 'Alice has a secret key')
  t.ok(bPair.sk, 'Bob has a secret key')
  t.equal(aPair.pk?.hexSlice(), bPub.hexSlice(), 'Alice has Bob`s pubkey')
  t.equal(bPair.pk?.hexSlice(), aPub.hexSlice(), 'Bob has Alice`s pubkey')
  t.end()
})

test('Self-vibes throws error', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  try {
    await alice.k.sendVibe(alice.k.pk)
    t.fail('Error was not thrown')
  } catch (e) {
    t.equal(e.message, 'SelfVibeNotAllowed')
  }
  t.end()
})

test('Kernel#$chat()', async t => {
  const { alice, bob, chatId } = await makeMatch()

  const aChat = await next(alice.k.$chat(chatId), 1)
  t.equal(aChat.myTurn, false)
  t.equal(aChat.state, 'active')
  t.ok(Array.isArray(aChat.messages))
  t.equal(typeof aChat.send, 'function')
  t.equal(typeof aChat.pass, 'function')
  t.equal(typeof aChat.bye, 'function')

  const bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.state, 'active')
})

/*
process.on('uncaughtException', err => {
  console.warn('TRAP UNCAUGHT', err)
})
*/

test('Conversation: Hi! ... Hello', async t => {
  const { alice, bob, chatId } = await makeMatch()
  // Bob says Hi
  let bChat = await next(bob.k.$chat(chatId), 1)
  t.notEqual(bChat.state, 'loading')
  t.ok(bChat.myTurn)
  await bChat.send('Hi!') // Send the message

  bChat = await next(bob.k.$chat(chatId), 1)

  t.equal(bChat.myTurn, false, 'Nolonger bobs turn')
  t.equal(bChat.messages.length, 1, 'Message should be stored')
  t.equal(bChat.messages[0]?.type, 'sent')
  t.equal(bChat.messages[0]?.content, 'Hi!', 'Sent should be readable')

  // Alice reads
  let aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.myTurn, true, 'Alice Turn')
  t.equal(aChat.messages.length, 1, 'Message should be received')
  t.equal(aChat.messages[0].type, 'received')
  t.equal(aChat.messages[0].content, 'Hi!', 'should be readable')

  // Alice replies
  await aChat.send('Hello~') // Send reply
  aChat = await next(alice.k.$chat(chatId), 1) // needs async value for decryption
  t.equal(aChat.myTurn, false, 'Nolonger alice turn')
  t.equal(aChat.messages.length, 2, 'Message should be appended')

  // Bob recieves reply
  bChat = await next(bob.k.$chat(chatId), 2) // sync + receive + decrypt
  t.equal(bChat.messages.length, 2, 'new message visible')
  t.equal(bChat.messages[1].content, 'Hello~')
  t.equal(bChat.myTurn, true, 'Bob`s turn again')

  /*
  console.log('A feed');
  (await alice.k.feed()).inspect()
  console.log('B feed');
  (await bob.k.feed()).inspect()
  */
  t.end()
})

test('Conversation: lose-lose', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 3)
  bChat.send('Hi')

  let aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.myTurn, true)
  await aChat.send('Hello what')

  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.myTurn, true)
  await bChat.send('SHOW ME THEM BAPS!!1!') // improper netiquette

  aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.myTurn, true)
  await aChat.pass()

  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 2) // first hit
  await bChat.send('Y U NO SHAW THEM???') // Recovers 0.3

  aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.myTurn, true)
  await aChat.pass()

  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 1)

  await bChat.pass() // bob gives up, conversation exhausted

  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.health, 0)

  aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.myTurn, true)
  t.equal(aChat.health, 0, 'Alice also sees the health drop to zero')
  t.equal(aChat.state, 'exhausted')
  try {
    await aChat.send('U gave up?')
    t.fail('exhausted chat should throw')
  } catch (err) {
    t.equal(err.message, 'InvalidBlock: ConversationEnded')
  }
  t.end()

  // I wonder what happens if we just say exhausted conversations cannot add more blocks.
  // It's a failed head so to speak; vibe blocks only attachable on profile and 'bye'.
  // all other conversations results in 0 points? Need to sleep on this. but exhausted convo is exhausted.
})

test('Conversation: win-win', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let bChat = await next(bob.k.$chat(chatId), 1)
  bChat.send('Hi')

  let aChat = await next(alice.k.$chat(chatId), 2)

  await aChat.send('hi')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('Nice profile pic') // Master pickup artist

  aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('Thx :>')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('Is that a snake? 🤨')

  aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('What? No, It`s a bracelet!!')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('Whoa that`s rad!')

  aChat = await next(alice.k.$chat(chatId), 2)
  // mental-note: messages should be buffered with a 1-3sec delay, if user is still typing
  // then give them a chance to finish writing the next paragraph before commiting the block.
  // paragrafs should be embedded in the content as usual but visually represented as different messages.
  // - sometimes people burst into talkativity, they should be given a chance to speak their mind during the turn.
  await aChat.send('I know right?!\nBirthday present from mom\nI use it almost every day!')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('So your mom`s into snakes?')

  aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('Naw.. but I actually have a live one')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('No way? What do you feed it with')

  aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('You don`t wanna know...')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('then tell me next time <3, was really cool talking to you')

  aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.bye(2) // Alice hangs up
  aChat = await next(alice.k.$chat(chatId), 1)
  t.equal(aChat.myTurn, false)

  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.state, 'finalizing')
  t.equal(bChat.myTurn, true)

  await bChat.bye(2) // Bob hangs up

  // Both are at state end
  aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.state, 'end')
  t.equal(aChat.myTurn, false)

  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.state, 'end')
  t.equal(bChat.myTurn, false)
  t.end()
})

test('Conversation: messages should not be interpreted as hexStrings', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let bChat = await next(bob.k.$chat(chatId), 1)
  bChat.send('0123')

  const aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.messages[0].content, '0123')
  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.messages[0].content, '0123')
})
