const {
  TYPE_PROFILE,
  decodeBlock
} = require('../util')

const emptyProfile = (pk = null) => ({
  name: null,
  picture: ':-)',
  pk,
  tagline: null,
  date: null,
  sex: 2
})

module.exports = () => ({
  name: 'peers',
  initialValue: {}, // Initial state, empty hash

  filter: ({ block, state }) => {
    const data = decodeBlock(block.body)
    if (data.type !== TYPE_PROFILE) return true // Ignore non-profile blocks.

    // Validate profile content
    if (containsURL(data.tagline)) return 'URL in tagline not permitted'
    if (containsURL(data.name)) return 'Links in name is not permitted'
    if (data.name.match(/^\s/)) return 'Name must contain only letters or numbers'
    if (typeof data.age !== 'number') return 'Age must be a number'
    if (data.age < 18) return 'Kids not allowed into bars'
    if (!~[0, 1, 2].indexOf(data.sex)) return 'Sex should be 0: female, 1: male, 2: other'

    return false // All good, accept block
  },

  // Reducer updates state with values from block
  reducer: ({ block, state }) => {
    const key = block.key.toString('hex')
    state[key] = state[key] || emptyProfile(key) // Lazy initalize profile object
    Object.assign(state[key], decodeBlock(block.body, 1)) // Set new values
    state[key].pk = block.key // Store profile.pk as hexString
    return state // return new state
  }
})

function containsURL (s) {
  if (typeof s !== 'string') return false
  if (s.match('://')) return true
  return false
}
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
      console.log('Filter')
      peerId = peerId || pubKeyGetter()
      if (!peerId) return 'Cannot process block without knowing own identity'
      if (!block.key.equals(peerId)) return true // Ignore non self-authored blocks
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_PROFILE) return true // Ignore non-profile blocks.
      return false
    },
    reducer ({ block, state }) {
      console.log('Reducer')
      const data = decodeBlock(block.body)
      Object.assign(state, data)
      state.pk = block.key
      return state
    }
  }
}
