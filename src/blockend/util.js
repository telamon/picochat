// Global registry names (used as session variables)
const KEY_SK = 'reg/sk'

// Block-types
const TYPE_PROFILE = 'profile'
const TYPE_BOX = 'box'
const TYPE_MESSAGE = 'message'

/**
 * Convert Object to buffer
 */
function encodeBlock (type, seq, payload) {
  // TODO: Convert to protobuffer instead of JSON to allow storing images and video
  return JSON.stringify({
    ...payload,
    type,
    seq,
    date: new Date().getTime()
  })
}
/**
 * Converts buffer to Object
 */
function parseBlock (body) {
  // TODO: Convert to protobuffer instead of JSON to allow storing images and video
  return JSON.parse(body)
}

/**
 * Converts hexString to buffer
 */
function toBuffer (o) {
  if (!o) return o
  if (Buffer.isBuffer(o)) return o
  if (typeof o === 'object' && o.type === 'Buffer') return Buffer.from(o.data)
  else return o
}

module.exports = {
  KEY_SK,
  TYPE_PROFILE,
  TYPE_BOX,
  TYPE_MESSAGE,
  encodeBlock,
  parseBlock,
  toBuffer
}
