const test = require('tape')
const { nextState } = require('../src/blockend/nuro')
const {
  spawnSwarm,
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

test('Successful conversation should add time', async t => {
  const { alice, bob, chatId } = await makeMatch()
  const d1 = await nextState(s => bob.k.getProfile(s), 0)

  let bChat = await nextState(s => bob.k.getChat(chatId, s), 0)
  await bChat.send('Hello')

  let aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  await aChat.send('Hi')

  bChat = await nextState(s => bob.k.getChat(chatId, s), 1)
  await bChat.send('Do you like cats?')

  aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  await aChat.send('Yes but i`m a dog person')

  bChat = await nextState(s => bob.k.getChat(chatId, s), 1)
  await bChat.send('I`m sorry but i`m looking for someone else')

  aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  await aChat.send('Why????? I`m cute and I smell nice!')

  bChat = await nextState(s => bob.k.getChat(chatId, s), 1)
  await bChat.bye(0)

  aChat = await nextState(s => alice.k.getChat(chatId, s), 1)
  await aChat.bye(2)

  const d2 = await nextState(s => bob.k.getProfile(s))
  t.equal(d2.expiresAt - d1.expiresAt, 7 * 60 * 1000)
})
