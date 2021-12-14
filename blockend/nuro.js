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
  settle,
  iter,
  nfo
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
      if (disconnect) disconnect()
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
        fired = true
        if (!disconnected) syn(v)
      })
    }
    if (!fired) syn(clone(value)) // Note: disconnected is always false here
    return () => {
      disconnected = true
      unsub()
    }
  }
}

/*
 * Debug neuron, logs all signals
 */
let __nfoCtr = 0
const __pal = Array.from(new Array(8)).map((_, bg) => Array.from(new Array(8)).map((_, fg) => `\x1b[0;${30 + fg};${40 + bg}m`))
module.exports.V = 1 // VERBOSITY level
function nfo (neuron, name) {
  if (!module.exports.V) return neuron // Completely bypass NFO when V is zero
  const ni = __nfoCtr++
  if (!name) name = `NFO${pn(ni)}`
  const nlog = console.info.bind(null, c(name, 0, ni))
  let s = 0
  return syn => {
    let i = 0
    const log = nlog.bind(null, c(`SYN${pn(s++)}`, 0, ni))
    log(`>>${pn(i)}>> connected`)
    const unsub = neuron(v => {
      log(`!!${pn(i++)}!! `, v)
      syn(v)
    })
    return () => {
      unsub()
      log(`<<${pn(i)}<< disconnected`)
    }
  }
  function pn (n, p = 2) { return (n + '').padStart(p, '0') }
  function c (s, b = 0, f = 0) { return `${__pal[b % 8][f % 8]}${s}\x1b[0m` }
}

function gate (neuron, shallow = false) {
  const check = typeof shallow === 'function'
    ? shallow
    : !shallow
        ? notEqualDeep
        : notEqual

  return function NoiseGate (syn) {
    let value
    let first = true
    return neuron(v => {
      const dirty = check(v, value)
      // console.info(`nuro:gate() ${dirty ? '>>PASS>>' : '||HOLD||'}\n>>> NEXT\n`, v, '\n===\n', value, '\n<<< PREV')
      if (first || dirty) {
        first = false
        value = clone(v)
        syn(v)
      }
    })
  }
}

// Buffers a signal and outputs last value
// !WARNING!
// Use with care, this neuron introduces unchecked asyncronity into
// your path causing racing conditions along the way.
// Only use is for buffering final outputs to silly frameworks such as react
// that render with a built-in rising-edge buffer
function settle (neuron, debounceMs = 10, risingEdge = false) {
  return function DebouncedSignal (syn) {
    let value
    let tid
    let first = true
    const unsub = neuron(v => {
      value = v
      if (risingEdge && first) {
        first = false
        syn(value)
      }
      if (tid) clearTimeout(tid)
      tid = setTimeout(() => {
        tid = null
        syn(value)
      }, debounceMs)
    })
    return () => {
      if (unsub) unsub()
      if (tid) clearTimeout(tid)
    }
  }
}

/**
 * Produces a shallow clone of objects and arrays
 */
function clone (o) {
  if (Array.isArray(o)) return [...o]
  if (typeof o === 'object' && o !== null) return { ...o }
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
function _isSync (neuron) { // Synchroneous version that throws errors on violation.
  let ii = false
  let set = () => { ii = true }
  neuron(() => set())()
  set = () => { throw new Error('NeuronNotSync, subscription invoked after unsubscribe()') }
  return ii
}

async function isSync (neuron, ms = 100) {
  let fired = false
  let aFired = false
  let set = () => { fired = true }
  neuron(() => set())()
  let unlock = null
  const mutex = new Promise((resolve) => { unlock = resolve })
  set = () => { aFired = true; unlock() } // rewrite set
  let tid = setTimeout(() => { tid = null; unlock() }, ms) // 100ms plenty of time to resolve
  await mutex
  if (tid) clearTimeout(tid)
  else if (!fired && !aFired) throw new Error('Neuron did not fire during grace period')
  return fired && !aFired
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
async function next (neuron, n = 1, inspect = false) {
  let value = null
  if (inspect) neuron = nfo(neuron, inspect)
  for await (const v of iter(neuron, n + 1)) value = v
  return value
}

// TODO: wishlist for santa-claus
// async function settle (neuron, timeout = 30) { ... } // debounced version of next

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
