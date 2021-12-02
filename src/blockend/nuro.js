const ERROR = Symbol.for('piconeuro:Error')
module.exports = {
  ERROR,
  get,
  next,
  writable,
  notEqual,
  notEqualDeep,
  memo,
  mute,
  init,
  combine,
  isSync,
  gate,
  iter
}
/***
 * Pico::Neuron
 *
 * A functional approach to the reactive-store pattern
 * delivering indiscriminate minimalism.
 * Easily bridged into any other framework of choice.
 *
 * A neuron is a function following this specific contract:
 * 1. Single argument must be a subscribe callback receiving a single value.
 * 2.a) Current value should be synchroneously published during subscribe
 * 2.b) If current value is not available it may be deferred by returning a promise, use (init)
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
*/

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

// Neuron that fires initial value once synchroneously.
//  init(v, $n) => Fire1:  $n.sync || v; Fire2: $n.async
function init (value, neuron) {
  return function InitialValue (syn) {
    let disconnected = false
    let unsub = function noop () {}
    let fired = false
    if (typeof neuron === 'function') {
      unsub = neuron(v => {
        // value = v
        fired = true
        if (!disconnected) syn(v)
      })
    }
    if (!fired) syn(value) // Note: disconnected is always false here
    return () => {
      disconnected = true
      unsub()
    }
  }
}

function gate (neuron, shallow = false) {
  let value
  let first = true
  const check = typeof shallow === 'function'
    ? shallow
    : !shallow
        ? notEqualDeep
        : notEqual
  return function NoiseGate (syn) {
    return neuron(v => {
      const dirty = check(v, value)
      // console.info(`nuro:gate(${shallow}) => `, dirty ? '>>PASS>>' : '!!HOLD!!\n>>> A\n', v, '\n===\n', value, '\n<<< B')
      if (first || dirty) {
        first = false
        value = clone(v)
        syn(v)
      }
    })
  }
}

/**
 * Produces a shallow clone of objects and arrays
 */
function clone (o) {
  if (typeof o === 'object' && o !== null) return { ...o }
  if (Array.isArray(o)) return [...o]
  return o
}
/*
 * Possibly async neuron.
 * fires on immediate or async result.
 * Does not fire placeholders, prepend with init() a sync initialValue is needed:
 * use:
 *
 *  $peersUrl => init(
 *    [], // Empty array as placeholder
 *    mute($data, async u => fetch(u))
 *  )
 */
function mute (neuron, fn) {
  if (typeof fn !== 'function') throw new Error('expected a mutation function')
  return function Mutate (syn) {
    let prev = Promise.resolve(0)
    return neuron(input => {
      const output = fn(input)
      if (
        typeof output.then === 'function' &&
        typeof output.catch === 'function'
      ) {
        prev = prev.then(() =>
          output
            .then(syn)
            .catch(err => {
              console.error('n:mute() failed: ', err)
              syn(ERROR, err)
            })
        )
      } else syn(output)
    })
  }
}

// Have issues with some old async reactive stores
// that violate the contract of immediate invocation.
function isSync (neuron) {
  let ii = false
  let set = () => { ii = true }
  neuron(() => set())()
  set = () => { throw new Error('NeuronNotSync, subscription invoked after unsubscribe()') }
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
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.length !== a.length ||
      !!a.find((o, i) => b[i] !== o)
  }
  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null
  ) {
    return !!((kA, kBl) => kA.length !== kBl ||
      kA.find(p => a[p] !== b[p])
    )(Object.keys(a), Object.keys(b).length)
  }
  return a !== b
}

function notEqualDeep (a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.length !== a.length ||
      !!a.find((o, i) => notEqualDeep(b[i], o))
  }
  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null
  ) {
    return !!((kA, kBl) => kA.length !== kBl ||
      kA.find(p => notEqualDeep(a[p], b[p]))
    )(Object.keys(a), Object.keys(b).length)
  }
  return a !== b
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

// Gets the synchroneous value of a neuron
function get (neuron) {
  let value = null
  neuron(v => { value = v })()
  return value
}

/**
 * async version of get()
 * n: number of values to skip,
 * Imagine a neuron value stream to be an array:
 * ['a', 'b', 'c']
 * setting `n` to 0 will return 'a', set it to 2 to get 'c'
*/
async function next (neuron, n = 1) {
  let value = null
  for await (const v of iter(neuron, n + 1)) value = v
  return value
}

/**
 * - {neuron} Neuron to generate from
 * - {nValues} Number of values to generate, 1 will yield 1 value.
 */
async function * iter (neuron, nValues = 5) { // set max to -1 for eternal loop
  const rQue = []
  const pQue = []
  oneMore()
  let i = 0
  const handler = v => {
    if (nValues === -1 || ++i < nValues) oneMore()
    const r = rQue.shift()
    if (r) r(v)
  }
  const unsub = neuron(handler)
  while (pQue.length) {
    const p = pQue.shift()
    const value = await p
    yield value
  }
  unsub()
  function oneMore () {
    let r = null
    const p = new Promise(resolve => { r = resolve })
    rQue.push(r)
    pQue.push(p)
  }
}
