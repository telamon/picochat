/*
 * Contains minimal rpc, and it's message definitions.
 * actual logic resides in kernel.js
 */
const Hub = require('piconet')
const Feed = require('picofeed')
const { defer } = require('deferinfer')
const debug = require('debug')('pico-rpc')

// Messages over kernel-wire
const K_BLOCKS = 1 // Synonymous with K_REQUEST_MERGE / publish
const K_REQUEST_BLOCK = 2
const K_REQUEST_BATTLE = 3
const K_REQUEST_HEAD = 4
const K_REQUEST_TAIL = 5
// Responses
const K_OK = 80
const K_ERR = 81
const K_SIG = 82

// Experimental
const K_JSON = 201
const K_ERR_MSG = 202
const K_QUERY = 203

function kTypeToString (type) {
  switch (type) {
    case K_BLOCKS: return 'K_BLOCKS'
    case K_REQUEST_BLOCK: return 'K_REQUEST_BLOCK'
    case K_REQUEST_HEAD: return 'K_REQUEST_HEAD'
    case K_REQUEST_TAIL: return 'K_REQUEST_TAIL'
    case K_OK: return 'K_OK'
    case K_ERR: return 'K_ERR'
    case K_SIG: return 'K_SIG'
    case K_JSON: return 'K_JSON'
    case K_ERR_MSG: return 'K_ERR_MSG'
    case K_QUERY: return 'K_QUERY'
    default: return `UNKNOWN_TYPE:${type}`
  }
}

class RPC {
  constructor (handlers) {
    this.hub = new Hub(this._controller.bind(this))
    this.handlers = handlers
  }

  // TO BE DEFINED
  query (target, params = {}) {
    const send = target || this.hub.broadcast.bind(this.hub)
    debug('Sent K_QUERY', params)
    send(encodeMsg(K_QUERY, params), this._controller.bind(this))
    /*
    return defer(done =>
      send(encodeMsg(K_QUERY, params), res => {
        debugger
        const { type, data } = decodeMsg(res)
        if (type === K_ERR) done(new Error('K_ERR'))
        else done(null, data)
      })
    )
    */
  }

  get createWire () { return this.hub.createWire.bind(this.hub) }

  async _controller (msg, replyTo) {
    try {
      const { type, data } = decodeMsg(msg)
      debug(`Received ${kTypeToString(type)}`, msg.length > 1 ? msg.hexSlice(1, Math.min(msg.length, 12)) : '[NO DATA]')
      switch (type) {
        case K_QUERY: {
          const feeds = await this.handlers.onquery(data)
          for (const feed of feeds) {
            replyTo(encodeMsg(K_BLOCKS, feed))
          }
        } break

        case K_BLOCKS: {
          const forward = await this.handlers.onblocks(data)
          if (forward) this.hub.broadcast(replyTo, msg) // GOSSIP
        } break

        default:
          debugger
          throw new Error(`UnknownMessageType: ${type} - ${kTypeToString(type)}`)
      }
    } catch (err) {
      console.error('RPC:internal error', err)
    }
  }
}

function encodeMsg (type, obj) {
  let buffer = null
  switch (type) {
    case K_BLOCKS:
      // TODO: Extend picofeed with official binary pickle support.
      obj = Feed.from(obj)
      buffer = Buffer.alloc(obj.tail + 1)
      obj.buf.copy(buffer, 1, 0, obj.tail)
      break

    // Serialize 64byte signatures
    case K_SIG:
    case K_REQUEST_BLOCK:
      buffer = Buffer.alloc(Feed.SIGNATURE_SIZE + 1)
      obj.copy(buffer, 1)
      break

    // Serialize 32byte keys
    case K_REQUEST_HEAD:
    case K_REQUEST_TAIL:
      buffer = Buffer.alloc(32 + 1) // TODO: export Feed.KEY_SIZE
      obj.copy(buffer, 1)
      break

    // Serialize signals
    case K_ERR:
    case K_OK:
      buffer = Buffer.alloc(1)
      break

    // Serialize node-owner messages
    case K_QUERY:
    case K_JSON: {
      const data = Buffer.from(JSON.stringify(obj))
      buffer = Buffer.alloc(data.length + 1)
      data.copy(buffer, 1)
    } break

    default:
      throw new Error('UnknownMessageType: ' + type)
  }
  buffer[0] = type
  return buffer
}

function decodeMsg (buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('BufferExpected')
  const type = buffer[0]
  let data = null
  switch (type) {
    case K_BLOCKS:
      // TODO: Feed.from(buffer) in picofeed
      data = new Feed()
      data.buf = buffer.slice(1)
      data.tail = buffer.length - 1
      break

    // deserialize 64byte signatures
    case K_SIG:
    case K_REQUEST_BLOCK:
      data = buffer.slice(1)
      break

    // deserialize 32byte keys
    case K_REQUEST_HEAD:
    case K_REQUEST_TAIL:
      data = buffer.slice(1)
      break

    // deserialize signals
    case K_OK:
    case K_ERR:
      break

    // deserialize node-owner messages
    case K_QUERY:
    case K_JSON:
      data = JSON.parse(buffer.slice(1))
      break

    default:
      debugger
      throw new Error('UnknownMessageType: ' + type)
  }
  return { type, data }
}

