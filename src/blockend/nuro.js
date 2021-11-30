/***
 * Pico::Neuron
 *
 * A pure functional approach to the reactive-store pattern
 * delivering indiscriminate minimalism.
 * Easily bridged into any other framework of choice.
 *
 * A neuron is a function following this specific contract:
 * 1. Last argument must be a subscribe callback receiving a single value.
 * 2. Current value must be synchroneously published during subscribe
 * 3. Must return an unsubscribe method taking no arguments.
 *
 * Example:
 * const unsubscribe = neuron(value => console.log(value), ...optionalArguments)

 *
 * Given such a function you can build logical pathways using the functional transformers in this
 * module.
 *
 * // A dummy neuron holding a single immutable value
 * const $name = init('Tony') // prefix variables holding neurons with a $-sign
 * $name(console.log)() // logs 'Tony' and unsubscribes
 *
 * // Mutate value
 * const $greet = mute($name, name => `Yo ${name)!`)
 * $greet(console.log)() // logs 'Yo Tony!' and unsubscribes
 *
 * // Writable neuron with an inital value
 * const [$age, setAge] = writable('who cares')
 *
 * // Combine two neurons (Array mode)
 * const $na = combine($name, $age)
 * $na(([name, age]) => console.log('Name:', name, 'Age:', age))
 *
 * // Combine two neurons (ObjMode strips $-prefixes)
 * const $profile = combine({ $name, $age })
 * $profile(console.log)() // logs: `{ name: 'Tony', age: 300 }`
 *

// No this example does not work, v is immutable, request will always be fired.
const addr = mute(init(), (v, set) => (!v &&
  fetch('https://api64.ipify.org?format=json')
    .then(res => set(res.json()))
    .catch(console.error.bind(null, 'Failed lookup')) ||
  v
)
  // Neuro sum
  // Assume sum is a costly op, and we have other stores waiting.
  const $sum = memo(mute(
    combine(init(3), init(7)),
    ([a, b]) => (a + b)
  ))
  const $powerTwo = mutate($sum, x => x ** 2)
  const $timesTen = mutate($sum, x => x * 10)

  if (get($sum) !== 10) throw new Error('Brain Error')
*/

// Return values from compute method has to be 'null' in order
// to be set
function mute (neuron, compute, deepCompare = false) {
  return function NeuronMutate (syn) {
    const set = forwardDirty(syn, deepCompare)
    // Method by default return undefined
    return neuron(v => ((
      (v = compute(v, set)),
      typeof v !== 'undefined' && set(v))
    ))
  }
}

// One to many neuron (opposite of combine)
function memo (neuron) {
  let value
  const synapses = new Set()
  let disconnect = null
  return function NeuronMemory (syn) {
    synapses.add(syn)
    // console.log('instant memo', !!disconnect, value)
    if (disconnect) syn(value)
    else disconnect = neuron(spreadForward)
    return () => {
      synapses.delete(syn)
      if (synapses.length) return
      disconnect()
      disconnect = null
    }
  }
  function spreadForward (v) {
    value = v
    for (const syn of synapses) syn(v)
  }
}

function forwardDirty (synapse, deepCompare = false) {
  let value
  let first = true
  return function SynapseDirtyFilter (v) {
    const dirty = first || (deepCompare ? notEqualDeep(v, value) : notEqual(v, value))
    // console.info(`nuro:mute(${deepCompare}) => `, dirty, v, value)
    if (dirty) {
      first = false
      value = v
      synapse(v)
      return v
    }
  }
}

/* NotSure if useful
function dirty (neuron) {
  return function NeuronDirtyFilter (syn) {
    let value
    return neuron(v => {
      if (notEqual(value, v)) syn(v)
      value = v
    })
  }
}
*/

// Neuron that fires initial value once
// then passes subscription to optional neuron
function init (value, neuron) {
  return function NeuronValue (syn) {
    syn(value)
    return typeof neuron === 'function' ? neuron(syn) : function NOOP () {}
  }
}

// Have issues with some old async reactive stores
// that violate the contract of immediate invocation.
function isSync (neuron) {
  let ii = false
  neuron(() => { ii = true })()
  return ii
}
// A neuron is a function that when called returns a synapse.
// A synapse is a function that takes a subscribe function, and returns an unsubscribe function.

// neuron that takes multiple synapes as input and exports it as a single synapse
function combine (...neurons) {
  return function NeuronCombine (syn) {
    // Assume combine was called with map: combine({ a: synapse1, b: synapse2 })  // => 'synapse': function
    if (neurons.length === 1 && typeof neurons[0] !== 'function') {
      const props = []
      const s = syn
      const m = neurons[0]
      neurons = []
      for (const prop in m) {
        neurons.push(m[prop])
        props.push(prop)
      }
      syn = values => s(values.reduce((m, v, i) => (((m[props[i]] = v), m)), {}))
      // console.log('Combine[ObjMode]', props)
    }

    if (!Array.isArray(neurons) || !neurons.length) throw new Error('A list of neurons is required')
    if (typeof syn !== 'function') throw new Error('Derivation function required')

    const loaded = []
    const values = []
    let remaining = neurons.length

    const synapses = []
    for (let i = 0; i < neurons.length; i++) {
      synapses.push(neurons[i](handler.bind(null, i)))
    }

    return () => {
      for (const unsub of synapses) unsub()
    }

    function handler (i, val) {
      if (!loaded[i]) {
        loaded[i] = true
        remaining--
      }
      values[i] = val
      // console.log(`CombineHandler[${i}] ${neurons.map((n, i) => !!loaded[i])}`)
      if (!remaining) syn(values)
    }
  }
}

// Shallow compares two values targeting computationally efficient
// in-memory comparision with minimal recursion.
// Quick returns true if a difference is detected.
// if array, compare lengths and elements identities
// if object, compare props count and reference identities
// properties of object are expected to be enumerable.
function notEqual (a, b) {
  return a !== b ||
    (Array.isArray(a) && (
      b.length !== a.length ||
      !!a.find((o, i) => b[i] !== o))
    ) ||
    (typeof a === 'object' &&
      a !== null &&
      !!((kA, kBl) => kA.length !== kBl ||
        kA.find(p => a[p] !== b[p])
      )(Object.keys(a), Object.keys(b).length)
    )
}

function notEqualDeep (a, b) {
  return a !== b ||
    (Array.isArray(a) && (
      b.length !== a.length ||
      !!a.find((o, i) => notEqualDeep(b[i], o)))
    ) ||
    (typeof a === 'object' &&
      a !== null &&
      !!((kA, kBl) => kA.length !== kBl ||
        kA.find(p => notEqualDeep(a[p], b[p]))
      )(Object.keys(a), Object.keys(b).length)
    )
}

function writable (value) {
  const subs = new Set()
  return [
    function WritableSubscribe (notify) {
      subs.add(notify)
      notify(value)
      return () => { subs.delete(notify) }
    },
    function WritableSet (val) {
      if (notEqual(value, val)) {
        value = val
        for (const subcriber of subs) subcriber(val)
      }
      return val
    }
  ]
}

// Gets a value of a neuron
function get (neuron) {
  let value = null
  neuron(v => { value = v })()
  return value
}

// iterative sync get
function next (sub, n = 1) {
  let unsub = null
  return new Promise(resolve => {
    unsub = sub(m => !n-- ? resolve(m) : null)
  })
    .then(v => {
      unsub()
      return v
    })
}

module.exports = {
  get,
  nextState: next,
  next,
  writable,
  notEqual,
  memo,
  mute,
  init,
  combine,
  isSync
}
