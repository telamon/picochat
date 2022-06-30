# Kernel dox

## > 403 - "/blockend" off limits!

If you're reading this, then i think it's wierd that you don't have anything better to do.
The internet is vast, go explore =)

# Kernel API Documentation

Using react, check custom hooks located [here](/src/frontend/db.js)

## `const k = new Kernel(leveldb, opts)`
Initiates a new Kernel instance require's you to pass an instance of `levelup`

In tests:
```js
const levelup = require('levelup')
const memdown = require('memdown')
const db = levelup(memdown())
const k = new Kernel(db)
```

In browser:
```js
import levelup from 'levelup'
import leveljs from 'level-js'
const db = levelup(leveljs('picochat'))
const k = new Kernel(db)
```

## `await k.load()`
Returns a permanent promise that once loaded will short-circuit with current value.
Use in frontend or anywhere you need to know that the blockend is live and ready.

### `.then(hasProfile => console.log) // => true|false`
### `.catch(err => console.error) // Kernel panic!` _(very bad.)_

## `await k.register(profile)`
Generates a new keypair (tbc)
Creates a new feed with a single profile block

Example:
```js
await k.register({
  picture: '🦇', // Single emoji for now, webp/webm in future releases
  name: 'Batman',
  tagline: 'I love driving around at night',
	age: 42, // deprecated
	sex: 1  // 0: f, 1: m, 2: nb
})
```

## `const spawnWire = await k.enter('Foo Bar')`
Returns a factory-function that produces piconet-connectors.
The wire-plug can either be spliced directly to another kernel:

```js
spawnWireA({ client: true }).open(spawnWireB())
```
--or--

passed to `modem56`:

```js
const pubName = 'Foo Bar'
const spawnWire = await k.enter(pubName)
const modem = new Modem56()
modem.join(pubName, spawnWire) // hyperspace connected!
```

## `k.$peers(console.info) // => unsub() function`
An output neuron/reactive-store, emits arrays of currently
visible peers. Each peer is an object containing their
profile and public key (peerId)

Sample output:
```js
[
  {
    name: "Alice",
    picture: "👩‍🔬",
    pk: Uint8Array(32), // peerId
    tagline: "Has anyone seen Bob?",
    date: 1639002063745, // createdAt
    sex: 0,
    expiresAt: 1639003863745, // when peer will be evicted from network.
    state: "active",
    score: 30
  }
]
```

## `const chatId = await k.sendVibe(peerId)`

Each peer can only have 1 active vibe at a time.
Before sending the next vibe a peer has to wait until
the previous one times out and the network rollbacks your head.

_(The vibe is encrypted, nobody can see who you sent it too until
they choose to reply.)_

## `k.$vibes(console.info) // => unsub() function`

Emits arrays of currently active vibes and their states.
Vibes you've sent and vibes you've received.
Each vibe is an object, sidenote: `vibe.id` is the same as `chatId`

### `vibe.state`

|state|desc|
|--|--|
|`loading`|Object is being fetched from database|
|`waiting_local`| Vibe received, waiting for local human respond|
|`waiting_remote`| Vibe sent, waiting for remote peer respond|
|`match`|Both parties gave their consent, use `k.$chat(vibe.id)`

### `vibe.peer`
The remote peer profile. same as `k.$peer(vibe.peerId)(console.info)`

## `await k.respondVibe(chatId, like = true)`
Responds to vibe. explicitly calling respond vibe with `false` rejects the vibe instead of accepting it.
Given a response the vibe should now have state either `match` or `rejected`

## `k.$chat(chatId)(console.info) // => unsub() function`

Emits an chat object

Given
```js
const chat = next(k.$chat(chatId))
// TODO: dump a chat example
```

### `chat.myTurn // => true/false`
Bound actions only work when it's your turn.

### `chat.messages // => []`
Array of message objects, should be pretty selfexplanatory once inspected.

### `chat.expiresAt`
Timestamp, network evicts the chat when it expires,
this timestamp is updated every time a new block is appended.

### `chat.health // Number: 3`
Every chat-session starts with 3 health points, using `chat.pass()` decreases it
and `chat.sendMessage()` increases health back to starting value.

### `await chat.sendMessage('Hello Hyperverse!')`
Creates a new message block and publishes it to the network.
Adds 1 more minute to the chat's expiry date.
3 messages heals 1 heart.

_Message contents are encrypted between the two peers._

### `await chat.pass()`
Passes turn to opponent.
Consumes 1 heart, adds 1 more minute to the chat's expiry date.

_Pass-blocks are not encrypted._

### `await chat.bye(gesture = 0)`
Finalizes chat on peer's end. No further messages can be sent on this chat object.
If `chat.state` is `active` it goes to `finalizing` meaning you initated the farewell.
When state is `finalizing` it goes to `end` after a successful call, meaning you responded to a farewell.

Gesture (not entierly thought through):

|code|desc|
|--|--|
|0|Peace|
|1|Understanding|
|2|Love|

## `k.$connections(console.info) // => unsub() function`
Emits lists of currently connected piconet wires.
The most interesting with this output is probably "how many" peers we're currently
connected to. Docs for piconet 3.x are missing.

> End of Dox
