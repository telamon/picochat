const test = require('tape')
const levelup = require('levelup')
const memdown = require('memdown')
const Kernel = require('../src/blockend/')
const makeDatabase = () => levelup(memdown())
const debug = require('debug')
debug.enable('pico*')

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
  // TODO:
  // - bob approaches alice by generating a new boxpair and sends the pk to alice
  // - alice accept the communication request by generating her own box-pair and sending the public key to bob.
  //   (a communcation request can be rejected by not replying)
  // - once box keys have been exchanged, two peers should be able to chat.
  // - if they choose so they can each other's identity-pk to the friends list pledging to long-term store
})

test('Send vibe to peer', async t => {
  // Spawn actors
  const alice = await spawnPeer('Alice')
  const bob = await spawnPeer('BoB')

  // Connect them
  bob.spawnWire({ client: true })(alice.spawnWire())

  // Await profiles to be exchanged
  const state = await nextState(bob.k.store, 'peers')
  const aliceProfile = Object.values(state).find(p => p.name === 'Alice')
  t.ok(Buffer.isBuffer(aliceProfile.pk))
  t.ok(Buffer.isBuffer(aliceProfile.box))

  // Bob approaches Alice causing a new chatId to be generated
  const chatId = await bob.k.sendVibe(aliceProfile.box)

  // Alice should have received a vibe
  let vibes = await nextState(alice.k.store, 'vibes')
  t.equal(vibes.received.length, 1)

  t.ok(bob.k.pk.equals(vibes.received[0].from))
  t.ok(Buffer.isBuffer(vibes.received[0].box))

  // Bob should see the sent vibe
  t.equal(bob.k.store.state.vibes.sent.length, 1)

  // Alice should see she has a potential match
  let vibe = null
  alice.k.vibes(vibes => {
    t.equal(vibes.length, 1)
    vibe = vibes[0]
  })()
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id))
  t.equal(vibe.state, 'waiting')

  // Alice sends response
  await alice.k.respondVibe(vibe.id, true)

  // Bob receives alice response
  vibes = await nextState(bob.k.store, 'vibes')
  t.equal(vibes.received.length, 1)

  vibe = null
  alice.k.vibes(vibes => {
    t.equal(vibes.length, 1)
    vibe = vibes[0]
  })()
  debugger
  t.ok(vibe)
  t.ok(chatId.equals(vibe.id))
  t.equal(vibe.state, 'match')
})

test.skip('Exchange profiles with friends')
test.skip('Should see friends messages')

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

function nextState (store, name) {
  let n = 1
  return new Promise(resolve => store.on(name, m => !n-- ? resolve(m) : null))
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
