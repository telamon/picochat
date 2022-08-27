import { derived, writable, get } from 'svelte/store'
import { ITEMS } from '../blockend/items.db'
// Cart for Network purchases
// (staging area)
export const cart = writable([])
export const cartSum = derived(cart, c =>
  c.reduce((sum, i) => (sum + ITEMS[i.id].price * i.qty), 0)
)
export const cartQty = derived(cart, c => c.reduce((q, i) => q + i.qty, 0))

export function addCart (id) {
  const $cart = get(cart)
  const q = $cart.find(i => i.id === id)?.qty || 0
  setQty(id, q + 1)
}
export function delCart (id) {
  const $cart = get(cart)
  const q = $cart.find(i => i.id === id)?.qty || 0
  setQty(id, q - 1)
}
export function setQty (id, qty = 0) {
  const $cart = get(cart)
  let item = $cart.find(i => i.id === id)
  if (!item) {
    item = { id, qty: 0 }
    $cart.push(item)
  }
  item.qty = Math.max(qty, 0)
  cart.set($cart)
}
