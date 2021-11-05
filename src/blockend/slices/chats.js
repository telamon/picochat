const {
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  PASS_TURN,
  decodeBlock
} = require('../util')

function ConversationCtrl (opts = {}) {
  const {
    timeout: MessageTimeout,
    health: InitialHealth,
    regenerate: RegenerateAmount
  } = {
    timeout: 30 * 60 * 1000, // 3 minutes
    health: 3, // <3 <3 <3
    regenerate: 0.3,
    ...opts
  }

  const now = () => new Date().getTime()
  const mkChat = chatId => ({
    id: chatId,
    messages: [],
    updatedAt: 0,
    state: 'active',
    a: null, // Peer id
    b: null, // Peer id
    hp: InitialHealth, // Mana/ Conversation health
    aEnd: -1,
    bEnd: -1
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
      const { type } = data
      if (!~[TYPE_MESSAGE, TYPE_BYE, TYPE_BYE_RESP].indexOf(type)) return true
      const parentType = parentBlock && decodeBlock(parentBlock.body).type

      if (
        // message onto message or vibe_resp
        (type === TYPE_MESSAGE && parentType !== TYPE_MESSAGE && parentType !== TYPE_VIBE_RESP) ||
        // bye onto message
        (type === TYPE_BYE && parentType !== TYPE_MESSAGE) ||
        // bye-response onto bye
        (type === TYPE_BYE_RESP && parentType !== TYPE_BYE)
      ) return `Invalid parent type: ${parentType}`

      const from = block.key
      if (from.equals(parentBlock.key)) return 'MonologueNotAllowed'

      // Reject 3rdParty blocks
      if (parentType === TYPE_VIBE_RESP) {
        // need to Lookup in matches registry
        const chatId = parentBlock.parentSig
        const match = root.vibes.matches[chatId.toString('hex')]
        if (!match) return true // Unknown conversation TODO: cache block for later (partially available chain)
        if (match.state !== 'match') return 'MessagingNotAllowed'
        if (![match.a, match.b].find(k => from.equals(k))) return 'NotYourConversation'
        if (match.updatedAt < now() - MessageTimeout) return 'ConversationTimeout'
      } else { // TYPE_MESSAGE || TYPE_BYE
        const chatId = state.heads[block.parentSig.toString('hex')]
        if (!chatId) return 'ConversationNotFound'
        const chat = state.chats[chatId.toString('hex')]
        const nextAuthor = chat.mLength % 2 ? chat.b : chat.a
        if (!from.equals(nextAuthor)) return 'NotYourConversation'
        if (chat.updatedAt < now() - MessageTimeout) return 'ConversationTimeout'
        if (type !== TYPE_BYE_RESP && chat.state !== 'active') return 'ConversationEnded'
        else if (type === TYPE_BYE_RESP && chat.state !== 'finalizing') return 'InvalidState'
      }
      return false // All good, accept block
    },

    reducer ({ block, parentBlock, root, state }) {
      const data = decodeBlock(block.body)
      const { type } = data
      const parentType = decodeBlock(parentBlock.body).type
      const peerId = root.peer.pk
      const from = block.key

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

      if (TYPE_MESSAGE === type) {
        const turnPassed = PASS_TURN.equals(data.content)
        if (turnPassed && --chat.hp < 1) {
          chat.state = 'exhausted'
        } else if (!turnPassed) {
          // Regenerate
          chat.hp = Math.min(RegenerateAmount + chat.hp, InitialHealth)
        }

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
      } else {
        if (TYPE_BYE === type) chat.state = 'finalizing'
        else chat.state = 'end'
        if (chat.a.equals(from)) chat.aEnd = data.gesture
        else chat.bEnd = data.gesture
        //console.log('ENDING: ', root.peer.name, type, chat.state, chat.aEnd, chat.bEnd)
      }

      // Bump head of findChatIdBy(parentSig) index
      // console.log('BUMPHEAD', root.peer.name, block.parentSig.hexSlice(0, 10), ' => ', block.sig.hexSlice(0, 10))
      delete state.heads[block.parentSig.toString('hex')]
      state.heads[block.sig.toString('hex')] = chatId
      return state
    }
  }
}

/*
 * Note about the "pass-turn" mechanizm:
 * The original idea is that silence is an important human response with an implicit value.
 * In this game I would like to use it as a mechanic to detect a goodbye.
 * At first I thought that 3 consecutive passes from one party means that they've run out of words.
 * But writing that code made me realize how boring this feature would be;
 * So here's a crazy idea, what if the turn-pass would be seen as a shared resource that eventually
 * replenishes with conversation progress. It's just as important to dare using the pass as it is saving it.
 * Especially if we attach some kind of punishment like box-secrets being revealed when passTurn is exhausted.
 * *evil-imp-grin*
 *
 * Usecases for pass-turn:
 * - Alice wants to talk to Bob but is too shy to speak first, she initiates the match but then hits pass to let Bob lead the conversation.
 * - Bob is rewarded with a pass for an impolite remark.
 * - Alice is having a monologue (talks to much/ self centered)
 *
 * If you haven't noticed already noticed robots never know when to shut up.
 */

module.exports = ConversationCtrl
