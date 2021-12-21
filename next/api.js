import levelup from 'levelup'
import leveljs from 'level-js'
import Kernel from '../blockend/'
import { mute, gate, init } from '../blockend/nuro'
const Modem56 = window.Modem56

const DB = levelup(leveljs('picochat')) // Open IndexedDB
export const kernel = new Kernel(DB)

/**
 * Pico::N(e)uro -> svelte adapter
 * */
function svlt (neuron) { // totally pronounced 'svälti' with an icelandic accent.
  return {
    subscribe: neuron
  }
}

// Helpers hooks for quick register access
export function Profile () {
  return svlt(kernel.$profile())
}

export function Peers () {
  return svlt(kernel.$peers())
}

export function Peer (id) {
  return svlt(kernel.$peer(id))
}

export function Vibes () {
  return svlt(
    kernel.$vibes()
  )
}

export function Connections () {
  return svlt(
    gate(init(0, mute(kernel.$connections(), cnns => cnns.length)))
  )
}

export function GameOver () {
  return svlt(
    mute(
      kernel.$profile(), p => p.state === 'expired'
    )
  )
}

// Boot up
let tryBoot = null
export let lastError = null
export function boot () {
  if (!tryBoot) {
    tryBoot = kernel.load()
      .then(hasProfile => {
        // kernel.startGC()
        return hasProfile
      })
      .catch(err => {
        console.error('kernel boot failure', err)
        lastError = err
        return false
      })
      .then(l => { // Auto-redirect if needed
        if (lastError) window.location.hash = '/error?message=' + lastError.message
        else if (!kernel.ready) window.location.hash = '/keygen'
        return l
      })
  }

  // Consider moving to kernel.$state?
  const initalKernelState = {
    state: 'loading',
    error: null,
    hasKey: false,
    hasProfile: false,
    entered: false
  }

  const $n = init(initalKernelState, syn => {
    tryBoot.then(l => {
      syn({
        state: 'running',
        error: lastError,
        hasKey: !!l,
        hasProfile: l,
        entered: false
      })
    })
    return () => {} // noop
  })
  return svlt($n, 'KernelBoot')
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
export function Chat (chatId) {
  return svlt(kernel.$chat(chatId))
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
export async function enterPub () {
  const name = 'HardCode'
  if (!Modem56) throw new Error('Modem not available, did you load it?')
  if (!modem) modem = new Modem56()
  // else modem.leave()

  const spawnWire = await kernel.enter(name) // TODO, kernel.leave()
  modem.join(name, spawnWire)
}
