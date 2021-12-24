import levelup from 'levelup'
import leveljs from 'level-js'
import Kernel from '../blockend/'
import Keychain from '../blockend/keychain'
import { mute, gate, init, write, combine, svlt, get } from '../blockend/nuro'
import { navigate } from './router'
const Modem56 = window.Modem56

const DB = levelup(leveljs('picochat')) // Open IndexedDB
const personalBucket = levelup(leveljs('keychain')) // Open IndexedDB
export const kernel = new Kernel(DB)
export const keychain = new Keychain(personalBucket)
export const keygen = Keychain.generate
export const decodePk = Keychain.decodePk

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

const [$kstate, setKstate] = write('loading')
const [$error, setError] = write()
const [$entered, setEntered] = write(false) // block published/ participating
const [$swarming, setSwarming] = write(false) // are the m56 lights blinking?
const [$hasKey, setHasKey] = write(false)
const [$hasProfile, setHasProfile] = write(false)

const $state = combine({
  state: $kstate,
  error: $error,
  hasKey: $hasKey,
  hasProfile: $hasProfile,
  entered: $entered,
  swarming: $swarming
})

export const state = svlt($state)

export function boot () {
  if (!tryBoot) {
    tryBoot = keychain.readIdentity()
      .then(sk => {
        setHasKey(!!sk)
        return keychain.readProfile()
      })
      .then(pTemplate => {
        setHasProfile(!!pTemplate)
        return kernel.load()
      })
      .then(entered => {
        setEntered(entered)
        // kernel.startGC()
      })
      .catch(err => {
        console.error('kernel boot failure', err)
        lastError = err
        setError(err)
        setKstate('error')
        throw err
      })
      .then(entered => { // Auto-redirect if needed
        setKstate('running')
        const s = get($state)
        console.info('Final state', s)
        const autoSwarm = JSON.parse(window.localStorage.getItem('auto_swarm'))
        if (s.error) window.location.hash = '/error?message=' + s.error.message
        else if (!s.hasKey) navigate('/keygen')
        else if (!s.hasProfile) navigate('/profile')
        else return autoSwarm && connectSwarm()
      })
  }
  // tryBoot.then(do something everytime boot is invoked)
  return tryBoot
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
export async function connectSwarm () {
  const name = 'HardCode'
  if (!Modem56) throw new Error('Modem not available, did you load it?')
  if (!modem) modem = new Modem56()
  else return // already connected
  // else modem.leave()

  const spawnWire = await kernel.enter(name) // TODO, kernel.leave()
  modem.join(name, spawnWire)
  setSwarming(true)
}

export function encodeImage (url) {
  const regex = /^data:([^;]+);base64,/
  const m = url.match(regex)
  if (m[1] !== 'image/jpeg') throw new Error('CanvasExportedUnexpectedFiletype: ' + m[1])
  return Buffer.from(url.replace(regex, ''), 'base64')
}

export function decodeImage (buf) {
  return 'data:image/jpeg;base64,' + buf.toString('base64')
}

export async function updateProfile (profile) {
  await keychain.writeProfile(profile)
  setHasProfile(true)
  if (get($hasKey) && !get($swarming)) {
    await connectSwarm()
    navigate('/pub')
  }
}
