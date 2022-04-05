const test = require('tape')
const { spawnSwarm, makeChat } = require('./test.helpers')
const {
  feedToGraph,
  scoreGraph,
  rewrite
} = require('../blockend/game')

test('Conversations can be described as glyphs using graph-rewriting', async t => {
  // Cold-talk: Hey -> Hello -> u guud? -> yes -> ok good -> yup -> bye -> bye.
  t.equal(rewrite('ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ'), 'ᛄᚵᛖᛗᛸ', 'advance')
  // GameOver: Wanna taste my tuna? -> Pass -> Pass -> Pass
  t.equal(rewrite('ᚲᛃᛖᚧᚦᚧ'), 'ᛄᛖᚷ', 'game over')
  // Evade: U like aliens? -> Mean the little gray men? -> What you mind if I'm short and have a few specks gray? -> PASS
  t.equal(rewrite('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᛒᛔ'), 'ᛄᚠᚠᛸ', 'evade')
  //
})

test('A chat can be reduced to points using graph rewriting', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  const cid = await makeChat(alice, bob)
  const chat = await alice.k.loadChat(cid)
  console.log(feedToGraph(chat))
  const chatAC = await makeChat(alice, charlie)
  t.ok(chatAC)
})

test.only('A conversation can be derived into scores 2 scores', async t => {
  let score = scoreGraph('ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ')
  t.deepEqual(score, [10, 7])

  score = scoreGraph('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᛒᛔ')
  t.deepEqual(score, [3, 9])

  score = scoreGraph('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᚦᚧ')
  t.deepEqual(score, [0, 0])
})
