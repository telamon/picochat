const {
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  PASS_TURN,
  decodeBlock,
  unseal
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
      heads: {}
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
        debugger
        // Ensure reciever != sender
        if (from.equals(parentBlock.key)) return 'NotYourTurn'
      }

      return false // All good, accept block
    },

    reducer ({ block, parentBlock, root, state }) {
      const data = decodeBlock(block.body)
      const parentType = decodeBlock(parentBlock.body).type
      const peerId = root.peer.pk
      const from = block.key
      let chatId = null

      if (parentType === TYPE_VIBE_RESP) chatId = parentBlock.parentSig
      else {
        // lookup chatId by block.parentSig
        debugger
      }

      const indexKey = chatId.toString('hex')
      // Initialize entry from vibes.matches register
      if (parentType === TYPE_VIBE_RESP) {
        const match = root.vibes.matches[indexKey]
        const chat = mkChat(chatId)
        chat.a = match.a
        chat.b = match.b
        chat.remoteBox = match.remoteBox
        chat.createdAt = match.createdAt
        state.chats[indexKey] = chat
      }

      const chat = state.chats[indexKey]
      // Push messages
      chat.updatedAt = data.date

      chat.own = !![chat.a, chat.b].find(k => peerId.equals(k))
      if (chat.own) {
        const isARemote = chat.a.equals(peerId)
        const isToMe = isARemote && chat.a.equals(from)

        chat.messages.push({
          type: isToMe ? 'received' : 'sent',
          date: data.date,
          content: isToMe ? data.content : null, // contents are encrypted, decrypt here?
          sig: block.sig // when type is sent, use signature to lookup decrypted copy of contents.
        })
      }

      // Bump head of findChatIdBy(parentSig) index
      delete state.heads[block.parentSig.toString('hex')]
      state.heads[block.sig.toString('hex')] = chatId
      return state
    }
  }
}

module.exports = ConversationCtrl
