import { useState, useEffect } from 'react'
import levelup from 'levelup'
import leveljs from 'level-js'
import Kernel from '../blockend/'
const Modem56 = window.Modem56

const DB = levelup(leveljs('picochat')) // Open IndexedDB
export const kernel = new Kernel(DB)

// PicoHook
export function usePico (store, name, selector, initialValue) {
  selector = selector || (state => state)
  const [value, set] = useState(initialValue)
  useEffect(() => {
    if (!kernel.ready) return
    set(selector(store.state[name]))
    // ensure unsub on unmount
    return store.on(name, state => set(selector(state)))
  }, [store, name, set, kernel.ready])
  return value
}

// Helpers hooks for quick register access
export function useProfile () {
  return usePico(kernel.store, 'peers', state => state[kernel.pk.toString('hex')], {})
}

export function useFriendsList () {
  return usePico(kernel.store, 'peers', s => Object.values(s).filter(p => p.pk !== kernel.pk), [])
}

/**
 *  It's **beep** time!
 *      ¤
 *   ___|_
 *  /____/|  ~ Modem 56 ~
 * |_o_=_|/
 *
 */
let modem = null // hardware is expensive, we can only afford a single modem for now.
// Helper to wire up modem56 to kernel and enter a pub in a single action.
export async function enterPub (name) {
  if (!Modem56) throw new Error('Modem not available, did you load it?')
  if (!modem) modem = new Modem56()
  else modem.leave()

  const spawnWire = await kernel.enter(name) // TODO, kernel.leave()
  modem.join(name, spawnWire)
}
