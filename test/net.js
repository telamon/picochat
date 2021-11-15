const test = require('tape')
const { next } = require('../src/blockend/nuro')
const {
  // spawnSwarm,
  spawnPeer,
  makeMatch
} = require('./test.helpers')

test('Conversation recovers from disconnect', async t => {
  const { alice, bob, chatId, disconnect } = await makeMatch()
  const charlie = await spawnPeer('Charlie')

  let bChat = await next(bob.k.$chat(chatId), 0)
  await bChat.send('Hello')

  let aChat = await next(alice.k.$chat(chatId), 1)
  await aChat.send('Hi')

  bChat = await next(bob.k.$chat(chatId), 1)
  await bChat.send('Will you marry me?')

  aChat = await next(alice.k.$chat(chatId), 1)

  disconnect() // twist of fate

  await aChat.send('OMG!!!... OmG OMG OMG OMG.  YES!!!!!')

  aChat = await next(alice.k.$chat(chatId), 0)
  bChat = await next(bob.k.$chat(chatId), 0)
  t.equal(aChat.messages.length, 4, 'Alice has replied')
  t.equal(bChat.messages.length, 3, 'Bob can`t see alice`s reply')
  const latest = aChat.head
  t.notOk(bChat.head.equals(latest))

  // Charlie to the rescue
  const dcCA = charlie.spawnWire()(alice.spawnWire())
  const dcBC = bob.spawnWire()(charlie.spawnWire())

  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.messages.length, 4, 'Bob received alice`s reply through charlie')

  await bChat.send('Phew... You had me worried there, see you tomorrow?')

  aChat = await next(alice.k.$chat(chatId), 1)
  t.equal(aChat.messages.length, 5, 'messages are relayed')

  await aChat.send('Yup! <3<3<3')
  bChat = await next(bob.k.$chat(chatId), 1)
  t.equal(bChat.messages.length, 6, 'in both directions')

  await bChat.bye(2)
  aChat = await next(alice.k.$chat(chatId), 1)

  await aChat.bye(2)
  bChat = await next(bob.k.$chat(chatId), 1)
  // Charlie has done his deed and disconnects
  dcBC()
  dcCA()

  aChat = await next(alice.k.$chat(chatId), 0)
  t.equal(aChat.state, 'end')
  t.equal(bChat.state, 'end')
})
