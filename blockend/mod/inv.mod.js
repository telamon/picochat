const assert = require('nanoassert')
// const { mute, combine } = require('piconuro')
// const { ACTIVE } = require('../slices/peers.reg')
const {
  // btok,
  TYPE_ACTIVATE
} = require('../util')

module.exports = function InventoryModule () {
  return {
    // $hasItem(pk, itemId) { return  inv[itemId].qty }

    async useItem (i) {
      assert(Number.isInteger(i), 'ItemID expected')
      // const cd = await until(this.$cooldowns(), cd => cd.state !== 'loading')
      // if (!cd.canVibe) throw new Error('VibeNotReady')
      const feed = await this.createBlock(TYPE_ACTIVATE, { i })
      return feed.last.sig // block id
    }
  }
}
