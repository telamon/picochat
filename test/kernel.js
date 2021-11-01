const test = require('tape')
const levelup = require('levelup')
const memdown = require('memdown')
const Kernel = require('../src/blockend/')
const makeDatabase = () => levelup(memdown())
const debug = require('debug')
// debug.enable('pico*')

test('Create profile', async t => {
  const app = new Kernel(makeDatabase())
  const loggedIn = await app.load()
  t.equal(loggedIn, false, 'Not logged in on first run')

  // Create a new profile
  await app.register({
    name: 'Batman',
    tagline: 'I love driving around at night',
    age: 42,
    sex: 1
  })

  t.equal(app.profile.name, 'Batman', 'Correct username registered')
  t.equal(app.profile.tagline, 'I love driving around at night')
  t.equal(app.profile.age, 42)
  t.equal(app.profile.sex, 1)
  t.ok(app.profile.pk, 'Public key is exposed')
  t.end()
})

test('Enter pub see peers', async t => {
  const PUB = 'Abyss'
  const alice = new Kernel(makeDatabase())
  const bob = new Kernel(makeDatabase())
  await alice.load()
  await bob.load()
  await alice.register({ name: 'Amiss', tagline: 'yay', age: 24, sex: 0 })
  await bob.register({ name: 'Bobby', tagline: 'hey', age: 27, sex: 1 })
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

test('Kernel#getChat()', async t => {
  const { alice, bob, chatId } = await makeMatch()

  const aChat = await nextState(s => alice.k.getChat(chatId, s), 0)
  t.equal(aChat.myTurn, false)
  t.equal(aChat.state, 'active')
  t.ok(Array.isArray(aChat.messages))
  t.equal(typeof aChat.send, 'function')
  t.equal(typeof aChat.pass, 'function')
  t.equal(typeof aChat.bye, 'function')

  const bChat = await nextState(s => bob.k.getChat(chatId, s), 0)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.state, 'active')
})

test('Conversation: Hi! ... Hello', async t => {
  const { alice, bob, chatId } = await makeMatch()
  // Bob says Hi
  let bChat = await nextState(s => bob.k.getChat(chatId, s), 0)
  t.ok(bChat.myTurn)
  await bChat.send('Hi!') // Send the message
  bChat = await nextState(s => bob.k.getChat(chatId, s), 1)
  t.equal(bChat.myTurn, false, 'Nolonger bobs turn')
  t.equal(bChat.messages.length, 1, 'Message should be stored')
  t.equal(bChat.messages[0].type, 'sent')
  t.equal(bChat.messages[0].content, 'Hi!', 'Sent should be readable')

  // Alice reads
  let aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  t.equal(aChat.myTurn, true, 'Alice Turn')
  t.equal(aChat.messages.length, 1, 'Message should be received')
  t.equal(aChat.messages[0].type, 'received')
  t.equal(aChat.messages[0].content, 'Hi!', 'should be readable')

  // Alice replies
  await aChat.send('Hello~') // Send reply
  aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  t.equal(aChat.myTurn, false, 'Nolonger alice turn')
  t.equal(aChat.messages.length, 2, 'Message should be appended')

  // Bob recieves reply
  bChat = await nextState(s => bob.k.getChat(chatId, s), 2)
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

test('Conversation: Pass', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let bChat = await nextState(s => bob.k.getChat(chatId, s), 0)
  t.equal(bChat.myTurn, true)
  t.equal(bChat.health, 3)
  bChat.send('Hi')

  let aChat = await nextState(s => alice.k.getChat(chatId, s))
  t.equal(aChat.myTurn, true)
  aChat.send('Hello what')

  bChat = await nextState(s => bob.k.getChat(chatId, s), 2)
  t.equal(bChat.myTurn, true)
  bChat.send('SHOW ME THEM BAPS!!1!') // improper netiquette

  aChat = await nextState(s => alice.k.getChat(chatId, s), 2)
  t.equal(aChat.myTurn, true)
  await aChat.pass()

  bChat = await nextState(s => bob.k.getChat(chatId, s), 2)
  t.equal(bChat.health, 2) // oops bob oops </3
})

// Alice and Bob sits down at a table
async function makeMatch () {
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')
  bob.spawnWire({ client: true })(alice.spawnWire()) // connect peers
  await nextState(s => bob.k.store.on('peers', s)) // await profile exchange
  const chatId = await bob.k.sendVibe(alice.k.pk)
  await nextState(s => alice.k.vibes(s)) // await vibe recv
  await alice.k.respondVibe(chatId)
  await nextState(s => bob.k.vibes(s)) // await vibe resp
  return { alice, bob, chatId }
}

// Guy walks into a bar
async function spawnPeer (name) {
  const app = new Kernel(makeDatabase())
  await app.load()
  await app.register({
    name,
    tagline: `${name} is awesome!`,
    sex: Math.floor(Math.random() * 3), // \("v")/
    age: Math.floor(Math.random() * 18 + 50)
  })
  const spawnWire = await app.enter('Abyss')
  return {
    k: app,
    spawnWire
  }
}

function nextState (sub, n = 1) {
  let unsub = null
  return new Promise(resolve => {
    unsub = sub(m => !n-- ? resolve(m) : null)
  })
    .then(v => {
      unsub()
      return v
    })
}

// TODO: write mdbook "ES6: The Good Awesomesauce"
// chapter 1. (Don't) start what you can't finish
function get (store) {
  let value = null
  store(v => { value = v })()
  return value
}

/*
store.on('vibes', state => {
  const chats = []
  for (const a = state.sent) {
    state.received.find(b => l.chatId.equals(r.chatId)) && chats.push(chatId)
  }

})

const unsub = kernel.chats(chats => ...)
useSelector(
function select (selector: v => v) {
  let value = undefined
  return subFn => store.on(input = {
  })
}

*/
