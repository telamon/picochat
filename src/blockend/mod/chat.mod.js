const {
  TYPE_MESSAGE,
  PASS_TURN,
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
  const send = async (message, pass = false) => {
    if (!chat.myTurn) throw new Error('NotYourTurn')
    if (!pass && typeof message !== 'string') throw new Error('Message should be a string')
    if (!pass && !message.length) throw new Error('EmptyMessage')
    // const { sk } = await this._getLocalChatKey(chatId) // Local Secret Key
    const pk = await this._getRemoteChatKey(chatId) // Remote Public Key
    const kHead = this.store.state.chats.chats[chatId.toString('hex')]?.head
    const branch = await this.repo.loadFeed(kHead || head)

    const content = pass ? PASS_TURN : seal(toBuffer(message), pk)
    await this._createBlock(branch, TYPE_MESSAGE, { content })
    // Branch "hopefully" contains new block, if not use return of createBlock() in future
    if (!pass) await this._setMessageBody(branch.last.sig, message)
  }
  const pass = async () => {
    if (!chat.myTurn) throw new Error('NotYourTurn')
    return send(0, true)
  }
  const bye = async () => {} // TODO: black magic

  // State
  let dirty = true
  const chat = {
    id: chatId,
    state: 'init',
    myTurn: true,
    mLength: 0,
    messages: [],
    updatedAt: 0,
    createdAt: 0,
    remoteBox: null,
    send,
    pass,
    bye
  }

  const vibesUnsub = this.vibes(vibes => {
    const vibe = vibes.find(v => chatId.equals(v.id))
    // All conversations must start with a vibe
    if (!vibe) set({ state: 'error', message: 'VibeNotFound' })
    head = vibe.head
    if (vibe.state === 'match') set({ state: 'active' })
    else if (vibe.state === 'rejected') set({ state: 'inactive' })
    set({
      updatedAt: Math.max(chat.updatedAt, vibe.updatedAt),
      createdAt: vibe.createdAt,
      remoteBox: vibe.remoteBox
    })
    if (!chat.mLength && vibe.state === 'match') {
      // First to vibe is first to write
      set({ myTurn: vibe.initiator === 'local' })
      vibesUnsub() // Once a vibe reaches state match it will no longer update.
    }
    notify()
  })

  const subs = [
    vibesUnsub,
    this.store.on('chats', state => {
      // If head of an owned conversation was updated, then set and notify
      const low = state.chats[chatId.toString('hex')] // lowlevel chat
      if (!low) return
      const myTurn = !((low.mLength % 2) ^ (this.pk.equals(low.b) ? 1 : 0))
      // Update headers
      set({
        state: low.state,
        updatedAt: low.updatedAt,
        mLength: low.mLength,
        head: low.head,
        myTurn
      })

      if (chat.messages.length === low.messages.length) {
        return notify()
      }

      (async () => {
        if (!localPair) localPair = await this._getLocalChatKey(chatId)
        const unread = []
        for (let i = chat.messages.length; i < low.messages.length; i++) {
          const msg = { ...low.messages[i] }
          head = msg.sig
          if (msg.type === 'received') {
            msg.content = unseal(msg.content, localPair.sk, localPair.pk).toString()
          } else {
            msg.content = await this._getMessageBody(msg.sig)
          }
          unread.push(msg)
        }
        return unread
      })()
        .catch(console.error)
        .then(unread => {
          if (unread && unread.length) set({ messages: [...chat.messages, ...unread] })
          notify()
        })
    })
  ]

  return () => { for (const unsub of subs) unsub() }
  function notify (force = false) {
    if (!force && !dirty) return
    dirty = false
    subscriber(chat)
  }
  function set (patch) {
    for (const k in patch) {
      if (chat[k] !== patch[k]) dirty = true
      chat[k] = patch[k]
    }
  }
}
