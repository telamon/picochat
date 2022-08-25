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
  btok,
  decodeBlock,
  EV_CHAT_END,
  EV_BALANCE_CREDIT,
  EV_BALANCE_DEBIT,
  EV_ADD_SCORE, // Also adds time
  TYPE_VIBE_RESP,
  TYPE_ITEMS,
  TYPE_ACTIVATE,
  VIBE_REJECTED
} = require('../util')
const { now } = require('../../config')
const D = require('debug')('picochat:slices:inv')
const { ACTIVE, stateOfPeer } = require('./peers.reg')
const {
  validate,
  ACTION_OFFER,
  ACTION_NETWORK_PURCHASE,
  ACTION_ATTACHMENT
} = require('../transactions')
const BARPK = Buffer.from('jWR6XgHjIeNA8xDtVtjOxdsUhgKzABQ75HHi30ab8X0=', 'base64')
const { ITEMS } = require('../items.db')
// Shit this is so confusing already.
function InventorySlice () {
  return {
    name: 'inv',
    initialValue: {},

    filter ({ block, root, state, HEAD }) {
      const data = decodeBlock(block.body)
      if (
        data.type !== TYPE_ITEMS &&
        data.type !== TYPE_ACTIVATE
      ) return true
      // validate peer state
      const pid = btok(HEAD)
      const peer = root.peers[pid]
      const pState = stateOfPeer(peer, root.vibes, root.chats)
      if (pState !== ACTIVE) return 'PeerBusy'

      // Validate block
      if (data.type === TYPE_ITEMS) {
        const hasBarItems = data.items.find(i => i.id < 0xD200)
        if (hasBarItems && !block.key.equals(BARPK)) return 'StampNotTrusted'
        if (now() - data.date >= 60 * 60 * 1000) return 'DeliveryTimeout'
      } else { // TYPE_ACTIVATE
        if (!ITEMS[data.i]) return 'UnknownItem'
        if (!~['consumable', 'active'].indexOf(ITEMS[data.i].type)) return 'CannotBeActivated'
        const inv = state[pid]
        if (!inv) return 'InventoryEmpty'
        const item = inv[data.i]
        if (!item) return 'ItemNotHeld'
        if (item.qty <= 0) return 'OutOfStock'
      }
      return false
    },

    reducer ({ block, state, schedule, signal, HEAD }) {
      const pid = btok(HEAD)
      const data = decodeBlock(block.body)
      // initialize peer inventory
      const inv = initInv(state, pid)
      if (data.type === TYPE_ITEMS) {
        for (const item of data.items) { // uncrate items
          const slot = initSlot(inv, item.id)
          slot.qty++
          slot.expiresAt = item.expiresAt
          onPickup(HEAD, item.id, signal)
          D('onPickup(%x, %x, %i)', HEAD, item.id, slot.qty)

          /* TODO: schedule perishables to expire
            if (item.expiresAt) {
              schedule(item.expiresAt, `item|${item.id}|${pid}`)
            }
          */
        }
      } else { // TYPE_ACTIVATE
        const { i } = data
        const item = ITEMS[i]
        const slot = initSlot(inv, i)
        if (item.type === 'consumable') {
          slot.qty--
          slot.activatedAt = now()
          // TODO: Rethink before proceed, inflation in time and score?
          signal(EV_ADD_SCORE, { target: HEAD, amount: item.time })
          signal(EV_BALANCE_CREDIT, { target: HEAD, amount: item.time })
        } else { // type: active (can be toggled)
          if (isActive(slot)) {
            slot.deactivatedAt = now()
            // TODO: Apply deactivation effects
            console.warn('Item deactivation effects not implemented')
          } else {
            slot.activatedAt = now()
            // TODO: Apply activation effects
            console.warn('Item activation effects not implemented')
          }
        }
        // onActivate(HEAD, item.id, signal)
        D('onActivate(%x, %x, %i)', HEAD, item, slot.qty)
      }
      return state
    }, // Picochat is a social survival game with in the setting of a night club. It's powered by pico-blockchains.

    trap ({ code, payload, root, state }) {
      if (code !== EV_CHAT_END) return
      const cid = btok(payload)
      const pending = root.trs[cid]
      if (!pending?.length) return
      for (const op of pending) {
        if (op.type !== 'item') continue
        const inv = initInv(state, btok(op.target))
        const slot = initSlot(inv, op.item)
        slot.qty += op.qty
        const tname = root.peers[btok(op.target)]?.name || op.target
        D('[%s]onTrade(%h, %h, %i) => %i', root.peer.name, tname, op.item, op.qty, slot.qty)
      }
      return state
    }
  }
}

