const { SIGNATURE_SIZE } = require('picofeed')
const { toBuffer } = require('../util')

module.exports = function BufferedRegistry () {
  const timeout = 5000
  const pending = {}
  return {
    // - Buffered versions of write and read registry
    async _writeReg (key, value) {
      await this.repo.writeReg(key, value)
      if (!pending[key.toString()]) return
      const { set, timerId } = pending[key.toString()]
      delete pending[key.toString()]
      clearTimeout(timerId)
      set(value)
    },

    async _readReg (key) {
      const value = await this.repo.readReg(key)
      if (value) return value
      if (pending[key.toString()]) return pending[key.toString()].promise
      let set = null
      let timerId = null
      const promise = new Promise((resolve, reject) => {
        set = resolve
        timerId = setTimeout(() => {
          delete pending[key.toString()]
          reject(new Error('BufferedReadTimedOut'))
        }, timeout)
      })
      if (!set) throw new Error('ConcurrencyError')
      pending[key.toString()] = { promise, set, timerId }
      return promise
    },

    // -- Conversation encryption-key management
    async _storeLocalChatKey (chatId, msgBox) {
      const CONVERSATION_PREFIX = 67 // Ascii 'C'
      // const CONVERSATION_PREFIX = 99 // Ascii 'c'
      const vLength = msgBox.sk.length + msgBox.pk.length
      if (vLength !== 64) throw new Error(`Expected box keypair to be 32bytes each, did algorithm change?: ${vLength}`)
      chatId = toBuffer(chatId)
      if (chatId.length !== SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')

      const value = Buffer.allocUnsafe(msgBox.sk.length + msgBox.pk.length)
      msgBox.sk.copy(value)
      msgBox.pk.copy(value, msgBox.sk.length)
      const key = Buffer.allocUnsafe(SIGNATURE_SIZE + 1)
      chatId.copy(key, 1)
      key[0] = CONVERSATION_PREFIX
      return await this._writeReg(key, value)
    },

    async _getLocalChatKey (chatId) {
      const CONVERSATION_PREFIX = 67 // Ascii 'C'
      if (typeof chatId === 'string') chatId = Buffer.from(chatId, 'hex') // Attempt normalize to buffer
      chatId = toBuffer(chatId)
      if (chatId.length !== SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')

      const key = Buffer.allocUnsafe(SIGNATURE_SIZE + 1)
      chatId.copy(key, 1)
      key[0] = CONVERSATION_PREFIX
      const value = await this._readReg(key)
      if (!value) throw new Error('BoxPairNotFound')
      const box = {
        pk: value.slice(32),
        sk: value.slice(0, 32)
      }
      return box
    },

    async _getRemoteChatKey (chatId) {
      const key = chatId.toString('hex')
      const vibe = this.store.state.vibes.matches[key]
      if (!vibe) throw new Error('ConversationNotFound')
      if (!vibe.remoteBox) throw new Error('BoxPublicKeyNotAvailable')
      return vibe.remoteBox
    },

    // -- Encrypted messages can only be decrypted by receiver
    // hence we need to store a copy of each message locally (might add some local encryption to it later)
    async _setMessageBody (sig, message) {
      const CONVERSATION_PREFIX = 77 // Ascii 'M'
      sig = toBuffer(sig)
      if (!Buffer.isBuffer(sig) || sig.length !== SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')
      const key = Buffer.allocUnsafe(SIGNATURE_SIZE + 1)
      sig.copy(key, 1)
      key[0] = CONVERSATION_PREFIX
      return await this._writeReg(key, toBuffer(message))
    },

    async _getMessageBody (sig) {
      const CONVERSATION_PREFIX = 77 // Ascii 'M'
      sig = toBuffer(sig)
      if (!Buffer.isBuffer(sig) || sig.length !== SIGNATURE_SIZE) throw new Error('Expected chatId to be a block signature')
      const key = Buffer.allocUnsafe(SIGNATURE_SIZE + 1)
      sig.copy(key, 1)
      key[0] = CONVERSATION_PREFIX
      const msg = await this._readReg(key)
      if (!msg) throw new Error('MessageNotFound')
      return msg.toString()
    }
  }
}
