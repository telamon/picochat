import { useState, useEffect } from 'react'
import levelup from 'levelup'
import leveljs from 'level-js'
import Kernel from '../blockend/'
import { get, mute } from '../blockend/nuro'
const Modem56 = window.Modem56

const DB = levelup(leveljs('picochat')) // Open IndexedDB
export const kernel = new Kernel(DB)

// Pico::Neuro To be renamed
function useNeuro ($n) {
  const [value, set] = useState(get($n))
  useEffect(() => $n(set), [set])
  return value
}

// Helpers hooks for quick register access
export function useProfile () {
  return useNeuro(kernel.$profile())
}

export function usePeers () {
  return useNeuro(kernel.$peers())
}

export function useVibes () {
  return useNeuro(kernel.$vibes())
}

export function useGameOver () {
  return useNeuro(
    mute(
      kernel.$profile(), p => p.state === 'expired'
    )
  )
}

// Boot up
let tryBoot = null
let lastError = null
export function useBoot () {
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(kernel.ready)
  const [error, setError] = useState(lastError)
  if (!tryBoot) {
    tryBoot = kernel.load()
      .then(hasProfile => {
        kernel.startGC()
        console.info('kernel is live', hasProfile)

        return hasProfile
      })
      .catch(err => {
        console.error('kernel boot failure', err)
        lastError = err
        setError(err)
        return false
      })
      .then(l => { // Auto-redirect if needed
        if (lastError) window.location.hash = '/error?message=' + lastError.message
        else if (!kernel.ready) window.location.hash = '/register'
      })
  }
  tryBoot.then(l => {
    setHasProfile(l)
    setLoading(false)
    console.log('Setting loading to false')
  })
  return { loading, error, hasProfile, kernel }
}

/*
 * subscribes your component to a specific conversation.
 * returns a high-level object containing both stats and actions
 *
 * usage example:
 * const {
 *   // Props
 *   myTurn, // boolean, actions can only be invoked when true.
 *   updatedAt, // Last activity of chat
 *   status, // string '|active|timeout|exhausted|ended'
 *   messages // Array of messages.
 *
 *   // Actions
 *   send, // async function, send(message: string)
 *   pass, // async function, passes turn to opponent
 *   bye,  // async function, bye(mood)
 * } = useChat(id) // <-- same id as vibeId
 */
export function useChat (chatId) {
  const [value, set] = useState({})
  const [messages, setMessages] = useState([])
  useEffect(() => {
    if (!kernel.ready) return
    return kernel.$chat(chatId)(chat => {
      set(chat)
      setMessages(chat.messages)
    })
  }, [kernel.ready, set, setMessages])
  return { ...value, messages }
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
