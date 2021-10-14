import { useState, useEffect } from 'react'
import levelup from 'levelup'
import leveljs from 'level-js'
import Kernel from '../blockend/'

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
