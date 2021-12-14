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
// const K_BLOCKS_ACK = 6 // blocking feed transfer/stream, expecting K_OK as response.
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
    // case K_BLOCKS_ACK: return 'K_BLOCKS_ACK'
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
    if (this.handlers.ondisconnect) this.handlers.ondisconnect(node, err)
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

  async shareBlocks (feeds, filter) {
    if (Feed.isFeed(feeds)) feeds = [feeds]
    feeds = [...feeds]
    const first = feeds.shift()
    const iterator = this.hub.survey(encodeMsg(K_BLOCKS, first), !!feeds.length, filter)
    for await (const [msg, sink] of iterator) {
      D('Sent K_BLOCKS', first.length)
      if (!feeds.length) continue // one feed sent, that's it.
      if (typeOfMsg(msg) !== K_OK) { // TODO: could be replaced with an piconet ACK flag
        D('Remote rejected additional blocks with code', kTypeToString[typeOfMsg(msg)])
        continue
      }
      if (!sink) continue
      this._uploadFeeds(sink, feeds)
        .catch(err => console.error('Failed sending subsequent feeds', err))
    }
  }

  _uploadFeeds (sink, feeds) {
    const remaining = [...feeds]
    const current = remaining.shift()
    return sink(encodeMsg(K_BLOCKS, current), !!remaining.length)
      .then(([msg, next]) => {
        D('Sent K_BLOCKS', current.length)
        if (!remaining.length) return // that's it.
        if (!msg) return console.warn('Empty scope')
        if (typeOfMsg(msg) !== K_OK) return console.warn('Peer rejected consequtive blocks', typeOfMsg(msg))
        return this._uploadFeeds(next, remaining)
      })
  }

  async * _downloadFeeds (msg, sink) {
    let done = false
    while (!done) {
      done = true
      const { type, data } = decodeMsg(msg)
      if (type === K_BLOCKS) yield data
      else if (sink) {
        await sink(encodeMsg(K_ERR), false)
        continue
      }
      if (!sink) continue
      const scope = await sink(encodeMsg(K_OK), true)
      msg = scope[0]
      sink = scope[1]
      done = false
    }
  }

  createWire () {
    const plug = this.hub.createWire(hubEnd => {
      /* This is handled by picohub
        hubEnd.closed
          .then(this._ondisconnect.bind(this, hubEnd))
          .catch(this._ondisconnect.bind(this, hubEnd))
      */
      hubEnd.postMessage(encodeMsg(K_NODE_ID, this.nodeId))
        .catch(err => console.error('Failed sending nodeId', err))
    })
    return plug
  }

  async _controller (node, msg, replyTo) {
    try {
      const { type, data } = decodeMsg(msg)
      D(`Received ${kTypeToString(type)}`, msg.length > 1 ? msg.slice(1, Math.min(msg.length, 12)).toString() : '[NO DATA]')
      switch (type) {
        case K_NODE_ID:
          node.id = data
          if (this.nodeIds[data]) {
            this.nodeIds[data]++ // attempt counter
            return node.close(new Error('DuplicatePeer')) // dedupe peers
          }
          this.nodeIds[data] = 1
          D('NodeConnected %s', node.id)
          if (this.handlers.onhandshake) this.handlers.onhandshake(node)
          break
        case K_QUERY: {
          const feeds = await this.handlers.onquery(data)
          await this._uploadFeeds(replyTo, feeds)
        } break
        case K_BLOCKS: // Download feeds
          for await (const blocks of this._downloadFeeds(msg, replyTo)) {
            const forward = await this.handlers.onblocks(blocks)
            D('Forwarding %d blocks ', forward)
            if (forward) {
              this.shareBlocks(blocks, node) // Gossip
                .catch(err => console.error('Gossip failed', err))
            }
          }
          break
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
    // case K_BLOCKS_ACK:
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
function typeOfMsg (buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('BufferExpected')
  return buffer[0]
}
function decodeMsg (buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('BufferExpected')
  const type = typeOfMsg(buffer)
  let data = null
  switch (type) {
    // case K_BLOCKS_ACK:
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
