const test = require('tape')
const { packGeo, unpackGeo, binstr, dGapEncode, gammaShift, decodeSL } = require('../blockend/bits')
const { prayFor, GEO_BITS } = require('../blockend/util')
const Keychain = require('../blockend/keychain')
const { makeDatabase } = require('./test.helpers')
/* What is crypto?
 * Cryptography consists of the following 3 beliefs:
 * - There is a short way to the secret.
 * - There is a long way to the secret.
 * - There is a Secret.
 *
 * Now begins the fun:
 * - The further away you are from the key to the short-way, the longer it becomes.
 * - The more travelers exploring the long-way the shorter it becomes.
 * - There is no way to prove that the Secret exists without revealing it, at which point it stops being one.
 */

test.only('Keychain is separate from kernel', async t => {
  const db = makeDatabase()
  const kc = new Keychain(db)
  const { sk } = Keychain.generate()
  t.notOk(await kc.readProfile())
  await kc.writeIdentity(sk)
  await kc.writeProfile({
    name: 'batman',
    age: 44, // to be removed in the block-spec
    tagline: 'Let me show you my gadgets',
    sex: 2,
    picture: Buffer.from('DEADBEEF', 'hex') // binary store webp/webm
  })
  const p = await kc.readProfile()
  t.equal(p.name, 'batman')
  t.equal(p.sex, 2)
  t.ok(p.picture.equals(Buffer.from('DEADBEEF', 'hex')))
})
test('Keychain stores identity', async t => {
  const db = makeDatabase()
  const kc = new Keychain(db)
  const { sk } = Keychain.generate()
  await kc.writeIdentity(sk)
  t.ok(sk.equals(await kc.readIdentity()))
})

test.skip('Keychain generates decodable pairs', async t => {
  const pair = Keychain.generate(1, 'u6282svsrwjd')
  if (pair) {
    const { pk, sk } = pair
    console.log('hail cosmos!', sk.toString('hex'))
    const { sex, geohash } = decodeSL(pk, GEO_BITS)
    t.equal(sex, 1)
    t.equal(geohash, 'u628') // given 17 bits
  }
  t.pass('WARN! Key not found, max attempts reached')
})

test('Geohash bitpacking', async t => {
  const geohash = 'u120fw'
  const n = packGeo(geohash)
  t.ok(Buffer.isBuffer(n))
  const o = unpackGeo(n)
  t.equal(o, 'u120')
  t.equal(unpackGeo(packGeo('u6282svsrwjd'), 17), 'u628')
})

test.skip('D-Gap/Gamma compression', async t => {
  const ghs = [
    'u120fw',
    'u6282svsrwjd' // 37 first bits of produces a dgap-map occupying 16bits
  ]
  for (const geohash of ghs) {
    const buf = packGeo(geohash)
    // Fooling around
    console.log('BUF', binstr(buf), 'bitsize', binstr(buf).length)
    const dgap = dGapEncode(buf)
    console.log('DGAP', dgap)
    // The gamma encoder dosen't work as expected atm.
    // not sure what the gain is for such small strings.
    const dgbin = [dgap.unshift()]
    for (const x of dgap) gammaShift(dgbin, x)
    console.log('DgapGamma', binstr(dgbin), 'bitsize', binstr(dgbin).length)
    debugger
  }
})

test.skip('Work Cap', async t => {
  const perf = global.performance
  const MA = 'markA'
  const MR = 'markRound'
  let found = 0
  perf.mark(MA)
  for (let i = 0; i < 10; i++) {
    perf.mark(MR)
    // prayFor(0xbabe)...
    const keys = prayFor(Buffer.from([0xba, 0xbe, 0xff]), 0b0011)
    perf.measure(`Round${i}`, MR)
    if (keys) {
      found++
      console.log(`Round${i} found: `, keys[0].hexSlice(), ' sk:', keys[1].hexSlice())
    } else {
      console.log(`Round${i} nothing found`)
    }
  }
  // perf.measure('Total:', MA)
  const entries = perf.getEntriesByType('measure')
  // console.log(entries)
  console.log(`Found (${found}/10)`)
  console.log('Avg search time:', entries.reduce((s, m) => s + m.duration, 0) / entries.length)
  perf.clearMarks()
  perf.clearMeasures()
  console.log('Searched ', MAX_SEARCH * 10, 'permutations')
  debugger
})
