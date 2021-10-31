const {
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  PASS_TURN,
  decodeBlock
} = require('../util')

function ConversationCtrl () {
  const mkChat = chatId => ({
    id: chatId,
    messages: [],
    updatedAt: 0,
    state: 'active'
  })

  return {
    name: 'chats',

    initialValue: {
      chats: {},
      heads: {},
      own: []
    },

    filter ({ block, parentBlock, state, root }) {
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_MESSAGE) return true // Ignore non-profile blocks.
      const parentType = parentBlock && decodeBlock(parentBlock.body).type
      if (parentType !== TYPE_MESSAGE && parentType !== TYPE_VIBE_RESP) return `Invalid parent type: ${parentType}`

      const from = block.key
      if (from.equals(parentBlock.key)) return 'MonologueNotAllowed'

      // const ownKey = root.peer.pk
      // const isParticipating = ownKey.equals(block.key) || ownKey.equals(parentBlock.key)

      // Reject 3rdParty blocks
      if (parentType === TYPE_VIBE_RESP) {
        // need to Lookup in matches registry
        const chatId = parentBlock.parentSig
        const match = root.vibes.matches[chatId.toString('hex')]
        if (match.state !== 'match') return 'MessagingNotAllowed'
        if (![match.a, match.b].find(k => from.equals(k))) return 'NotYourConversation'
      } else {
        const chatId = state.heads[block.parentSig.toString('hex')]
        if (!chatId) return 'ConversationNotFound'
        const chat = state.chats[chatId.toString('hex')]
        const nextAuthor = chat.mLength % 2 ? chat.b : chat.a
        if (!from.equals(nextAuthor)) return 'NotYourConversation'
      }

      return false // All good, accept block
    },

    reducer ({ block, parentBlock, root, state }) {
      const data = decodeBlock(block.body)
      const parentType = decodeBlock(parentBlock.body).type
      const peerId = root.peer.pk
      const from = block.key
      const turnPassed = PASS_TURN.equals(data.content)
      let chatId = null

      if (parentType === TYPE_VIBE_RESP) chatId = parentBlock.parentSig
      else chatId = state.heads[block.parentSig.toString('hex')]

      const indexKey = chatId.toString('hex')
      // Initialize entry from vibes.matches register
      if (parentType === TYPE_VIBE_RESP) {
        const match = root.vibes.matches[indexKey]
        const chat = mkChat(chatId)
        chat.a = match.a
        chat.b = match.b
        chat.remoteBox = match.remoteBox
        chat.createdAt = match.createdAt
        chat.mLength = 0
        state.chats[indexKey] = chat
      }

      const chat = state.chats[indexKey]
      chat.head = block.sig

      chat.updatedAt = data.date
      chat.mLength++ // Always availble compared to messages array that's only indexed for own conversations
      chat.own = !![chat.a, chat.b].find(k => peerId.equals(k))
      if (chat.own) {
        // Push messages
        const isSent = peerId.equals(from)
        chat.messages.push({
          type: isSent ? 'sent' : 'received',
          date: data.date,
          content: !isSent ? data.content : null, // contents are encrypted, decrypt here?
          pass: turnPassed,
          sig: block.sig // when type is sent, use signature to lookup decrypted copy of contents.
        })
      }

      // Insert into "own" register
      if (chat.own && !state.own.find(b => b.equals(chatId))) state.own.push(chatId)

      // Bump head of findChatIdBy(parentSig) index
      // console.log('BUMPHEAD', root.peer.name, block.parentSig.hexSlice(0, 10), ' => ', block.sig.hexSlice(0, 10))
      delete state.heads[block.parentSig.toString('hex')]
      state.heads[block.sig.toString('hex')] = chatId
      return state
    }
  }
}

module.exports = ConversationCtrl
