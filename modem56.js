const hyperswarm = require('hyperswarm-web')
const ProtoStream = require('hypercore-protocol')
const crypto = require('crypto')
const PicoHub = require('piconet')
const { hyperWire } = PicoHub
const debug = require('debug')

debug.enable('*')
/*
 *  It's **beep** time!
 *     ~¤~
 *   ___|_
 *  /____/|  ~ Modem 56 ~
 * |_o_=_|/
 *
 * Experimental! (pure digital anarchy)
 * Code scavenged from PoH in an attempt to make it easy to connect
 * to a swarm and use the piconet-hyperwire protocol.
 */
class Modem56 {
  // Allow injection of a swarm instance,
  // Modules known to export a compatible interface:
  // - hyperswarm
  // - hyperswarm-web
  // - hyper-simulator
  constructor (swarm = null) {
    console.info('[Modem56] Brrrrrr.. ptong ptong ptong ptong *whitenoise*')
    this.swarm = swarm || hyperswarm()
    // Initial release support only 1 topic due to design limitations
    this._topic = null
    this._spawnWire = null
    this._onconnection = this._onconnection.bind(this)
  }

  join (topic, spawnWire) {
    if (this._topic) throw new Error('Only single topic for now')
    if (typeof topic === 'string') {
      topic = crypto.createHash('sha256')
        .update(topic)
        .digest()
    }
    this.swarm.join(topic)
    this._spawnWire = spawnWire
    this._topic = topic
    this.swarm.on('connection', this._onconnection)
    return () => this.leave()
  }

  _onconnection (socket, details) {
    console.info('[Modem56] peer connected', details)
    const { client } = details
    const hyperProtocolStream = new ProtoStream(client)
    socket.pipe(hyperProtocolStream).pipe(socket)
    const encryptionKey = this._topic
    const plug = this._spawnWire(details)
    hyperWire(plug, hyperProtocolStream, encryptionKey)
  }

  leave () {
    this.swarm.off('connection', this._onconnection)
    this.swarm.leave(this._topic)
    // this.hub.destroy()
    for (const sink of [...this._hub._nodes]) this._hub.disconnect(sink)
  }
}

module.exports = Modem56
