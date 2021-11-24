/*
 * Contains minimal rpc, and it's message definitions.
 * actual logic resides in kernel.js
 */
const Hub = require('piconet')
const Feed = require('picofeed')
const D = require('debug')('pico-rpc')
const { bufferReplacer } = require('./util')
// Messages over kernel-wire
const K_BLOCKS = 1 // Synonymous with K_REQUEST_MERGE / publish
const K_BLOCKS_ACK = 6 // blocking feed transfer/stream, expecting K_OK as response.
const K_REQUEST_BLOCK = 2
const K_REQUEST_HEAD = 4
const K_REQUEST_TAIL = 5
const K_NODE_ID = 40
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
    case K_BLOCKS_ACK: return 'K_BLOCKS_ACK'
    case K_REQUEST_BLOCK: return 'K_REQUEST_BLOCK'
    case K_REQUEST_HEAD: return 'K_REQUEST_HEAD'
    case K_REQUEST_TAIL: return 'K_REQUEST_TAIL'
    case K_OK: return 'K_OK'
    case K_ERR: return 'K_ERR'
    case K_SIG: return 'K_SIG'
    case K_JSON: return 'K_JSON'
    case K_ERR_MSG: return 'K_ERR_MSG'
    case K_QUERY: return 'K_QUERY'
    case K_NODE_ID: return 'K_NODE_ID'
    default: return `UNKNOWN_TYPE:${type}`
  }
}

class RPC {
  constructor (nodeId, handlers) {
    this._controller = this._controller.bind(this)
    this.hub = new Hub(this._controller, this._ondisconnect.bind(this))
    this.handlers = handlers
    this.nodeIds = {}
    this.nodeId = nodeId
  }

  _ondisconnect (node, err) {
    if (err && err.message !== 'DuplicatePeer') console.warn('NodeDisconnected', node.id, err)
    D('NodeDisconnected', node.id, err?.message)
    if (!node.id) return
    this.nodeIds[node.id] = 0
  }

  // TO BE DEFINED
  async query (node, params = {}) {
    const send = node.postMessage
    D('Sent K_QUERY', params)
    const [msg, reply] = await send(encodeMsg(K_QUERY, params), true)
    this._controller(node, msg, reply) // redirect to controller
  }

  // TODO: rewrite to use survey || await direct ack
  sendBlock (blocks, target = null) {
    const send = target || this.hub.broadcast.bind(this.hub)
    D('Sent K_BLOCKS', blocks.length)
    send(encodeMsg(K_BLOCKS, blocks))
  }

  createWire () {
    const plug = this.hub.createWire((sink, close) => {
      sink(encodeMsg(K_NODE_ID, this.nodeId))
      // if (alreadyConnected) target.close || this.hub.disconnect(target)
    })
    return plug
  }

  async _controller (node, msg, replyTo) {
    try {
      const { type, data } = decodeMsg(msg)
      D(`Received ${kTypeToString(type)}`, msg.length > 1 ? msg.slice(1, Math.min(msg.length, 12)).toString() : '[NO DATA]')
      switch (type) {
        case K_NODE_ID:
          if (this.nodeIds[data]) {
            this.nodeIds[data]++ // attempt counter
            return node.close(new Error('DuplicatePeer')) // dedupe peers
          }
          this.nodeIds[data] = 1
          node.id = data
          D('NodeConnected %s', node.id)
          this.handlers.onhandshake(node)
          break
        case K_QUERY: {
          const feeds = await this.handlers.onquery(data)
          let port = replyTo
          let stop = false
          for (let i = 0; !stop && i < feeds.length; i++) {
            const feed = feeds[i]
            const isLast = feeds.length - 1 === i
            if (isLast) {
              const scope = await port(encodeMsg(K_BLOCKS_ACK, feed), true)
              if (!scope) return
              const [res, next] = scope
              const { type } = decodeMsg(res)
              stop = type !== K_OK
              if (stop) console.warn(`BulkTransfer aborted, expected K_OK but got: ${type} - ${kTypeToString(type)}`)
              else port = next
            } else {
              port(encodeMsg(K_BLOCKS, feed))
            }
          }
        } break
        case K_BLOCKS_ACK:
        case K_BLOCKS: {
          let next = replyTo
          let blocks = data
          while (blocks) {
            const forward = await this.handlers.onblocks(blocks)
            D('Forwarding %d blocks ', forward)
            if (forward) this.hub._broadcast(node, encodeMsg(K_BLOCKS, blocks)) // GOSSIP
            blocks = null
            if (!next) continue
            const scope = await next(encodeMsg(K_OK), true)
              .catch(console.warn.bind(null, 'Iterator failed'))
            if (!scope) continue
            const [res, repl] = scope
            if (res) {
              const [t, data] = decodeMsg(res)
              if (t !== K_BLOCKS && t !== K_BLOCKS_ACK) continue
              blocks = data
            }
            next = repl
          }
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
    case K_BLOCKS_ACK:
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

    // Serialize json messages
    case K_QUERY:
    case K_JSON: {
      const data = Buffer.from(JSON.stringify(obj))
      buffer = Buffer.alloc(data.length + 1)
      data.copy(buffer, 1)
    } break

    case K_NODE_ID:
      buffer = Buffer.alloc(8 + 1)
      obj.copy(buffer, 1)
      break

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
    case K_BLOCKS_ACK:
    case K_BLOCKS:
      // TODO: Feed.from(buffer) in picofeed
      data = new Feed()
      data.buf = buffer.slice(1)
      data.tail = buffer.length - 1
      break

    // deserialize 64byte signatures
    case K_SIG:
    case K_REQUEST_BLOCK:
      data = buffer.slice(1) // TODO: limit 64
      break

    // deserialize 32byte keys
    case K_REQUEST_HEAD:
    case K_REQUEST_TAIL:
      data = buffer.slice(1) // TODO: limit 32
      break

    // deserialize signals
    case K_OK:
    case K_ERR:
      break

    // deserialize json messages
    case K_QUERY:
    case K_JSON:
      data = JSON.parse(buffer.slice(1), bufferReplacer)
      break

    case K_NODE_ID:
      data = buffer.slice(1).toString('hex') // TODO: limit 8
      break

    default:
      debugger
      throw new Error('UnknownMessageType: ' + type)
  }
  return { type, data }
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
