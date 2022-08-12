const a = require('nanoassert')

module.exports = class Transactions {
  static ACTION_CONJURE_WATER = 0

  static validate (transaction) {
    if (!transaction) throw new Error('Must be an object')
    const { t, p } = transaction // type, payload
    switch (transaction?.t) {
      case Transactions.ACTION_CONJURE_WATER:
        a(typeof p === 'undefined' || p === null, 'PayloadNotSupported')
        break
      default:
        a(false, `UnknownTransaction: ${t}`)
    }
    return { t, p }
  }
}
