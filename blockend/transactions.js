const assert = require('nanoassert')

module.exports = class Transactions {
  static ACTION_CONJURE_WATER = 0
  static ACTION_OFFER = 1

  static validate (transaction) {
    if (!transaction) throw new Error('Must be an object')
    const { t: type, p: payload } = transaction
    switch (type) {
      case Transactions.ACTION_CONJURE_WATER:
        assert(
          typeof payload === 'undefined' || payload === null,
          'PayloadNotSupported'
        )
        break
      case Transactions.ACTION_OFFER: {
        const { i: item, q: quantity } = payload
        assert(isPositiveInteger(item), 'p.i: ItemId missing')
        // TODO: assert Item is known
        assert(isInteger(quantity), 'p.q: Quantity missing')
      } break
      default:
        assert(false, `UnknownTransaction: ${type}`)
    }
    return { t: type, p: payload }
  }
}

function isInteger (n) {
  return Number.isInteger(n)
}
function isPositiveInteger (n) {
  return Number.isInteger(n) && n >= 0
}
