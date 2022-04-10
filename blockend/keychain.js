/* eslint-disable camelcase */
const {
  crypto_sign_SECRETKEYBYTES: SIGN_SKBYTES,
  crypto_sign_PUBLICKEYBYTES: SIGN_PKBYTES,
  crypto_sign_keypair
} = require('sodium-universal')
/* eslint-enable camelcase */
const { packGeo, shift, binstr, roundByte, decodeSL } = require('./bits')
const { GEO_BITS } = require('./util')
const { pack, unpack } = require('msgpackr')
const DEFAULT_SIGN = 'default_signpair'
const DEFAULT_PROFILE = 'default_profile'

class Keychain {
  constructor (db) {
    this.db = db
  }

  /*
   * TODO:
   * async addFriend (alias, pk)
   * async removeFriend (alias)
   * async listFriends ()
   */

  async readIdentity (alias = DEFAULT_SIGN) {
    return this.db.get(alias)
      .catch(err => {
        if (!err.notFound) throw err
      })
  }

  async writeIdentity (sk, alias = DEFAULT_SIGN) {
    if (!Buffer.isBuffer(sk) || sk.length !== SIGN_SKBYTES) throw new Error('Expected SigningSecret')
    return this.db.put(alias, sk)
  }

  async writeProfile (profile, alias = DEFAULT_PROFILE) {
    return this.db.put(alias, pack(profile))
  }

  async readProfile (alias = DEFAULT_PROFILE) {
    const p = await this.db.get(alias)
      .catch(err => {
        if (!err.notFound) throw err
      })
    if (p) return unpack(p)
  }

  static generateAnonymous () {
    const sk = Buffer.allocUnsafe(SIGN_SKBYTES)
    const pk = Buffer.allocUnsafe(SIGN_PKBYTES)
    crypto_sign_keypair(pk, sk)
    return { pk, sk }
  }

  static generate (gender, geohash, maxTries) {
    console.info('generate(', gender, geohash, maxTries, ')')
    gender = gender ?? 666
    if (gender === 666 && !geohash) return Keychain.generateAnonymous()
    if (!geohash) return prayFor(Buffer.from([gender]), 0b11, maxTries)

    const nBits = GEO_BITS + 1
    const buf = Buffer.allocUnsafe(roundByte(nBits))
    const prefix = packGeo(geohash, GEO_BITS, buf)
    shift(prefix, gender & 1)
    // shift(prefix, (gender >> 1) & 1) // TODO: Move this flag to profile block?
    const mask = nBits % 8
      ? (1 << (nBits % 8)) - 1
      : 0xff
    console.info('Searching for', nBits, prefix.toString('hex'), binstr(prefix).length, 'mask', mask.toString(2))
    return prayFor(prefix, mask, maxTries)
  }

  static decodePk (pk) {
    return decodeSL(pk, GEO_BITS)
  }
}

const MAX_SEARCH = 500000 // ~10second on my laptop
function prayFor (b, mask = 0xff, max = MAX_SEARCH) {
  if (!Buffer.isBuffer(b) && !Array.isArray(b)) throw new Error('Array or Buffer Expected')
  const pk = Buffer.allocUnsafe(SIGN_PKBYTES)
  const sk = Buffer.allocUnsafe(SIGN_SKBYTES)
  const nBytes = b.length

  for (let i = 0; i < max; i++) {
    crypto_sign_keypair(pk, sk)
    let v = true
    for (let n = 0; v && n < nBytes; n++) {
      v = (n + 1 === nBytes)
        ? (pk[n] & mask) === (b[n] & mask)
        : v = pk[n] === b[n]
    }
    if (v) return { pk, sk }
  }
}

module.exports = Keychain
