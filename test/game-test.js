const test = require('tape')
const { spawnSwarm, makeChat } = require('./test.helpers')
const {
  feedToGraph,
  scoreGraph,
  rewrite
} = require('../blockend/game')

test.only('Conversations can be described as glyphs using graph-rewriting', async t => {
  // Hey, Hello, u guud?, yes, ok good, yup, bye, bye.
  t.equal(rewrite('ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ'), 'ᛄᚵᛖᛗᛸ', 'advance')
  // Wanna taste my tuna? -> Pass -> Pass -> Pass
  t.equal(rewrite('ᚲᛃᛖᚧᚦᚧ'), 'ᛄᛖᚷ', 'game over')

  t.equal(rewrite('ᚲᛃᛖᛗᛖᚧᛖᛗᛖᚧᛒᛔ'), 'ᛄᚠᚠᛸ', 'evade')

})

test('A chat can be reduced to points using graph rewriting', async t => {
  const [alice, bob, charlie] = await spawnSwarm('Alice', 'Bob', 'Charlie')
  const cid = await makeChat(alice, bob)
  const chat = await alice.k.loadChat(cid)
  console.log(feedToGraph(chat))
  const chatAC = await makeChat(alice, charlie)
  t.ok(chatAC)
})

test('A conversation can be derived into scores 2 scores', async t => {
  const convo = 'ᚲᛃᛖᛗᛖᛗᛖᛗᛒᛔ'
  const [w, b] = scoreGraph(convo)
  console.log('White: ', w, ' Black: ', b)
  // t.equal(w, 3 + 5)
  // t.equal(b, 3 + 3)
})
