const test = require('tape')
const { nextState } = require('../src/blockend/nuro')
const Kernel = require('../src/blockend/')
const {
  makeDatabase,
  spawnPeer,
  makeMatch
} = require('./test.helpers')

test('Enter pub see peers', async t => {
  const PUB = 'Abyss'
  const alice = new Kernel(makeDatabase())
  const bob = new Kernel(makeDatabase())
  await alice.load()
  await bob.load()
  await alice.register({ name: 'Amiss', tagline: 'yay', age: 24, sex: 0, picture: 'a' })
  await bob.register({ name: 'Bobby', tagline: 'hey', age: 27, sex: 1, picture: 'b' })
  // Upon entering same bar/topic
  const spawnWireA = await alice.enter(PUB)
  const spawnWireB = await bob.enter(PUB)

  // Attach store observer
  const observer = new Promise((resolve, reject) => {
    let nRuns = 0
    alice.store.on('peers', state => {
      if (!nRuns++) return
      // Their profiles should end up in the dynamic/disposable bar store.
      const profiles = Object.values(state)
      t.equal(profiles.length, 2)
      t.ok(profiles.find(p => p.name === 'Bobby'))
      resolve()
    })
  })
  const b = spawnWireB()
  spawnWireA({ client: true })(b)
  await observer
  t.end()
})

test('Send vibe to peer', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  // Connect them
  bob.spawnWire({ client: true })(alice.spawnWire())

  // Await profiles to be exchanged
  const state = await nextState(s => bob.k.store.on('peers', s))
  const aliceProfile = Object.values(state).find(p => p.name === 'Alice')
  t.ok(Buffer.isBuffer(aliceProfile.pk))
  t.ok(Buffer.isBuffer(aliceProfile.box))

  // Bob approaches Alice causing a new chatId to be generated
  const chatId = await bob.k.sendVibe(aliceProfile.pk)

  // Alice should have received a vibe (inspect lowlevel registers)
  let vibes = await nextState(s => alice.k.store.on('vibes', s))
  t.equal(vibes.own.length, 1)
  const match = vibes.matches[vibes.own[0].toString('hex')]

  t.ok(bob.k.pk.equals(match.a))
  t.ok(Buffer.isBuffer(match.remoteBox))

  // Bob should see the sent vibe
  vibes = await nextState(s => bob.k.vibes(s), 0)
  t.equal(vibes.length, 1)
  let vibe = vibes[0]
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id))
  t.equal(vibe.state, 'waiting_remote')
  t.equal(vibe.peer.name, 'Alice')

  // Alice should see she has a potential match
  alice.k.vibes(vibes => {
    t.equal(vibes.length, 1)
    vibe = vibes[0]
  })()

  vibes = await nextState(s => alice.k.vibes(s), 0)
  t.equal(vibes.length, 1)
  vibe = vibes[0]
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id))

  t.equal(vibe.state, 'waiting_local')
  t.equal(vibe.peer.name, 'BoB')

  // Alice sends response
  await alice.k.respondVibe(vibe.id, true)
  await nextState(s => bob.k.store.on('vibes', s)) // Wait for response to transfer

  vibe = (await nextState(s => alice.k.vibes(s), 0))[0]
  t.ok(vibe)
  t.equal(vibe.state, 'match') // <3

  // Bob receives alice response
  vibe = (await nextState(s => bob.k.vibes(s), 0))[0]
  t.ok(vibe)
  t.equal(vibe.state, 'match') // <3
  t.end()
})

test('Vibe rejected by remote', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  bob.spawnWire({ client: true })(alice.spawnWire()) // connect peers

  await nextState(s => bob.k.store.on('peers', s)) // await profile exchange

  const chatId = await bob.k.sendVibe(alice.k.pk)
  await nextState(s => alice.k.vibes(s)) // await vibe recv

  await alice.k.respondVibe(chatId, false)

  const vibe = (await nextState(s => bob.k.vibes(s)))[0] // await vibe resp
  t.equal(vibe.state, 'rejected')
  t.end()
})

test('First notify after block-creation should contain peer', async t => {
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')
  bob.spawnWire({ client: true })(alice.spawnWire()) // connect peers
  await nextState(s => bob.k.store.on('peers', s)) // await profile exchange
  const p = new Promise((resolve, reject) => {
    let n = 0
    const unsub = bob.k.vibes(vibes => {
      if (!n++) t.equal(vibes.length, 0)
      else {
        t.equal(vibes.length, 1)
        t.ok(vibes[0].peer)
        unsub()
        resolve()
      }
    })
  })
  await bob.k.sendVibe(alice.k.pk)
  await p
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

  const aChat = await nextState(alice.k.$chat(chatId), 0)
  t.equal(aChat.myTurn, false)
  t.equal(aChat.state, 'active')
  t.ok(Array.isArray(aChat.messages))
  t.equal(typeof aChat.send, 'function')
  t.equal(typeof aChat.pass, 'function')
  t.equal(typeof aChat.bye, 'function')

  const bChat = await nextState(bob.k.$chat(chatId), 0)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.state, 'active')
})

