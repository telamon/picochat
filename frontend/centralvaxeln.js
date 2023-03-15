import { streamWire, unpromise } from 'piconet'

/**
 * This is a shady wire pulled in from a window
 * you have no idea where it goes or what it's
 * connected to.
 */
export class Modem56 {
  constructor (wsUrl = 'ws://localhost:1337') {
    this.url = wsUrl
  }

  async replug () {
    if (this.socket) return this.socket
    const [p, set, abort] = unpromise()
    const cutWire = error => {
      console.error('Shady wire was cut', error)
      // TODO: does event listeners need to be removed?
      this.socket = null
      abort()
    }
    this.socket = new window.WebSocket(this.url)
    this.socket.addEventListener('open', set(this.socket))
    this.socket.addEventListener('close', cutWire)
    this.socket.addEventListener('error', cutWire)
    return p
  }

  async join (topic, spawnWire) {
    this.topic = topic // not used atm
    const s = await this.replug()
    let doReconnect = true
    const renameEvent = ev => ev === 'data' ? 'message' : ev
    const wsAdapter = {
      on (event, listener) {
        s.addEventListener(renameEvent(event), payload => {
          listener(payload)
          if (doReconnect && (event === 'close' || event === 'error')) {
            setTimeout(() => this.join(topic, spawnWire), 300)
          }
        })
      },
      once (event, listener) {
        const im = (...args) => {
          listener(...args)
          wsAdapter.off(event, im)
        }
        wsAdapter.on(event, im)
      },
      off (event, listener) { s.removeEventListener(renameEvent(event), listener) },
      end (err) { s.close(err) },
      write (msg) { s.send(msg) }
    }
    wsAdapter.destroy = wsAdapter.end
    const plug = spawnWire({ client: true })
    console.log('Plug', plug)
    const disconnect = streamWire(plug, wsAdapter)
    return () => {
      doReconnect = false
      disconnect()
    }
  }
}

// TODO: Modem56HyperswarmDHTRelay
