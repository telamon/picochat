/**
 * What is the meaning of Silence?
 *
  |---+------------+----+----+-------------------------|
  |   | Name       | W  | B  | Note                    |
  |---+------------+----+----+-------------------------|
  |   | TIER 0     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚹ | Profile    |    |    |                         |
  | ᚲ | Vibe       |    |    |                         |
  | ᛃ | VibeResp   |    |    |                         |
  | ᛖ | W Msg      | +1 | +0 |                         |
  | ᛗ | B Msg      | +0 | +1 |                         |
  | ᚦ | W Pass     |    |    |                         |
  | ᚧ | B Pass     |    |    |                         |
  | ᛒ | W End      |    |    |                         |
  | ᛔ | B End      |    |    |                         |
  |---+------------+----+----+-------------------------|
  |   | TIER 1     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᛄ | Lock/start |    |    | ᚲᛃ                      |
  | ᚷ | GameOver   |    |    | ᚦᚧᚦ, ᚧᚦᚧ                |
  | ᚴ | W Advance  | +2 | +1 | ᛖᛗ                      |
  | ᛐ | B Advance  | +1 | +2 | ᛗᛖ                      |
  | ᚵ | W Combo    | +4 | +3 | ᚴᚴ                      |
  | ᛑ | B Combo    | +3 | +4 | ᛐᛐ                      |
  | ᛸ | W Unlock   | +5 | +3 | ᛒᛔ                      |
  | ᛷ | B Unlock   | +2 | +4 | ᛔᛒ                      |
  | ᛆ | Miss       | -1 | +2 | ᛖᚧ                      |
  |---+------------+----+----+-------------------------|
  |   | TIER 2     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚺ | Engarde    |    |    | ᚧᚦ,ᚦᚧ                   |
  | ᚠ | Evade      | -1 | +3 | ᚴᛆ                      |
  | ᛅ | Riposte    | +2 | +4 | ᚴᚦᛗ                     |
  | ᛰ | Block      | +1 | +3 | ᚴᚺ, White is vulnerable |
  | ᛈ | F.O.P      |    |    | ᚴᛖᛷ                     |
  |---+------------+----+----+-------------------------|
  |   | TIER 3     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚸ | TKO        |    |    | ᚠᚠᛷ                     |
  |
 */

const {
  typeOfBlock,
  TYPE_PROFILE,
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  VIBE_REJECTED,
  PASS_TURN,
  PEACE,
  LOVE,
  UNDERSTANDING,
  decodeBlock
} = require('./util')

function feedToGraph (f) {
  let graph = ''
  let wk = f.first.isGenesis ? f.first.key : null
  for (const block of f.blocks()) {
    // White is the initiator, they who sent the vibe.
    if (typeOfBlock(block.body) === TYPE_VIBE && !wk) wk = block.key
    const white = wk && block.key.equals(wk)
    graph += blockToGlyph(block, white)
  }
  return graph
}

function blockToGlyph (block, white = true) {
  switch (typeOfBlock(block.body)) {
    case TYPE_PROFILE:
      return 'ᚹ'
    case TYPE_VIBE:
      return 'ᚲ'
    case TYPE_VIBE_RESP: {
      const r = VIBE_REJECTED.equals(decodeBlock(block.body).box)
      return r ? 'ᛟ' : 'ᛃ'
    }
    case TYPE_MESSAGE: {
      const p = PASS_TURN.equals(decodeBlock(block.body).content)
      return p
        ? white ? 'ᚦ' : 'ᚧ'
        : white ? 'ᛖ' : 'ᛗ'
    }
    case TYPE_BYE:
    case TYPE_BYE_RESP: {
      const plu = []
      plu[PEACE] = 'ᛣ'
      plu[LOVE] = 'ᛜ'
      plu[UNDERSTANDING] = 'ᛯ'
      // TODO: Think this through
      return (white ? 'ᛒ' : 'ᛔ') // + plu[decodeBlock(block.body).gesture]
    }
  }
}

