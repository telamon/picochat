const D = require('debug')('picochat:mod:chat')
const {
  TYPE_MESSAGE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  PASS_TURN,
  PEACE, LOVE,
  UNDERSTANDING,
  seal,
  unseal,
  toBuffer
} = require('../util')
const { feedToGraph } = require('../game')

const { combine, mute, init, gate } = require('../nuro')

/* Source of truth: Chat States
 *
  | STATE      | DESCRIPTION                           |
  |------------+---------------------------------------|
  | loading    | chat found, register join in progress |
  | error      | Failed to produce neuron              |
  | active     | Chat in progress                      |
  | rejected   | Vibe was rejected                     |
  | expired    | Chat ran out of time                  |
  | finalizing | One of players has ended              |
  | end        | Second player responded to bye        |
 */

/* A reactive store whose value is conversation object
 * containing all then necesarry tidbits and bound actions
 * to progress the conversation
 */
module.exports = function ChatModule () {
  return {
    $chats () {
      // For now just return list of vibes with 'match' state
      return mute(this.$vibes(), vibes =>
        vibes.filter(v => v.state === 'match')
      )
    },

    $chat (chatId) {
      chatId = toBuffer(chatId)
      let localPair = null

      // Actions
      const _send = async (message, pass = false) => {
        if (!cache.myTurn) throw new Error('NotYourTurn')
        if (!pass && typeof message !== 'string') throw new Error('Message should be a string')
        if (!pass && !message.length) throw new Error('EmptyMessage')
        const pk = await this._getRemoteChatKey(chatId) // Remote Public Key

        // Not sure which feed load is correct. loadFeed is def more efficient.
        const branch = await this.repo.loadFeed(cache.head)
        // const branch = await this.loadChat(chatId) // await this.repo.loadFeed(cache.head)

        const content = pass ? PASS_TURN : seal(Buffer.from(message), pk)
        // console.log('Appending message to', feedToGraph(branch))
        await this._createBlock(branch, TYPE_MESSAGE, { content })
        // Branch "hopefully" contains new block, if not use return of createBlock() in future
        if (!pass) await this._setMessageBody(branch.last.sig, Buffer.from(message))
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

        // loadFeed() fails tests. cached head seems outdated.
        const branch = await this.loadChat(chatId) // await this.repo.loadFeed(cache.head)
        if (!branch) return console.error('branch dissapeared, expected head sig:', cache.head?.toString('hex'))

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
        initiator: false,
        myTurn: null,
        peerId: null,
        peer: null,
        mLength: 0,
        messages: [],
        updatedAt: 0,
        createdAt: 0,
        expiresAt: 0,
        health: -1,
        errorMessage: null,
        head: null,
        send,
        pass,
        bye
      }
      let cache = chat
      const computeChat = async ([vibe, chats]) => {
        const lChat = chats.chats[chatId.toString('hex')]

        // All conversations must start with a vibe
        if (!vibe || vibe.state === 'error') {
          chat.state = 'error'
          chat.errorMessage = 'ChatNotFound'
          return chat // TODO return  ERR_CHAT_NOT_FOUND causes test-fail
        }
        // let vibe load before processing chat
        if (vibe.state === 'loading') return chat

        chat.head = vibe.head
        if (vibe.state === 'match') chat.state = 'active'
        else if (vibe.state === 'rejected') chat.state = 'rejected'
        chat.createdAt = lChat ? lChat.createdAt : vibe.createdAt
        chat.updatedAt = lChat ? lChat.updatedAt : vibe.updatedAt
        chat.expiresAt = lChat ? lChat.expiresAt : vibe.expiresAt
        chat.peerId = vibe.peerId
        chat.peer = vibe.peer
        chat.initiator = vibe.initiator
        chat.myTurn = vibe.myTurn
        chat.health = vibe.health

        if (!lChat) return chat
        chat.head = lChat.head
        chat.graph = lChat.graph
        // chat.hgraph = rewrite(lChat.graph) // rewrite where needed for now

        // Update headers
        chat.state = lChat.state
        if (chat.state === 'active' && chat.expiresAt < Date.now()) chat.state = 'expired'

        chat.mLength = lChat.mLength

        // Skip message decryption if no new messages available
        if (chat.messages.length === lChat.messages.length) return chat
        // Decrypt messages
        try {
          if (!localPair) localPair = await this._getLocalChatKey(chatId)
          chat.messages = [...chat.messages] // copy message array
          // loop through unread messages
          for (let i = chat.messages.length; i < lChat.messages.length; i++) {
            const msg = { ...lChat.messages[i] } // copy lowlevel message
            if (!msg.pass) {
              if (msg.type === 'received') {
                msg.content = unseal(msg.content, localPair.sk, localPair.pk).toString()
              } else {
                msg.content = await this._getMessageBody(msg.sig)
              }
            } else msg.content = PASS_TURN.toString()
            chat.messages[i] = msg
          }
        } catch (err) { console.error('Message decryption failed', err) }
        cache = chat
        return chat
      }
      return gate(
        init(chat,
          mute(
            combine(
              this._vibe(chatId),
              s => this.store.on('chats', s)
            ),
            computeChat
          )
        )
      )
    },

    async loadChat (chatId) {
      chatId = toBuffer(chatId)
      const str = chatId.toString('hex')
      let head = null
      const v = this.store.state.vibes.matches[str]
      head = v?.response || v?.chatId
      if (!v) D('vibe does not exist for chatId:', str)

      const c = this.store.state.chats.chats[str]
      if (!v && !c) D('conversation not found %h', chatId)
      head = c?.head || head
      if (!head) return
      const search = await this._tracePath(head)
      return search.feed
    },

    async _inspectChat (chatId, dump = false) {
      const f = await this.loadChat(chatId)
      console.log(feedToGraph(f))
      if (dump) f.inspect()
    }
  }
}
