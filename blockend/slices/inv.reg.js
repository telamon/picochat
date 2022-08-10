/** *                  *
 *   .  *
 *  /¤\       *
 * /___\ [Content Advisory Warning]
 *
 * Read at your own risk.
 * This file shortcircuits the left with the right
 * causing loss of sanity for the legally inclined.
 */
const {
  decodeBlock
} = require('../util')
const { ACTIVE, stateOfPeer } = require('./peers.reg')
const DLABS = Buffer.from('vjbtsM2BFee1ExqsUJsJaoWLj8hXENll2/ePLeLz9c0=', 'base64')

const TYPE_ITEMS = 'items'

// Shit this is so confusing already.
function InventorySlice () {
  return {
    name: 'inv',
    initialValue: {},

    filter ({ block, root, state, HEAD }) {
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_ITEMS) return true

      const pid = HEAD.toString('hex')
      const peer = root.peers[pid]
      const pState = stateOfPeer(peer, root.vibes, root.chats)
      const hasBarItems = data.items.find(i => i.id < 0xD200)
      if (hasBarItems && !block.key.equals(DLABS)) return 'StampNotTrusted'
      if (pState !== ACTIVE) return 'PeerBusy'
      if (Date.now() - data.date >= 60 * 60 * 1000) return 'DeliveryTimeout'
      return false
    },

    reducer ({ block, state, schedule, HEAD }) {
      const pid = HEAD.toString('hex')
      const data = decodeBlock(block.body)
      // initialize peer inventory
      const inv = state[pid] = state[pid] || {}
      for (const item of data.items) {
        const slot = inv[item.id] = inv[item.id] || mkSlot(item.id)
        slot.qty++
        slot.expiresAt = item.expiresAt
        // TODO: schedule perishables
        /*
        if (item.expiresAt) {
          schedule(item.expiresAt, `item|${item.id}|${pid}`)
        }
        */
      }
      return state
    }
  }
}

function mkSlot (id) {
  return {
    id, // item id
    qty: 0,
    activatedAt: -1,
    expiresAt: -1
  }
}

module.exports = InventorySlice
