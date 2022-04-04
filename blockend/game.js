/**
 * What is the meaning of Silence?
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
  decodeBlock
} = require('./util')

function feedToGraph (f) {
  let graph = ''
  let w = f.first.isGenesis ? f.first.key : null
  for (const block of f.blocks()) {
    const foreign = w && !block.key.equals(w)
    switch (typeOfBlock(block.body)) {
      case TYPE_PROFILE:
        graph += 'ᚹ'
        break
      case TYPE_VIBE:
        if (!w) w = block.key
        graph += 'ᚲ'
        break
      case TYPE_VIBE_RESP: {
        const r = VIBE_REJECTED.equals(decodeBlock(block.body).box)
        graph += r ? 'ᛟ' : 'ᛃ'
      } break
      case TYPE_MESSAGE: {
        const p = PASS_TURN.equals(decodeBlock(block.body).content)
        graph += p
          ? foreign ? 'ᚧ' : 'ᚦ' // 'ᚤ' : 'ᚢ'
          : foreign ? 'ᛗ' : 'ᛖ'
      } break

      case TYPE_BYE:
      case TYPE_BYE_RESP:
        graph += foreign ? 'ᛔ' : 'ᛒ'
        break
    }
  }
  return graph
}
/**
 *
  |---+------------+----+----+-------------------------|
  |   | Name       | W  | B  | Note                    |
  |---+------------+----+----+-------------------------|
  |   | TIER 0     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚹ | Profile    |    |    |                         |
  | ᚲ | Vibe       |    |    |                         |
  | ᛃ | VibeResp   |    |    |                         |
  | ᛖ | W Msg      |    |    |                         |
  | ᛗ | B Msg      |    |    |                         |
  | ᚦ | W Pass     |    |    |                         |
  | ᚧ | B Pass     |    |    |                         |
  | ᛒ | W End      |    |    |                         |
  | ᛔ | B End      |    |    |                         |
  |---+------------+----+----+-------------------------|
  |   | TIER 1     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᛄ | Lock/start |    |    | ᚲᛃ                      |
  | ᚷ | GameOver   |    |    | ᚦᚧᚦ, ᚧᚦᚧ                |
  | ᚴ | W Advance  |    |    | ᛖᛗ                      |
  | ᛐ | B Advance  |    |    | ᛗᛖ                      |
  | ᚵ | W Combo    |    |    | ᚴᚴ                      |
  | ᛑ | B Combo    |    |    | ᛐᛐ                      |
  | ᛸ | W Unlock   |    |    | ᛒᛔ                      |
  | ᛷ | B Unlock   |    |    | ᛔᛒ                      |
  | ᛆ | Miss       | -1 | +2 | ᛖᚧ                      |
  |---+------------+----+----+-------------------------|
  |   | TIER 2     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚺ | Engarde    |    |    | ᚧᚦ,ᚦᚧ                   |
  | ᚠ | Evade      | -1 | +3 | ᚴᛆ                      |
  | ᛅ | Reposte    | +2 | +4 | ᚴᚦᛗ                     |
  | ᛰ | Block      | +1 | +3 | ᚴᚺ, White is vulnerable |
  | ᛈ | F.O.P      |    |    | ᚴᛖᛷ                     |
  |---+------------+----+----+-------------------------|
  |   | TIER 3     |    |    |                         |
  |---+------------+----+----+-------------------------|
  | ᚸ | TKO        |    |    | ᚠᚠᛷ                     |
  |
 */

function scoreGraph (input) {
  return [0, 0]
}

function rewrite (input) {
  const rules = [
    // Tier 1
    [/ᚲᛃ/, 'ᛄ'], // Lock
    [/(ᚦᚧᚦ|ᚧᚦᚧ)/, 'ᚷ'], // Game over
    [/([ᛄᚴᚠ])ᛖᛗ/, '$1ᚴ'], // white advance
    [/([ᛰᛐᛅ])ᛗᛖ/, '$1ᛐ'], // black advance
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
    [/ᛆᛆᚦᛷ/, 'ᚤ'], // KO, w surrender.
    [/ᚴᛖᛷ/, 'ᛈ'], // FOP, w defeat.
    [/ᚠᚠᛷ/, 'ᚸ'] // TKO, w defeat.
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