function scoreGraph (input) {
  input = rewrite(input)
  if (/ᚷ/.test(input)) return [0, 0]

  const table = {
    ᛄ: [0, 0],
    ᛖ: [1, 0],
    ᛗ: [0, 1],
    ᛸ: [5, 3],
    ᛷ: [2, 4],
    ᚴ: [2, 1],
    ᛐ: [0, 2],
    ᚵ: [4, 3],
    ᛑ: [2, 4],
    ᛆ: [-1, 2],
    ᚠ: [-1, +3],
    ᛅ: [2, 4],
    ᛰ: [1, 3],
    ᛈ: [-1, 0]
  }

  let w = 0
  let b = 0
  for (const glyph of input.split('')) {
    if (!table[glyph]) {
      console.warn('Unscored glyph: ', glyph)
      continue
    }
    w += table[glyph][0]
    b += table[glyph][1]
  }
  console.log('Game:', input, `score W${w}/B${b}`)
  return [w, b]
}

function rewrite (input) {
  const rules = [
    // Tier 1
    [/ᚲᛃ/, 'ᛄ'], // Lock
    [/(ᚦᚧᚦ|ᚧᚦᚧ)/, 'ᚷ'], // Game over
    [/([ᛄᚴᚵᛆᚠ])ᛖᛗ/, '$1ᚴ'], // white advance
    [/([ᛰᛐᛑᛅ])ᛗᛖ/, '$1ᛐ'], // black advance
    [/ᚴᚴ/, 'ᚵ'], // WCombo
    [/ᛐᛐ/, 'ᛑ'], // BCombo
    [/ᛒᛔ/, 'ᛸ'], // Unlock WB
    [/ᛔᛒ/, 'ᛷ'], // Unlock BW
    [/ᛖᚧ/, 'ᛆ'], // Miss

    // Tier 2
    [/(ᚦᚧ|ᚧᚦ)/, 'ᚺ'], // Engarde
    [/ᚴᛆ/, 'ᚠ'], // Evade
    [/ᚴᚦᛗ/, 'ᛅ'], // Reposte
    [/ᚵᚦᛗ/, 'ᚯ'], // Brutal reposte
    [/ᚴᚺ/, 'ᛰ'], // Block, reversal.

    // Tier 3
    [/ᛆᚦ/, 'ᚢ'], // W Retreat.
    [/ᛆᛆᚦᛷ/, 'ᚤᛷ'], // KO, w surrender.
    [/ᚴᛖᛷ/, 'ᛈ'], // FOP, w defeat.
    [/ᚠᚠᛷ/, 'ᚸᛷ'] // TKO, w defeat.
  ]
  let prev = null
  while (prev !== input) {
    prev = input
    for (const [p, r] of rules) input = input.replace(p, r)
  }
  return input
}

module.exports = {
  feedToGraph,
  scoreGraph,
  blockToGlyph,
  rewrite
}

// Operates on arrays of tokens, if tokens in pattern are contained by
// tokens in input, then they are replaced with tokens in replacement.
// If pattern is not contained by input, then unmodified input is returned.
function uRewrite (input, pattern, replacement) {
  if (typeof input === 'string') input = input.split('')
  if (typeof pattern === 'string') pattern = pattern.split('')
  const pool = [...input]

  for (const chr of pattern) {
    const idx = pool.findIndex((elem, n) =>
      (chr instanceof RegExp) ? elem.match(chr) : chr === elem
    )
    if (!~idx) return input // idx: -1, no match; return original input
    else pool.splice(idx, 1) // remove match from pool and continue to next token
  }
  if (!Array.isArray(replacement)) replacement = [replacement]
  return [...pool, ...replacement]
}

// Recursivly rewrites an array with rules until it stops changing.
function uEvolve (mem, rules) {
  if (typeof mem === 'string') mem = mem.split('')
  let n = 0
  let prev = null
  do {
    prev = mem
    for (const rule of rules) mem = uRewrite(mem, rule[0], rule[1])
    if (mem.join() === prev.join()) n++
  } while (n < 2)
  return mem
}

// Don't know what it's supposed to do.
function uRegrow (mem, rules) {
  return mem.reduce((buf, elem) => {
    return uEvolve([...buf, elem], rules)
  })
}