test('Conversation: Hi! ... Hello', async t => {
  const { alice, bob, chatId } = await makeMatch()
  // Bob says Hi
  let bChat = await nextState(bob.k.$chat(chatId), 0)
  t.ok(bChat.myTurn)
  await bChat.send('Hi!') // Send the message
  bChat = await nextState(bob.k.$chat(chatId), 0)
  t.equal(bChat.myTurn, false, 'Nolonger bobs turn')
  t.equal(bChat.messages.length, 1, 'Message should be stored')
  t.equal(bChat.messages[0].type, 'sent')
  t.equal(bChat.messages[0].content, 'Hi!', 'Sent should be readable')

  // Alice reads
  let aChat = await nextState(alice.k.$chat(chatId), 1)
  t.equal(aChat.myTurn, true, 'Alice Turn')
  t.equal(aChat.messages.length, 1, 'Message should be received')
  t.equal(aChat.messages[0].type, 'received')
  t.equal(aChat.messages[0].content, 'Hi!', 'should be readable')

  // Alice replies
  await aChat.send('Hello~') // Send reply
  aChat = await nextState(alice.k.$chat(chatId), 0)
  t.equal(aChat.myTurn, false, 'Nolonger alice turn')
  t.equal(aChat.messages.length, 2, 'Message should be appended')

  // Bob recieves reply
  bChat = await nextState(bob.k.$chat(chatId), 1)
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
  let bChat = await nextState(bob.k.$chat(chatId), 0)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 3)
  bChat.send('Hi')

  let aChat = await nextState(alice.k.$chat(chatId))
  t.equal(aChat.myTurn, true)
  await aChat.send('Hello what')

  bChat = await nextState(bob.k.$chat(chatId), 1)
  t.equal(bChat.myTurn, true)
  await bChat.send('SHOW ME THEM BAPS!!1!') // improper netiquette

  aChat = await nextState(alice.k.$chat(chatId), 1)
  t.equal(aChat.myTurn, true)
  await aChat.pass()

  bChat = await nextState(bob.k.$chat(chatId), 1)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 2) // first hit
  await bChat.send('Y U NO SHAW THEM???') // Recovers 0.3

  aChat = await nextState(alice.k.$chat(chatId), 1)
  t.equal(aChat.myTurn, true)
  await aChat.pass()

  bChat = await nextState(bob.k.$chat(chatId), 1)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 1)

  await bChat.pass() // bob gives up, conversation exhausted

  bChat = await nextState(bob.k.$chat(chatId), 0)
  t.equal(bChat.health, 0)

  aChat = await nextState(alice.k.$chat(chatId), 1)
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

test('Vibe receiver should not have double vibes', async t => {
  const { alice, bob } = await makeMatch()
  await new Promise(resolve => {
    let p = 1
    alice.k.vibes(vibes => {
      t.equal(vibes.length, 1, 'Alice has 1 vibe')
      if (!p--) resolve()
    })
    bob.k.vibes(vibes => {
      t.equal(vibes.length, 1, 'Bob has 1 vibe')
      if (!p--) resolve()
    })
  })
  t.end()
})

test.only('Conversation: win-win', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let bChat = await nextState(bob.k.$chat(chatId), 0)
  bChat.send('Hi')

  let aChat = await nextState(alice.k.$chat(chatId))

  await aChat.send('hi')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('Nice profile pic') // Master pickup artist

  aChat = await nextState(alice.k.$chat(chatId))
  await aChat.send('Thx :>')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('Is that a snake? 🤨')

  aChat = await nextState(alice.k.$chat(chatId))
  await aChat.send('What? No, It`s a bracelet!!')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('Whoa that`s rad!')

  aChat = await nextState(alice.k.$chat(chatId))
  // mental-note: messages should be buffered with a 1-3sec delay, if user is still typing
  // then give them a chance to finish writing the next paragraph before commiting the block.
  // paragrafs should be embedded in the content as usual but visually represented as different messages.
  // - sometimes people burst into talkativity, they should be given a chance to speak their mind during the turn.
  await aChat.send('I know right?!\nBirthday present from mom\nI use it almost every day!')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('So your mom`s into snakes?')

  aChat = await nextState(alice.k.$chat(chatId))
  await aChat.send('Naw.. but I actually have a live one')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('No way? What do you feed it with')

  aChat = await nextState(alice.k.$chat(chatId))
  await aChat.send('You don`t wanna know...')

  bChat = await nextState(bob.k.$chat(chatId))
  await bChat.send('then tell me next time <3, was really cool talking to you')

  aChat = await nextState(alice.k.$chat(chatId))
  await aChat.bye(2) // Alice hangs up
  aChat = await nextState(alice.k.$chat(chatId), 0)
  t.equal(aChat.myTurn, false)

  bChat = await nextState(bob.k.$chat(chatId))
  t.equal(bChat.state, 'finalizing')
  t.equal(bChat.myTurn, true)
  await bChat.bye(2) // Bob hangs up

  // Both are at state end
  aChat = await nextState(alice.k.$chat(chatId))
  t.equal(aChat.state, 'end')
  t.equal(aChat.myTurn, false)

  bChat = await nextState(bob.k.$chat(chatId), 0)
  t.equal(bChat.state, 'end')
  t.equal(bChat.myTurn, false)
  t.end()
})
