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

const { combine, mute, init, gate } = require('../nuro')
/* A reactive store whose value is conversation object
 * containing all then necesarry tidbits and bound actions
 * to progress the conversation
 */
module.exports = function ChatModule () {
  return {
    $chat (chatId) {
      chatId = toBuffer(chatId)
      let localPair = null

      // Actions
      const _send = async (message, pass = false) => {
        if (!cache.myTurn) throw new Error('NotYourTurn')
        if (!pass && typeof message !== 'string') throw new Error('Message should be a string')
        if (!pass && !message.length) throw new Error('EmptyMessage')
        const pk = await this._getRemoteChatKey(chatId) // Remote Public Key
        const branch = await this.repo.loadFeed(cache.head)
        const content = pass ? PASS_TURN : seal(Buffer.from(message), pk)
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
        const branch = await this.repo.loadFeed(cache.head)
        if (!branch) return console.error('branch dissapeared, expected head sig:', cache.head?.toString('hex'))
        // console.log('bye() invoked current chainState:')
        // branch.inspect()
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
        else if (vibe.state === 'rejected') chat.state = 'inactive'
        chat.createdAt = lChat ? lChat.createdAt : vibe.createdAt
        chat.updatedAt = lChat ? lChat.updatedAt : vibe.updatedAt
        chat.expiresAt = lChat ? lChat.expiresAt : vibe.expiresAt
        chat.peerId = vibe.peerId
        chat.peer = vibe.peer

        if (!lChat && vibe.state === 'match') {
          // First to vibe is first to write
          chat.myTurn = vibe.initiator === 'local'
        }
        chat.health = 3
        if (!lChat) return chat
        chat.head = lChat.head

        // Update headers
        chat.state = lChat.state
        if (chat.state === 'active' && chat.expiresAt < Date.now()) chat.state = 'expired'

        chat.mLength = lChat.mLength
        chat.health = Math.floor(lChat.hp)
        chat.myTurn = !((lChat.mLength % 2) ^ (this.pk.equals(lChat.b) ? 1 : 0))
        if (chat.state === 'end') chat.myTurn = false

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
    }
  }
}
