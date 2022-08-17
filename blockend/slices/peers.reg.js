const {
  TYPE_PROFILE,
  EV_CHAT_END,
  EV_BALANCE_CREDIT,
  EV_BALANCE_DEBIT,
  EV_ADD_SCORE,
  decodeBlock,
  btok
} = require('../util')
const assert = require('nanoassert')
const { scoreGraph } = require('../game')

const ACTIVE = 'active'
const PENDING = 'pending' // Waiting for vibe-resp
const LOCKED = 'locked' // Locked in convo
const EXPIRED = 'expired' // GC-candy

const { profile_timeout: TTL } = require('../../config.js')

module.exports = () => ({
  name: 'peers',
  initialValue: {}, // Initial state, empty hash

  filter: ({ block, state }) => {
    const data = decodeBlock(block.body)
    if (data.type !== TYPE_PROFILE) return true // Ignore non-profile blocks.
    return validateProfile(data)
  },

  // Reducer updates state with values from block
  reducer: ({ block, state, schedule }) => {
    const key = block.key.toString('hex')
    state[key] = state[key] || mkProfile(key) // Lazy initalize profile object
    Object.assign(state[key], decodeBlock(block.body, 1)) // Set new values
    state[key].pk = block.key // Store profile.pk as hexString
    state[key].sig = block.sig // Store profile.pk as hexString
    state[key].expiresAt = state[key].date + TTL
    schedule('peer', block.key, state[key].expiresAt)
    return state // return new state
  },

  trap ({ code, payload, root, state }) {
    switch (code) {
      case EV_CHAT_END: {
        const strkey = btok(payload)
        const chat = root.chats.chats[strkey]
        const score = scoreGraph(chat.graph)
        state[btok(chat.a)].score += score[0]
        state[btok(chat.b)].score += score[1]
        // Scores affect balance as well
        state[btok(chat.a)].balance += score[0]
        state[btok(chat.b)].balance += score[1]

        // Handle balance affecting transactions
        const pending = root.trs[strkey]
        if (!pending?.length) return
        for (const op of pending) {
          switch (op.type) {
            case 'debit':
              assert(Buffer.isBuffer(op.target), 'InvalidPeerId')
              assert(Number.isFinite(op.amount), 'InvalidAmount')
              state[btok(op.target)].balance -= op.amount
              break
            case 'credit':
              assert(Buffer.isBuffer(op.target), 'InvalidPeerId')
              assert(Number.isFinite(op.amount), 'InvalidAmount')
              state[btok(op.target)].balance += op.amount
              break
          }
        }
      } break
      case EV_BALANCE_CREDIT: {
        const { target, amount } = payload
        state[btok(target)].balance += amount
      } break
      case EV_BALANCE_DEBIT: {
        const { target, amount } = payload
        state[btok(target)].balance -= amount
      } break
      case EV_ADD_SCORE: {
        const { target, amount } = payload
        state[btok(target)].score += amount
      } break
      default:
        return // unhandled signal
    }
    return state
  }
})

// Experimental: attempt maintaining own profile as separate slice
// TODO: redesign later to formalize cross-slice dependencies.
// just don't recreate immutable state as that would create inmemory
// blocks of blocks and quad memory usage.
// The size of a swarm will always be limited by the slowest node.
// TODO: deprecate this slice, it's sole function is make
// own-peerId available to other slices.
module.exports.ProfileCtrl = function ProfileCtrl (pubKeyGetter) {
  let peerId = null
  return {
    name: 'peer',
    initialValue: mkProfile(),
    filter ({ block }) {
      peerId = peerId || pubKeyGetter()
      if (!peerId) return 'Cannot process block without knowing own identity'
      if (!block.key.equals(peerId)) return true // Ignore non self-authored blocks
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_PROFILE) return true // Ignore non-profile blocks.
      return validateProfile(data)
    },
    reducer ({ block, state, root }) {
      return { ...root.peers[btok(peerId)] }
    },

    // This slice runs AFTER the peers slice
    trap ({ code, payload, root, state }) {
      const rootPeer = root.peers[btok(peerId)]
      let copy = false
      switch (code) {
        case EV_CHAT_END: {
          const cid = btok(payload)
          const chat = root.chats.chats[cid]
          copy = peerId.equals(chat.a) ||
            peerId.equals(chat.b)
        } break
        case EV_BALANCE_CREDIT:
        case EV_BALANCE_DEBIT:
        case EV_ADD_SCORE:
          copy = peerId.equals(payload.target)
          break
      }
      if (copy) return { ...rootPeer }
    }
  }
}

function mkProfile (pk) {
  return {
    name: null,
    picture: null,
    pk,
    tagline: null,
    date: null,
    sex: 2,
    sig: null,
    expiresAt: 0,
    state: ACTIVE,
    balance: 0, // Current amount of ¤ Decents
    score: 0 // score equals total acquired ¤ through rewards
  }
}

function validateProfile (data) {
  // Validate profile content
  if (!data.picture) return 'Profile Picture missing'
  if (Buffer.isBuffer(data.picture)) { // webp support
    // TODO: validate webp headers && bitmap offsets?
    if (data.picture.length > 21000) return 'Picture should be less than 21kB'
  } else if (typeof data.picture !== 'string' || data.picture.length > 10) {
    return 'Picture should be an emoji'
  }

  if (containsURL(data.tagline)) return 'URL in tagline not permitted'
  if (containsURL(data.name)) return 'Links in name is not permitted'
  if (data.name.match(/^\s/)) return 'Name must contain only letters or numbers'
  if (typeof data.age !== 'number') return 'Age must be a number'
  if (data.age < 18) return 'Kids not allowed into bars'
  if (!~[0, 1, 2].indexOf(data.sex)) return 'Sex should be 0: female, 1: male, 2: other'

  return false // All good, accept block
}

function containsURL (s) {
  if (typeof s !== 'string') return false
  if (s.match('://')) return true
  return false
}


/**
 * Low-level state helper,
 * tradeoff signaling for realtime computation
 */
function stateOfPeer (peer, vibes, chats) {
  if (peer.state === EXPIRED) return EXPIRED
  if (peer.state !== ACTIVE) throw new Error(`InvalidState: ${peer.state}`)
  const pid = peer.pk.toString('hex')
  const cid = vibes.seen[pid]?.toString('hex')
  if (!cid) return ACTIVE
  const match = vibes.matches[cid]
  if (!match) throw new Error('MentalError')
  if (match.state === 'rejected') return ACTIVE
  if (match.state !== 'match') return PENDING
  const chat = chats.chats[cid]
  if (chat && chat.state === 'end') return ACTIVE
  return LOCKED
}

module.exports.stateOfPeer = stateOfPeer
module.exports.ACTIVE = ACTIVE
module.exports.PENDING = PENDING
module.exports.LOCKED = LOCKED
module.exports.EXPIRED = EXPIRED
