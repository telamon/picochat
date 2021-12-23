// const { randomBytes } = require('crypto')

/*
 * const randomBytes = (n) => {
  const buf = new Uint8Array(n)
  window.crypto.getRandomValues(buf)
  return buf
} */
/*
function countLeadingZeroes (p, SIZE = DEF_SIZE) {
  let n = 0
  for (let i = 0; i < SIZE; i++) {
    let b = p[i]
    for (let j = 0; j < 8; j++) {
      if (b & 1) return n
      n++
      b >>= 1
    }
  }
}
*/

// Round bits upwards to closet byte
function roundByte (b) { return (b >> 3) + (b % 8 ? 1 : 0) }

/*
 * Treats buffer as a series of latched 8bit shift-registers
 * shifts all bits 1 step from low to high.
 *             _____________
 *   input -> | 0 1 0 1 1 1 | -> return overflow
 *             -------------
 *           Low            High
 */
function shift (x, inp = 0) {
  let c = inp ? 1 : 0
  for (let i = 0; i < x.length; i++) {
    const nc = (x[i] >> 7) & 1
    x[i] = (x[i] << 1) | c
    c = nc
  }
  return c
}

/*
 * Opposite of shift, shifts all bits
 * 1 step towards low.
 *              _____________
 *   output <- | 0 1 0 1 1 1 | <- input
 *              -------------
 *           Low            High
 */
function unshift (x, inp = 0) {
  let i = x.length
  let c = (inp ? 1 : 0) << 7
  while (i--) {
    const nc = (x[i] & 1) << 7
    x[i] = c | x[i] >> 1
    c = nc
  }
  return c ? 1 : 0
}
/*
function roll (bits) {
  const size = roundByte(bits)
  const o = randomBytes(size)
  const r = bits % 8 ? bits % 8 : 8
  o[size - 1] = o[size - 1] & // Fix last byte
    ((1 << r) - 1) | // Mask after LIFE marker
    (1 << (r - 1)) // Insert LIFE marker
  return o
}
*/

function countTrailingZeroes (x) {
  let i = x.length
  let n = 0 // vBits - (x.length << 3)
  while (i--) {
    for (let j = 7; j >= 0; j--) {
      if (x[i] & (1 << j)) return n
      n++
    }
  }
  return n
}

function countOnes (p) {
  let out = 0
  for (let i = 0; i < p.length; i++) {
    let b = p[i]
    while (b) {
      if (b & 1) out++
      b >>= 1
    }
  }
  return out
}

// Higher order function to align multiple registers
// and iterate the bits within the overlap.
//
//                  Operational zone
//     Start bit    _____
//               * | | | |
// A:    0 0 0 0 1 1 0 1 0 1 1
// B:        0 0 1 0 1 1 1 1 1 1 0
// C:      0 0 0 1 0 0 1 0
//       HI        ^            LOW
//            idx: 0 1 2 3
//
function mapOverlap (registers, process) {
  process = process || (() => {})
  const o = registers.map(() => 0)
  const found = registers.map(() => 0)
  const outputs = registers.map(() => 0)
  let sync = false
  const result = []
  let cancel = false
  while (!cancel) {
    for (let r = 0; r < registers.length; r++) {
      if (!sync && found[r]) continue // wait-state reached
      const reg = registers[r]
      const bitIdx = o[r]++
      const byteIdx = reg.length - 1 - (bitIdx >> 3)
      // return function as soon as first buffer end is reached.
      if (byteIdx < 0) return result

      const bit = (reg[byteIdx] >> (7 - (bitIdx % 8))) & 1
      if (!found[r]) {
        if (bit) found[r] = true
        continue
      }
      outputs[r] = bit
    }

    if (!sync) {
      sync = found.reduce((c, n) => c && n, true)
      continue
    }
    const z = process(outputs, () => { cancel = true })
    if (shift(result, z)) result[result.length] = 1
  }
  return result
}

function binstr (x, cap) {
  cap = cap || x.length * 8
  let str = ''
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < 8; j++) {
      if (cap === i * 8 + j) str += '|'
      str += x[i] & (1 << j) ? '1' : '0'
    }
  }
  return str
}

