const test = require('tape')
const { next } = require('piconuro')
const {
  spawnSwarm,
  makeMatch,
  makeChat,
  sees
} = require('./test.helpers')

test('kernel.$cooldowns() keeps track of vibe counter', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  await sees(charlie, alice)
  let cd = await next(charlie.k.$cooldowns())
  t.equal(cd.vibe, 0)
  t.equal(cd.canVibe, true)

  // Charlie sends vibe to alice
  const v = (await charlie.k.sendVibe(alice.k.pk)).toString('hex')
  cd = await next(charlie.k.$cooldowns())
  t.equal(cd.canVibe, false)
  t.equal(
    cd.vibe,
    charlie.k.store.state.vibes.matches[v].expiresAt,
    'Charlie is stuck waiting'
  )
  // TODO: Alice politely rejects charlies vibe,
  // that should reduce the time of charlie's cooldown.
})

test('kernel.$cooldowns() emits on chat end', async t => {
  const [alice, bob] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  let cd = await next(bob.k.$cooldowns())
  t.equal(cd.canVibe, true, 'Bob can vibe')
  // const unsub = bob.k.$cooldowns()(console.error)
  const cid = await makeChat(bob, alice)
  const chat = await next(bob.k.$chat(cid))
  cd = await next(bob.k.$cooldowns())
  t.equal(chat.state, 'end', 'when chat ends')
  t.equal(cd.canVibe, true, 'Bob can vibe again')
  // unsub()
})

test('kernel.$cooldowns() active chat', async t => {
  const { alice, bob, chatId } = await makeMatch()
  let chat = await next(bob.k.$chat(chatId))
  await chat.send('Hey')
  const cd = await next(bob.k.$cooldowns())
  chat = await next(bob.k.$chat(chatId))
  t.equal(chat.myTurn, false)
  t.equal(cd.canVibe, false, 'Bob has an active chat, cannot vibe')
  t.equal(cd.vibe, chat.expiresAt)

  const acd = await next(alice.k.$cooldowns())
  t.equal(acd.canVibe, true, 'Alice vibe is unaffected')
  t.equal(acd.vibe, 0)
})