function initInv (state, pid) {
  state[pid] = state[pid] || {}
  return state[pid]
}

function initSlot (inv, id) {
  inv[id] = inv[id] || {
    id, // item id
    qty: 0,
    activatedAt: -1,
    deactivatedAt: -1,
    expiresAt: -1
  }
  return inv[id]
}

function isActive (slot) {
  return !(slot.activatedAt === -1 || slot.activatedAt < slot.deactivatedAt)
}

// A slice holding pending transactions
// and applying them on successfull timelock break
function TransactionsSlice () {
  return {
    name: 'trs',
    initialValue: {
    },

    filter ({ block, parentBlock, root, state }) {
      const { type, box } = decodeBlock(block.body)

      if (type !== TYPE_VIBE_RESP) return true
      const rejected = VIBE_REJECTED.equals(box)
      if (rejected) return true
      const { t: transactions } = decodeBlock(parentBlock.body)
      try {
        for (const ta of transactions) {
          const { t: type, p: payload } = validate(ta)
          switch (type) {
            // Not yet supported by frontend.
            case ACTION_OFFER: {
              const sourcePid = btok(parentBlock.key)
              const inv = root.inv[sourcePid]
              if (!inv) return 'InventoryEmpty'
              const item = inv[payload.i]
              if (!item) return 'ItemNotHeld'
              if (item.qty - payload.q < 0) return 'NegativeQuantity'
            } break

            case ACTION_NETWORK_PURCHASE: {
              const { i, q } = payload
              const item = ITEMS[i]
              const sum = item.price * q
              const target = btok(parentBlock.key)
              if (root.peers[target].balance < sum) return 'InsufficientFunds'
            }
          }
        }
      } catch (err) { return err.message }

      return false
    },

    reducer ({ block, parentBlock, root, state }) {
      const cid = btok(parentBlock.sig)
      const { t: transactions } = decodeBlock(parentBlock.body)
      const pending = state[cid] = []
      for (const { t: type, p: payload } of transactions) {
        switch (type) {
          case ACTION_ATTACHMENT: {
            const white = parentBlock.key
            const black = block.key
            const item = ITEMS[payload]
            if (item.consumable) {
              pending.push({
                type: 'item',
                item: payload.i,
                qty: -payload.q,
                target: white
              })
            }
            // TODO: what to do if item has no boost time?
            pending.push({
              type: 'credit',
              target: black,
              amount: item.time
            })
          } break
          case ACTION_OFFER: // Swap ownership
            pending.push({
              type: 'item',
              item: payload.i,
              qty: payload.q,
              target: block.key // black
            })
            pending.push({
              type: 'item',
              item: payload.i,
              qty: -payload.q,
              target: parentBlock.key // white
            })
            break
          case ACTION_NETWORK_PURCHASE: {
            const white = parentBlock.key
            const black = block.key
            const tname = root.peers[btok(white)]?.name || white
            D('[%s]txBuy(%h, %h, %i) => %i', root.peer.name, tname, payload.i, payload.q)
            const item = ITEMS[payload.i]
            pending.push({ type: 'debit', target: white, amount: item.price })
            pending.push({ type: 'credit', target: black, amount: item.price * 0.02 }) // reward 2% of minted value
            pending.push({
              type: 'item',
              item: payload.i,
              qty: payload.q,
              target: white
            })
            // TODO: pending.push( item.onPickup effects)
          } break
        }
      }
      return state
    },

    trap ({ code, payload, root, state }) {
      if (code !== EV_CHAT_END) return
      const cid = btok(payload)
      delete state[cid] // Clear out pending transactions
      return state
    }
  }
}

/**
 * TODO: lookup stats in ../../items.js
 */
function onPickup (pid, item, signal) {
  switch (item) {
    case 0xD001: { // badge
      const amount = ITEMS[0xD001].time
      signal(EV_BALANCE_CREDIT, { target: pid, amount })
      signal(EV_ADD_SCORE, { target: pid, amount })
    } break
  }
}
module.exports = {
  InventorySlice,
  TransactionsSlice
}