function kWire (connect, target, allowSuperset) {
  const send = connect((msg, replyTo) => {
    if (typeof target !== 'function') return
    if (msg[0] >= 200 && !allowSuperset) {
      console.warn('Unauthorized message dropped, type:', msg[0])
      return // drop message
    }
    target(decodeMsg(msg), replyTo)
  })

  const io = {
    merge (block) { // synonymous with publish.
      // There's no guarantee that feedback here is needed nor feasible
      // the merge command might as well have been broadcasted to the network
      return defer(done =>
        send(encodeMsg(K_BLOCKS, block), res => {
          const { type } = decodeMsg(res)
          done(type === K_ERR && new Error('K_ERR')) // TODO: maybe give feedback of merged/-count
        })
      )
    },

    fetchBlock (id) {
      return defer(done => {
        send(encodeMsg(K_REQUEST_BLOCK, id), res => {
          const { type, data } = decodeMsg(res)
          if (type === K_BLOCKS) done(null, data.first)
          else done(new Error('UnexpectedResponse:' + kTypeToString(type)))
        })
      })
    },

    /**
     * Returns battle history assembled from head
     */
    fetchBattle (key) {
      return defer(done => {
        send(encodeMsg(K_REQUEST_BATTLE, key), res => {
          const { type, data } = decodeMsg(res)
          switch (type) {
            case K_BLOCKS:
            case K_OK:
              done(null, data)
              break
            default:
              done(new Error('UnexpectedResponse:' + kTypeToString(type)))
          }
        })
      })
    },

    /**
     * Returns pointer to head of chain
     */
    fetchHead (key) {
      return defer(done => {
        send(encodeMsg(K_REQUEST_HEAD, key), res => {
          const { type, data } = decodeMsg(res)
          switch (type) {
            case K_SIG:
            case K_OK:
              done(null, data)
              break
            default:
              done(new Error('UnexpectedResponse:' + kTypeToString(type)))
          }
        })
      })
    },

    /**
     * Returns pointer to tail of chain (genesis block)
     */
    fetchTail (key) {
      return defer(done => {
        send(encodeMsg(K_REQUEST_TAIL, key), res => {
          const { type, data } = decodeMsg(res)
          switch (type) {
            case K_SIG:
            case K_OK:
              done(null, data)
              break
            default:
              done(new Error('UnexpectedResponse:' + kTypeToString(type)))
          }
        })
      })
    }
  }

  const nodeAdmin = {
    /*
     * Fetches list of active challenges
     * returns JSON array containing high-level details
     */
    fetchOpenChallenges () {
      return defer(done => {
        send(encodeMsg(K_SUPER_CHALLENGES), res => {
          const { type, data } = decodeMsg(res)
          switch (type) {
            case K_JSON:
              done(null, data)
              break
            case K_ERR:
            case K_ERR_MSG:
              done(new Error(data))
              break
            default:
              done(new Error('UnexpectedResponse:' + kTypeToString(type)))
          }
        })
      })
    },

    /*
     * param signature of challenge we wish to look up responses for.
     * returns JSON array containing high-level response details
     */
    fetchChallengeResponses (challengeSignature) {
      return defer(done => {
        send(encodeMsg(K_SUPER_CRESPONSES, challengeSignature), res => {
          const { type, data } = decodeMsg(res)
          switch (type) {
            case K_JSON:
              done(null, data)
              break
            case K_ERR:
            case K_ERR_MSG:
              done(new Error(data))
              break
            default:
              done(new Error('UnexpectedResponse:' + kTypeToString(type)))
          }
        })
      })
    },

    /*
     * Allows super to broadcast feed/blocks directly out of node.
     * Should be removed in future, just used as a workaround for alpha retransmissions
     */
    gossip (block) { // synonymous with publish.
      // There's no guarantee that feedback here is needed nor feasible
      // the merge command might as well have been broadcasted to the network
      return defer(done =>
        send(encodeMsg(K_SUPER_GOSSIP, block), res => {
          const { type } = decodeMsg(res)
          done(type === K_ERR && new Error('K_ERR'))
        })
      )
    }
  }

  if (allowSuperset) Object.assign(io, nodeAdmin)
  return io
}

module.exports = {
  RPC,
  decodeKRPCMessage: decodeMsg,
  encodeKRPCMessage: encodeMsg,
  kTypeToString,
  K_BLOCKS,
  K_REQUEST_BLOCK,
  K_REQUEST_HEAD,
  K_REQUEST_TAIL,
  K_OK,
  K_ERR,
  K_SIG,
  K_JSON,
  K_ERR_MSG
}
