const test = require('tape')
const { next } = require('../src/blockend/nuro')
const {
  // spawnSwarm,
  spawnPeer,
  makeMatch
} = require('./test.helpers')

require('piconet').V = 0

test('Conversation recovers from disconnect', async t => {
  const { alice, bob, chatId, disconnect } = await makeMatch()
  const charlie = await spawnPeer('Charlie')

  let bChat = await next(bob.k.$chat(chatId), 0)
  await bChat.send('Hello')

  let aChat = await next(alice.k.$chat(chatId), 2)
  await aChat.send('Hi')

  bChat = await next(bob.k.$chat(chatId), 2)
  await bChat.send('Will you marry me?')

  aChat = await next(alice.k.$chat(chatId), 2)
  await disconnect() // twist of fate

  await aChat.send('OMG!!!... OmG OMG OMG OMG.  YES!!!!!')

  aChat = await next(alice.k.$chat(chatId), 1)
  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(aChat.messages.length, 4, 'Alice has replied')
  t.equal(bChat.messages.length, 3, 'Bob can`t see alice`s reply')
  const latest = aChat.head
  t.notOk(bChat.head.equals(latest))

  // Charlie to the rescue
  const dcCA = charlie.spawnWire().open(alice.spawnWire())
  const dcBC = bob.spawnWire().open(charlie.spawnWire())

  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.messages.length, 4, 'Bob received alice`s reply through charlie')

  await bChat.send('Phew... You had me worried there, see you tomorrow?')

  aChat = await next(alice.k.$chat(chatId), 2)
  t.equal(aChat.messages.length, 5, 'messages are relayed')

  await aChat.send('Yup! <3<3<3')
  bChat = await next(bob.k.$chat(chatId), 2)
  t.equal(bChat.messages.length, 6, 'in both directions')

  await bChat.bye(2)
  aChat = await next(alice.k.$chat(chatId), 2)

  await aChat.bye(2)
  bChat = await next(bob.k.$chat(chatId), 2)
  // Charlie has done his deed and disconnects
  dcBC()
  dcCA()

  aChat = await next(alice.k.$chat(chatId), 1)
  t.equal(aChat.state, 'end')
  t.equal(bChat.state, 'end')
})

test('Prevent duplicate peer connections', async t => {
  const { alice, bob, disconnect } = await makeMatch()
  let ac = await next(alice.k.$connections(), 0)
  t.equal(ac.length, 1, 'Alice has 1 connection')
  // WebRTC dosen't support peer-deduping.
  alice.spawnWire({ client: true }).open(bob.spawnWire())
  bob.spawnWire({ client: true }).open(alice.spawnWire())
  ac = await next(alice.k.$connections(), 2)
  t.equal(ac.length, 1, 'redundant connections were dropped')
  disconnect()
  ac = await next(alice.k.$connections(), 1)
  t.equal(ac.length, 0, 'all connections dropped')
  alice.spawnWire({ client: true }).open(bob.spawnWire())
  ac = await next(alice.k.$connections(), 1)
  t.equal(ac.length, 1, 'Bob and alice reconnected')
})
