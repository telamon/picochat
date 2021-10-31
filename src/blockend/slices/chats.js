const {
  TYPE_VIBE,
  TYPE_MESSAGE,
  PASS_TURN,
  decodeBlock,
  unseal
} = require('../util')

function ConversationCtrl () {
  const mkChat = chatId => ({

  })

  return {
    name: 'chats',

    initialValue: {
      heads: {}
    },

    filter ({ block, parentBlock, state, root }) {
      const data = decodeBlock(block.body)
      if (data.type !== TYPE_MESSAGE) return true // Ignore non-profile blocks.
      const parentType = parentBlock && decodeBlock(parentBlock.body).type
      if (parentType !== TYPE_MESSAGE && parentType !== TYPE_VIBE) return `Invalid parent type: ${parentType}`

      if (block.key.equals(parentBlock.key)) return 'MonologueNotAllowed'

      // const ownKey = root.peer.pk
      // const isParticipating = ownKey.equals(block.key) || ownKey.equals(parentBlock.key)

      // Reject 3rdParty blocks
      debugger

      return false // All good, accept block
    },

    reducer ({ block, parentBlock, root, state }) {
      const data = decodeBlock(block.body)
      const chatId = 'findChatIdByParent.key'
      const chat = state[chatId] = state[chatId] || mkChat(chatId)
      debugger
    }
  }
}

module.exports = ConversationCtrl
