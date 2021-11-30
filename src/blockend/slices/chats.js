const D = require('debug')('picochat:slice:chat')
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
    ttl: ChatTimeout,
    blockReward: BlockReward,
    health: InitialHealth,
    regenerate: RegenerateAmount
  } = {
    ttl: 3 * 60 * 1000, // 3 minutes
    blockReward: 60 * 1000, // Each successfull block adds 1 minute
    health: 3, // <3 <3 <3
    regenerate: 0.3,
    ...opts
  }

  const now = () => new Date().getTime()
  const mkChat = chatId => ({
    id: chatId,
    head: null,
    messages: [],
    expiresAt: 0,
    updatedAt: 0,
    state: 'active',
    a: null, // Peer id
    b: null, // Peer id
    hp: InitialHealth, // Mana/ Conversation health
    aEnd: -1,
    bEnd: -1
  })

  const mkStats = peerId => ({
    peerId,
    lastSeen: 0,
    nMessages: 0,
    nExhausted: 0,
    nPassed: 0,
    nEnded: 0,
    nStarted: 0,
    blocks: 0,
    blockSize: 0,
    hpRegenerated: 0
  })

  return {
    name: 'chats',

    initialValue: {
      chats: {},
      heads: {},
      own: [],
      stats: {} // Indexed by peer
    },

    filter ({ block, parentBlock, state, root }) {
      const data = decodeBlock(block.body)
      const { type } = data
      if (!~[TYPE_MESSAGE, TYPE_BYE, TYPE_BYE_RESP].indexOf(type)) return true
      const parentType = parentBlock && decodeBlock(parentBlock.body).type
      D('[%s] FilterOP: %s %h <-- %s %h', root.peer.name, parentType, parentBlock.sig, type, block.sig)
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
        if (match.expiresAt < now()) return 'ConversationTimeout'
      } else { // TYPE_MESSAGE || TYPE_BYE
        const chatId = state.heads[block.parentSig.toString('hex')]
        if (!chatId) return 'ConversationNotFound'
        const chat = state.chats[chatId.toString('hex')]
        const nextAuthor = chat.mLength % 2 ? chat.b : chat.a
        if (!from.equals(nextAuthor)) return 'NotYourConversation'
        if (chat.expiresAt < now()) return 'ConversationTimeout'
        if (type !== TYPE_BYE_RESP && chat.state !== 'active') return 'ConversationEnded'
        else if (type === TYPE_BYE_RESP && chat.state !== 'finalizing') return 'InvalidState'
      }
      return false // All good, accept block
    },

    reducer ({ block, parentBlock, root, state, schedule }) {
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
      chat.expiresAt = chat.createdAt + ChatTimeout + (chat.mLength * BlockReward)

      const authorId = block.key.toString('hex')
      let stats = state.stats[authorId]
      if (!stats) {
        stats = state.stats[authorId] = mkStats(block.key)
        stats.nStarted++
        D('[%s] Initating new stats for %h', root.peer.name, block.key)
      }
      stats.lastSeen = Math.max(stats.lastSeen, data.date)
      stats.nMessages++
      stats.blocks++
      stats.blockSize += block.body.length

      if (TYPE_MESSAGE === type) {
        const turnPassed = PASS_TURN.equals(data.content)
        turnPassed && stats.nPassed++
        if (turnPassed && --chat.hp < 1) {
          chat.state = 'exhausted'
          stats.nExhausted++
        } else if (!turnPassed) {
          // Regenerate
          chat.hp = Math.min(RegenerateAmount + chat.hp, InitialHealth)
          stats.hpRegenerated += RegenerateAmount
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
        else chat.state = 'end' // Assume BYE_RESPONSE
        // Set gesture
        if (chat.a.equals(from)) chat.aEnd = data.gesture
        else chat.bEnd = data.gesture
        D('ENDING: ', root.peer.name, type, chat.state, chat.aEnd, chat.bEnd)
      }

      if (chat.state === 'end') {
        const aStat = state.stats[chat.b.toString('hex')]
        const bStat = state.stats[chat.a.toString('hex')]
        aStat.nEnded++
        bStat.nEnded++
      }

      D('[%s] Conversation(%h) state: %s mLength: %d, head: %h => %h', root.peer.name, chatId, chat.state, chat.mLength, block.parentSig, block.sig)
      // Bump head of findChatIdBy(parentSig) index
      delete state.heads[block.parentSig.toString('hex')]
      state.heads[block.sig.toString('hex')] = chatId
      chat.head = block.sig
      schedule('chat', chat.id, chat.expiresAt)
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
