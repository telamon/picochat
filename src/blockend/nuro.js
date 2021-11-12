// -------- purely functional pico reactive store pattern - adrenaline/synapse?
/***

 *
  // Neurode sum
  const $sum = memory(mutate(
    combine(initial(3), initial(7)),
    ([a, b]) => ((console.log('A, B', a, b), a + b))
  ))
  // Assume sum is a costly op, and we have other stores waiting.
  const $powerTwo = mutate($sum, x => x ** 2)
  const $timesTen = mutate($sum, x => x * 10)
  debugger
  if (get($sum) !== 10) throw new Error('Brain Error')
*/

// Return values from compute method has to be 'null' in order
// to be set
function mute (neuron, compute) {
  return function NeuronMutate (syn) {
    const set = forwardDirty(syn)
    // Method by default return undefined
    return neuron(v => (((v = compute(v, set)), typeof v !== 'undefined' && set(v))))
  }
}

// One to many neuron (opposite of combine)
function memo (neuron) {
  let value
  const synapses = []
  let disconnect = null
  return function NeuronMemory (syn) {
    synapses.push(syn)
    // console.log('instant memo', !!disconnect, value)
    if (disconnect) syn(value)
    else disconnect = neuron(speadForward)
    return () => {
      const idx = synapses.indexOf(syn)
      if (~idx) return
      synapses.splice(idx, 1)
      if (synapses.length) return
      disconnect()
      disconnect = null
    }
  }
  function speadForward (v) {
    value = v
    for (const syn of synapses) syn(v)
  }
}

function forwardDirty (synapse) {
  let value
  let first = true
  return function SynapseDirtyFilter (v) {
    if (first || notEqual(v, value)) {
      first = false
      synapse(v)
      return v
    }
    value = v
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
    console.log('Initial produced', value)
    syn(value)
    return typeof neuron === 'function' ? neuron(syn) : function NOOP () {}
  }
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
      !!((kA, kBl) => kA.length !== kBl ||
        kA.find(p => a[p] !== b[p])
      )(Object.keys(a), Object.keys(b).length)
    )
}

function writable (value) {
  const subs = []
  return [
    function WritableSubscribe (notify) {
      subs.push(notify)
      notify(value)
      return () => {
        const idx = subs.indexOf(notify)
        if (~idx) subs.splice(idx, 1)
      }
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

// Async get
function nextState (sub, n = 1) {
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
  nextState,
  writable,
  notEqual,
  memo,
  mute,
  init,
  combine
}
