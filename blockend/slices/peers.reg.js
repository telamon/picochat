const {
  TYPE_PROFILE,
  decodeBlock
} = require('../util')
const TTL = 30 * 60 * 1000 // 30min
const emptyProfile = (pk = null) => ({
  name: null,
  picture: null,
  pk,
  tagline: null,
  date: null,
  sex: 2,
  sig: null,
  expiresAt: 0,
  state: 'active'
})

function validateProfile (data) {
  // Validate profile content
  if (!data.picture) return 'Profile Picture missing'
  if (Buffer.isBuffer(data.picture)) { // webp support
    // TODO: validate webp headers && bitmap offsets?
    if (data.picture.length > 15000) return 'Picture should be less than 15kB'
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
    state[key] = state[key] || emptyProfile(key) // Lazy initalize profile object
    Object.assign(state[key], decodeBlock(block.body, 1)) // Set new values
    state[key].pk = block.key // Store profile.pk as hexString
    state[key].sig = block.sig // Store profile.pk as hexString
    state[key].expiresAt = state[key].date + TTL
    schedule('peer', block.key, state[key].expiresAt)
    return state // return new state
  }
})

// Experiment, attempt maintaining own profile as separate slice
// registering it as the first controller should ensure that all other slices
// will run after it, making it possible to use as a dependency through rootState...
module.exports.ProfileCtrl = function ProfileCtrl (pubKeyGetter) {
  let peerId = null
  return {
    name: 'peer',
    initialValue: {
      ...emptyProfile(),
      exp: 0 // fck
    },
    filter ({ block }) {
      peerId = peerId || pubKeyGetter()
      if (!peerId) return 'Cannot process block without knowing own identity'
      if (!block.key.equals(peerId)) return true // Ignore non self-authored blocks
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_PROFILE) return true // Ignore non-profile blocks.
      return validateProfile(data)
    },
    reducer ({ block, state }) {
      const data = decodeBlock(block.body)
      Object.assign(state, data)
      state.pk = block.key
      state.sig = block.sig // Store profile.pk as hexString
      state.expiresAt = state.date + TTL
      return state
    }
  }
}
