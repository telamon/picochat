const {
  TYPE_MESSAGE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  PASS_TURN,
  PEACE,
  LOVE,
  UNDERSTANDING,
  seal,
  unseal,
  toBuffer
} = require('../util')

/* A reactive store whose value is conversation object
 * containing all then necesarry tidbits and bound actions
 * to progress the conversation
 */
module.exports = function getChat (chatId, subscriber) {
  chatId = toBuffer(chatId)
  let head = chatId
  let localPair = null

  // Actions
  const _send = async (message, pass = false) => {
    if (!cache.myTurn) throw new Error('NotYourTurn')
    if (!pass && typeof message !== 'string') throw new Error('Message should be a string')
    if (!pass && !message.length) throw new Error('EmptyMessage')
    const pk = await this._getRemoteChatKey(chatId) // Remote Public Key
    const branch = await this.repo.loadFeed(head)
    const content = pass ? PASS_TURN : seal(toBuffer(message), pk)
    await this._createBlock(branch, TYPE_MESSAGE, { content })
    // Branch "hopefully" contains new block, if not use return of createBlock() in future
    if (!pass) await this._setMessageBody(branch.last.sig, message)
  }
  const send = async message => _send(message)
  const pass = async () => {
    if (!cache.myTurn) throw new Error('NotYourTurn')
    return _send(0, true)
  }

  const bye = async gesture => {
    if (!cache.myTurn) throw new Error('NotYourTurn')
    if (!~[PEACE, LOVE, UNDERSTANDING].indexOf(gesture)) throw new Error('InvalidGesture')
    if (!~['active', 'finalizing'].indexOf(cache.state)) throw new Error('InvalidState')
    const branch = await this.repo.loadFeed(head)
    await this._createBlock(branch, cache.state === 'active' ? TYPE_BYE : TYPE_BYE_RESP,
      {
        gesture
        // TBD
      }
    )
  }
  const chat = {
    id: chatId,
    state: 'loading',
    myTurn: true,
    peer: null,
    mLength: 0,
    messages: [],
    updatedAt: 0,
    createdAt: 0,
    health: 3, // TODO: initial health prop is in chats reducer
    errorMessage: null,
    send,
    pass,
    bye
  }
  const cache = chat
  const set = subscriber
  // State
  const unsubCombined = combine(
    this.vibes.bind(this),
    s => this.store.on('chats', s),
    ($vibes, $chats) => {
      const vibe = $vibes.find(v => chatId.equals(v.id))
      const lChat = $chats.chats[chatId.toString('hex')]

      // All conversations must start with a vibe
      if (!vibe) {
        chat.state = 'error'
        chat.errorMessage = 'VibeNotFound'
        return set(chat)
      }

      head = vibe.head
      if (vibe.state === 'match') chat.state = 'active'
      else if (vibe.state === 'rejected') chat.state = 'inactive'
      chat.updatedAt = Math.max(chat.updatedAt, vibe.updatedAt)
      chat.createdAt = vibe.createdAt
      chat.peer = vibe.peer

      if (!lChat && vibe.state === 'match') {
        // First to vibe is first to write
        chat.myTurn = vibe.initiator === 'local'
      }
      if (!lChat) return set(chat)
      head = lChat.head

      // Update headers
      chat.state = lChat.state
      chat.updatedAt = lChat.updatedAt
      chat.mLength = lChat.mLength
      chat.health = Math.floor(lChat.hp)
      chat.myTurn = !((lChat.mLength % 2) ^ (this.pk.equals(lChat.b) ? 1 : 0))

      // Skip message decryption if no new messages available
      if (chat.messages.length === lChat.messages.length) return set(chat)

      const decryptMessages = async () => {
        if (!localPair) localPair = await this._getLocalChatKey(chatId)
        const unread = []
        for (let i = chat.messages.length; i < lChat.messages.length; i++) {
          const msg = { ...lChat.messages[i] } // Make a copy
          head = msg.sig
          if (!msg.pass) {
            if (msg.type === 'received') {
              msg.content = unseal(msg.content, localPair.sk, localPair.pk).toString()
            } else {
              msg.content = await this._getMessageBody(msg.sig)
            }
          } else msg.content = PASS_TURN.toString()
          unread.push(msg)
        }
        return unread
      }

      decryptMessages()
        .catch(err => {
          chat.state = 'error'
          chat.errorMessage = err.message
          console.error(err)
        })
        .then(unread => {
          // TODO: write proper tests for the functional stores
          if (unread && unread.length) {
            chat.messages = [...chat.messages, ...unread]
            set(chat)
          }
        })
      // return set(chat) // initial value
    })
  return unsubCombined
}

/**
 * Gates first notify until all store have returned a value, similar to Promise.all
 */
function combine (...stores) {
  const notify = stores.pop()
  if (!Array.isArray(stores) || !stores.length) throw new Error('A list of stores is required')
  if (typeof notify !== 'function') throw new Error('Derivation function required')

  const loaded = []
  const values = []
  let remaining = stores.length

  const subscriptions = []
  for (let i = 0; i < stores.length; i++) {
    subscriptions.push(stores[i](handler.bind(null, i)))
  }
  return () => {
    for (const unsub of subscriptions) unsub()
  }
  function handler (i, val) {
    if (!loaded[i]) {
      loaded[i] = true
      remaining--
    }
    values[i] = val
    if (!remaining) notify(...values)
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

// TODO: Use in derived to cache computed values across multiple subscribers
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

function get (store) {
  let value = null
  store(v => { value = v })()
  return value
}