const GHSMAP = '0123456789bcdefghjkmnpqrstuvwxyz' // (geohash-specific) Base32 map
const GHSUNMAP = GHSMAP.split('').reduce((h, l, i) => { h[l] = i; return h }, {})
/**
 * Bitpacks a geohash string containing quintets to arbitrary bit-precision:
 *  'u120fw' <-- contains 6*5 bits accurate to ~1.2 Kilometers
 * Msb    LSB
 *  'u' being is the most significant coordinate,
 *  'w' is the least significant coordinate.
 *  References:
 *  Format specification:  https://en.m.wikipedia.org/wiki/Geohash
 *  Bitdepthchart: https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geohashes
 *
 */
function packGeo (str, nBits, buf) {
  if (!nBits) nBits = str.length * 5
  // if (nBits > 32) throw new Error('unsupported precision')
  if (nBits < 5) throw new Error('precision has to be at least 5')

  // const nQuints = (nBits >> 2) + (nBits % 5 ? 1 : 0)
  const nBytes = roundByte(nBits)
  // This is horribly inefficient and ugly but i'm tired. have mercy.
  if (!buf) buf = Buffer.alloc(nBytes)
  // buf[0] = 1
  const val = str
    .split('')
    .reverse()
    .reduce((sum, c, b) => sum + (GHSUNMAP[c] * (32 ** b)), 0)
  const bits = val.toString(2).slice(0, nBits).split('').reverse() // lsb
  for (const bit of bits) {
    shift(buf, bit === '0' ? 0 : 1) // msb
  }
  return buf
}

/**
 * Unpacks bitarray back into base32 string
 */
function unpackGeo (buf, nBits = 16) {
  const nBytes = roundByte(nBits)
  if (buf.length < nBytes) throw new Error('Buffer does not hold enough bits')
  const cpy = []
  for (let i = 0; i < nBytes; i++) cpy[i] = buf[i]
  let str = ''
  let tmp = 0
  for (let n = 0; n < nBits; n++) {
    const bit = unshift(cpy)
    tmp = tmp | bit << (4 - (n % 5))
    if (n && !(n % 5)) {
      str += GHSMAP.charAt(tmp)
      tmp = 0
    }
  }
  str += GHSMAP.charAt(tmp)
  return str
}

// Elias gamma encoding
// https://en.wikipedia.org/wiki/Elias_gamma_coding
// http://bitmagic.io/dGap-gamma.html
function gammaShift (buf, x) {
  // x++ // 0support
  const N = Math.ceil(Math.log2(x))
  for (let n = 0; n < N; n++) unshift(buf, 0)
  unshift(buf, 1)
  for (let n = 0; n < N; n++) unshift(buf, (x >> n) & 1)
}

function gammaUnshift (buf) {
  let N = 0
  const cap = buf.length * 8
  for (; N < cap; N++) {
    const b = unshift(buf)
    if (b) break
    if (N === cap - 1 && !b) throw new Error('NBitNotFound: end of buffer reached')
  }
  let x = 1 << N
  while (N--) x = x | (unshift(buf) << N)
  return x
  // return --x // 0support
}

function bitAt (buf, idx) {
  return (buf[idx >> 3] >> (idx % 8)) & 1
}

function dGapEncode (buf, cap) {
  if (!cap) cap = buf.length * 8
  const out = [bitAt(buf, 0)]
  let n = 0
  let seek = out[0]
  let i = 0
  while (i < cap) {
    const b = bitAt(buf, i)
    if (b !== seek) {
      seek = b
      out.push(n)
      n = 0
    } n++
    i++
  }
  out.push(n)
  return out
}

function decodeSL (buf, geoPrecision = 16) {
  const nBits = geoPrecision + 1
  const tmp = []
  for (let i = 0; i < roundByte(nBits); i++) tmp[i] = buf[i]
  const sex = unshift(tmp) // (unshift(tmp) << 1) | unshift(tmp)
  const geohash = unpackGeo(tmp, geoPrecision)
  return { sex, geohash }
}

// Exports
module.exports = {
  // functions
  binstr,
  roundByte,
  shift,
  unshift,
  countTrailingZeroes,
  countOnes,
  mapOverlap,
  packGeo,
  unpackGeo,
  gammaShift,
  gammaUnshift,
  dGapEncode,
  decodeSL
}
