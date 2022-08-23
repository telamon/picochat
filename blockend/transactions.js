const assert = require('nanoassert')
const { ITEMS, WATER } = require('./items.db')
module.exports = class Transactions {
  // static ACTION_CONJURE_WATER = 0 // Deprecated
  static ACTION_OFFER = 1
  static ACTION_NETWORK_PURCHASE = 2
  static ACTION_ATTACHMENT = 3

  static validate (transaction) {
    if (!transaction) throw new Error('Must be an object')
    const { t: type, p: payload } = transaction
    let p
    switch (type) {
      case Transactions.ACTION_NETWORK_PURCHASE: {
        const { i: item, q: quantity } = payload
        assert(isPositiveInteger(item), 'p.i: ItemId missing')
        assert(ITEMS[item], 'p.i: UnknownItem')
        assert(item >= 0xD200, 'NotPurchasable')
        assert(isInteger(quantity), 'p.q: Quantity missing')
        if (item === WATER) assert(quantity === 1, 'p.q. One per customer')
        p = { i: item, q: quantity }
      } break
      case Transactions.ACTION_OFFER: {
        const { i: item, q: quantity } = payload
        assert(isPositiveInteger(item), 'p.i: ItemId missing')
        assert(ITEMS[item], 'p.i: UnknownItem')
        assert(isInteger(quantity), 'p.q: Quantity missing')
        p = { i: item, q: quantity }
      } break
      case Transactions.ACTION_ATTACHMENT:
        assert(isPositiveInteger(payload), 'p: ItemId missing')
        assert(ITEMS[payload], 'p: UnknownItem')
        assert(~['attachment', 'consumable'].indexOf(ITEMS[payload].type), 'p: ItemNotAttachable')
        p = payload
        break
      default:
        assert(false, `UnknownTransaction: ${type}`)
    }
    return { t: type, p }
  }
}

function isInteger (n) { return Number.isInteger(n) }
function isPositiveInteger (n) { return Number.isInteger(n) && n >= 0 }
