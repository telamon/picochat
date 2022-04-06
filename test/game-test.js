const test = require('tape')
const { spawnSwarm, makeChat } = require('./test.helpers')
const { next } = require('../blockend/nuro')
const {
  feedToGraph,
  scoreGraph,
  rewrite
} = require('../blockend/game')

test('Conversations can be described as glyphs using graph-rewriting', async t => {
  // Cold-talk: Hey -> Hello -> u guud? -> yes -> ok good -> yup -> bye -> bye.
  t.equal(rewrite('ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ'), 'ᛄᚵᚴᛸ', 'advance')
  // GameOver: Wanna taste my tuna? -> Pass -> Pass -> Pass
  t.equal(rewrite('ᚲᛃᛖᚧᚦᚧ'), 'ᛄᛖᚷ', 'game over')
  // Evade: U like aliens? -> Mean the little gray men? -> What you mind if I'm short and have a few specks gray? -> PASS
  t.equal(rewrite('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᛒᛔ'), 'ᛄᚠᚠᛸ', 'evade')
  //
})

test('A chat can be reduced to points using graph rewriting', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  const cidAB = await makeChat(alice, bob)
  const chat = await alice.k.loadChat(cidAB)
  t.equal(rewrite(feedToGraph(chat)), 'ᛄᚵᚴᛸ')
  const scoreAB = scoreGraph(feedToGraph(chat))
  const cidAC = await makeChat(alice, charlie)
  const chatAC = await next(charlie.k.$chat(cidAC), 1)
  t.equal(rewrite(chatAC.graph), 'ᛄᚵᚴᛸ')

  const scoreAC = scoreGraph(chatAC.graph)

  const [aProfile, bProfile] = await next(charlie.k.$peers(), 0)
  const aScore = scoreAB[0] + scoreAC[0]
  const bScore = scoreAB[1]
  const cScore = scoreAC[1]

  t.equal(aProfile.score, aScore)
  t.equal(bProfile.score, bScore)

  const cProfile = await next(charlie.k.$profile(), 1)
  t.equal(cProfile.score, cScore)
})

test('A conversation can be derived into scores 2 scores', async t => {
  let score = scoreGraph('ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ')
  t.deepEqual(score, [11, 7])

  score = scoreGraph('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᛒᛔ')
  t.deepEqual(score, [3, 9])

  score = scoreGraph('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᚦᚧ')
  t.deepEqual(score, [0, 0])
})
