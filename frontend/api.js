import { BrowserLevel } from 'browser-level'
import Geohash from 'latlon-geohash'
import Kernel from '../blockend/'
import Keychain from '../blockend/keychain'
import { readable } from 'svelte/store'
import { mute, gate, init, write, combine, get, nfo } from 'piconuro'
import { navigate } from './router'
import inventory from './inventory.yaml'
const Modem56 = window.Modem56
const TOPIC = 'picochat-testnet'

/**
 * Pico::N(e)uro -> svelte adapter
 * */
export function svlt (neuron, dbg) {
  return readable(null, set =>
    !dbg
      ? neuron(set)
      : nfo(neuron, dbg)(set)
  )
}

const ROOT_DB = new BrowserLevel('PicoChat')
export const kernel = new Kernel(
  ROOT_DB.sublevel('app', {
    keyEncoding: 'buffer',
    valueEncoding: 'buffer'
  })
)

export const keychain = new Keychain(
  ROOT_DB.sublevel('key', {
    keyEncoding: 'buffer',
    valueEncoding: 'buffer'
  })
)

export const keygen = (gender, geo, attempts) => {
  return Keychain.generate(gender, geo, attempts)
}

export function decodePk (pk) {
  const info = Keychain.decodePk(pk)
  const ll = Geohash.decode(info.geohash)
  return { ...info, ...ll }
}

// Helpers hooks for quick register access
export function Profile (dbg) {
  return svlt(kernel.$profile(), dbg)
}

export function Peers (dbg) {
  return svlt(kernel.$peers(), dbg)
}

export function Peer (id, dbg) {
  return svlt(kernel.$peer(id), dbg)
}

export function Vibes (dbg) {
  return svlt(
    kernel.$vibes(), dbg
  )
}

export function NotificationsCount () {
  return svlt(
    mute(
      combine(kernel.$vibes(), kernel.$chats()),
      ([vibes, chats]) => vibes.reduce(
        (sum, v) => v.state === 'waiting_local' ? sum + 1 : sum,
        0
      ) +
      chats.reduce( // Dosen't work cause chats are actually vibe-objects.
        (sum, c) => c.myTurn ? sum + 1 : sum,
        0
      )
    )
  )
}

export function Chats () {
  return svlt(kernel.$chats())
}

export function Cooldowns () {
  return svlt(kernel.$cooldowns())
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
const [$profilePicture, setProfilePicture] = write(null)

const $state = combine({
  state: $kstate,
  error: $error,
  hasKey: $hasKey,
  hasProfile: $hasProfile,
  entered: $entered,
  swarming: $swarming
})

export const state = svlt($state)
export const profilePicture = svlt($profilePicture)

/* Bootloader */
export function boot () {
  if (!tryBoot) {
    tryBoot = keychain.readIdentity()
      .then(sk => {
        setHasKey(!!sk)
        return keychain.readProfile()
      })
      .then(pTemplate => {
        setHasProfile(!!pTemplate)
        if (pTemplate?.picture) setProfilePicture(pTemplate.picture)
        return kernel.boot()
      })
      .then(entered => {
        setEntered(entered)
        kernel.startGC()
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
export function Chat (chatId, d) {
  if (chatId === 'mock') return svlt(mockChat())
  return svlt(kernel.$chat(chatId), d)
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
  if (!Modem56) throw new Error('Modem not available, did you load it?')
  const devOpts = {
    // Attempted to debug: https://github.com/RangerMauve/hyperswarm-web/issues/20
    // announceLocalAddress: true,
    // webrtcBootstrap: ['ws://localhost:4977/signal']
  }
  if (!modem) modem = new Modem56(null, devOpts)
  else return // already connected
  // else modem.leave()
  modem.join(TOPIC, kernel.spawnWire.bind(kernel))
  setSwarming(true)
}

export function encodeImage (url) {
  const regex = /^data:([^;]+);base64,/
  const m = url.match(regex)
  if (m[1] !== 'image/jpeg') throw new Error('CanvasExportedUnexpectedFiletype: ' + m[1])
  return Buffer.from(url.replace(regex, ''), 'base64')
}

export function decodeImage (buf) {
  return 'data:image/jpeg;base64,' + buf?.toString('base64')
}

export async function updateProfile (profile) {
  await keychain.writeProfile(profile)
  setHasProfile(true)
  if (profile.picture) setProfilePicture(profile.picture)
  if (get($hasKey) && !get($swarming)) {
    await connectSwarm()
    navigate('/pub')
  }
}

export async function storeIdentity (sk) {
  await keychain.writeIdentity(sk)
  setHasKey(true)
}

export async function enter () {
  if (!get($hasKey)) return navigate('/keygen')
  if (!get($hasProfile)) return navigate('/profile')
  // TODO: in this contexted $entered refers to if profile-block is published or not
  // need to refactor kernel states for clarity
  if (!get($entered)) {
    const sk = await keychain.readIdentity()
    const profile = await keychain.readProfile()
    await kernel.register(profile, sk)
    setEntered(true)
  }
  return connectSwarm()
}

export async function purge (purgeKeychain = false) {
  const msg = purgeKeychain
    ? 'You are about to burn your passport and everything with it... you sure about this?'
    : 'Permanently wipe ALL data, you sure?'
  if (!window.confirm(msg)) return
  if (purgeKeychain) await keychain.db.clear()
  await kernel.db.clear()
  window.location.reload()
}

export async function reloadStore () {
  const m = await kernel.store.reload()
  console.info('Stores refreshed', m)
  window.location.reload()
}

export async function saveBackup () {
  const File = window.File
  const secret = await keychain.readIdentity()
  const b = new File(
    [secret.toString('hex')],
    'idsqr-insecure-backup.txt',
    { type: 'application/text' }
  )
  const u = URL.createObjectURL(b)
  window.open(u, '_blank')
  // TODO: revokeObjectURL
}

function mockChat () {
  const [$initiator, setInitiator] = write(true)
  const [$turn, setTurn] = write(true)
  const $msgs = init([
    'Hello',
    'Hi',
    'Weather\'s nice! 🔥',
    'You\'re joking right?',
    undefined,
    'There\'s a thunderstorm going on!',
    'No way! That\'s so cool!',
    'The roof is gone 🥲',
    'Is your pants still on?',
    undefined,
    'Please tell me you\'re not stroking yourself during a hurricane',
    'Yup!'
  ])

  return mute(
    combine($initiator, $turn, $msgs, $profilePicture),
    ([initiator, myTurn, msgs, picture]) => {
      let graph = 'ᚲᛃ'
      const messages = msgs.map((m, i) => {
        const remote = i % 2
        const type = remote ^ initiator ? 'sent' : 'received'
        graph += m
          ? remote ? 'ᛗ' : 'ᛖ'
          : remote ? 'ᚧ' : 'ᚦ'
        return { type, content: m || '', pass: !m }
      })

      return {
        peer: {
          name: !initiator ? 'Whitemane' : 'Blackie',
          picture,
          tagline: 'mock tag',
          date: Date.now(),
          sex: 0,
          score: 99,
          age: 23
        },
        myTurn,
        initiator,
        state: 'active',
        graph,
        health: 2,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        async send () {},
        async pass () {
          setTurn(false)
          return new Promise(resolve => {
            setTimeout(() => {
              setTurn(true)
              resolve()
            }, 1000)
          })
        },
        async bye () {
          setInitiator(!initiator)
        },
        mLength: messages.length,
        messages
      }
    }
  )
}
