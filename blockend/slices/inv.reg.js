/** *                  *
 *   .  *
 *  /¤\       *
 * /___\ [Content Advisory Warning]
 *
 * Read at your own risk.
 * This file shortcircuits the left with the right
 * causing loss of sanity is for the legally inclined.
 */
const {
  decodeBlock
} = require('../util')
const DLABS = Buffer.from('vjbtsM2BFee1ExqsUJsJaoWLj8hXENll2/ePLeLz9c0=', 'base64')
const TYPE_ITEMS = 'items'

// Shit this is so confusing already.
function InventorySlice () {
  return {
    name: 'inv',
    initialValue: {},

    filter ({ block, root, state }) {
      return true
      const data = decodeBlock(block.body)
      console.log('ITEMSLICE', data)
      if (data.type !== TYPE_ITEMS) return true

      // if (!block.key.equals(DLABS)) return 'StampNotTrusted'
      debugger
      // - check profile state, parent equals head
      // - check stamp.date <= 1hour.
      // - check
      console.log('item filter pass', data)
    },

    reducer ({ block, state, schedule }) {

    }
  }
}
module.exports = InventorySlice
