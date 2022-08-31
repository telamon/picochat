const { spawnPeer } = require('../test/test.helpers')
const Modem56 = require('../modem56.js')
const { rewrite, feedToGraph } = require('../blockend/game')
const { combine, settle } = require('piconuro')
// const { settle, next } = require('../blockend/nuro')
const FAILFAST = !!process.env.FAILFAST
class PicoBot {
  onError (type, err) {
    this.signal(type)
    console.error(this.name, type, err)
    if (FAILFAST) {
      this.dump('error.dot')
        .then(() => this.kernel.feed())
        .then(f => {
          f.inspect()
          console.error('journey: ', feedToGraph(f))
          process.exit(-1)
        })
    }
  }

  async onVibe (vibe) {
    console.info('PicoBot#onVibe(vibe) => Boolean, not implmented')
  }

  async onPeers (peers, canVibe, sendVibe) {
    console.info('PicoBot#onPeers(peers, canVibe, sendVibe()), not implmented')
  }

  async onTurn (chat) {
    console.info('PicoBot#onTurn(chat), not implmented')
  }

  mkProfile () {
    return {}
  }

  // Override to spawn non minimal kernels.
  // The spawnPeer from helpers is used for testing,
  // does not have have pictures or other configurables.
  async spawnPeer (name) {
    return await spawnPeer(name, this.mkProfile())
  }

  async boot (ctx, done, topic = 'PicoBotnet') {
    if (!done) done = () => console.log(`<${name}> färdig!`)
    if (!ctx.signal) ctx.signal = console.info
    this.ctx = ctx
    const { swarm, signal, name } = ctx
    const { k: kernel, spawnWire, dump } = await this.spawnPeer(name)
    this.kernel = kernel
    this.signal = signal
    this.dump = dump
    this.name = name
    ctx.ontick(tick => {
      // kernel._collectGarbage(ctx.simulator.time)
      debugger
    })

    const modem = new Modem56(swarm)

    modem.join(topic, spawnWire)
    // signal(`${name} joined pub`)

    kernel.$profile()(profile => {
      ctx.version = profile.score
    })

    const ph = this.onPeers.bind(this)
    const vh = this.onVibe.bind(this)
    const th = this.onTurn.bind(this)
    const errorHandler = this.onError.bind(this)

    settle(
      combine(kernel.$peers(), kernel.$cooldowns()),
      150
    )(
      ([peers, cooldowns]) => {
        if (cooldowns.state === 'loading') return
        const { canVibe } = cooldowns
        // const wait = cooldowns.vibe - Date.now()
        // signal(`$PC ${name} ${canVibe}`)
        if (!canVibe) return
        ph(peers, peer => {
          const key = peer?.pk || peer
          // console.log('SendVibe()', canVibe, kernel.pk.hexSlice(0, 6), ' => ', key.hexSlice(0, 6))
          kernel.sendVibe(key)
            .then(cid => subscribeChat(cid))
            .catch(err => errorHandler('sendVibe() Error', err))
        })
      })

    const chatSubs = {}
    kernel.$vibes()(vibes => {
      const waiting = vibes.filter(v => v.state === 'waiting_local')
      if (waiting.length) {
        for (const v of waiting) onvibereceived(v)
      }
    })

    function onvibereceived (v) {
      const response = vh(v)
      if (typeof response === 'undefined') return
      kernel.respondVibe(v.id, !!response) // Alice responds to vibes using reasons only known to her.
        .then(cid => subscribeChat(cid))
        .catch(err => errorHandler('respondVibe() Error', err))
    }

    function subscribeChat (cid) {
      if (chatSubs[cid.toString('hex')]) return
      signal(`${name} ChatSubscribed`)
      chatSubs[cid.toString('hex')] = kernel.$chat(cid)(chat => {
        if (chat.state === 'loading') return
        if (chat.state === 'finalizing' && chat.myTurn) return chat.bye(0).catch(console.error)
        if (chat.state === 'end') unsubscribeChat(cid, chat)
        if (chat.state === 'exhausted') {
          signal('timeprison')
          unsubscribeChat(cid, chat)
          // if (chat.initiator) done()
        }
        if (chat.state === 'active' && chat.myTurn) return onturn(chat)
        if (chat.state === 'error') {
          unsubscribeChat(cid, chat)
          errorHandler('Chat error', chat)
        }
      })
    }

    function unsubscribeChat (cid, chat) {
      const unsub = chatSubs[cid.toString('hex')]
      signal('ChatEnd: ' + rewrite(chat.graph))
      if (!unsub) return
      delete chatSubs[cid.toString('hex')]
      unsub()
    }

    async function onturn (chat) {
      signal('turn')
      try {
        await th(chat)
      } catch (err) {
        errorHandler('TurnError', err)
      }
    }
  }
}

/**
 * Alice doesn't do much but accept vibes and answer 'yup'.
 * could use an upgrade..
 */
class Alice extends PicoBot {
  mkProfile () {
    return { sex: 0 }
  }

  async onPeers () {} // Alices are shy

  async onVibe (vibe) {
    return true // vibe.peer.sex === 1
  }

  async onTurn (chat) {
    const patience = (chat.messages.length + this.ctx.random()) / 12
    const bubble = (chat.messages.length + this.ctx.random()) / 4

    if (chat.health < 2 && bubble > 1) {
      // Passing now would imprison white
      // ending the game in a LOSE/LOSE
      const roll = this.ctx.random() * 3
      if (roll > 2) return await chat.send('Good night')
      if (roll > 1) return await chat.bye(0)
    }

    if (bubble > 1) {
      // this.signal('B pass')
      await chat.pass()
    } else if (patience > 1) {
      // this.signal('B bye')
      await chat.bye(0)
    } else {
      // this.signal('B msg')
      await chat.send('Yup')
    }
  }
}

/**
 * Bob finds sends vibes, and talks...
 */
class Bob extends PicoBot {
  mkProfile () {
    return { sex: 1 }
  }

  async onPeers (peers, sendVibe) {
    if (peers.filter(p => !p.sex).length < 3) return
    const peer = peers
      .filter(p => !p.sex)
      .sort(() => -0.5 + this.ctx.random())[0]

    if (peer) sendVibe(peer.pk)
  }

  async onTurn (chat) {
    const pressure = (3 - chat.health) + (0.25 - this.ctx.random() * 0.5)
    // this.signal(`Gamble ${pressure}`)
    if (pressure >= 2) {
      // this.signal('W bye')
      await chat.bye(0)
    } else {
      // this.signal('W msg')
      await chat.send('Weather is good')
    }
  }
}

function spawnAlice (ctx, done) {
  const a = new Alice()
  a.boot(ctx, done)
    .catch(err => {
      ctx.signal('BootFailure')
      console.error('spawnAlice() failed:', err)
      process.exit(-1)
    })
  return a
}

function spawnBob (ctx, done) {
  const a = new Bob()
  a.boot(ctx, done)
    .catch(err => {
      ctx.signal('BootFailure')
      console.error('spawnBob() failed:', err)
      process.exit(-1)
    })
  return a
}
module.exports = { spawnAlice, spawnBob, PicoBot }

/** Silly attempt to run a bot on web-swarm via moe-proxy.
 * think it's better to do the reverse and patch browser wire into
 * sim-swarm
 */
if (require.main === module) {
  const swarm = require('hyperswarm')()
  const ctx = {
    name: 'RoboAlice',
    swarm,
    signal: console.info.bind(null, 'SIG '),
    ontick: () => {}
  }
  const a = new Alice()
  a.boot(ctx, () => console.log('Done'), 'picochat-testnet')
    .catch(err => {
      ctx.signal('BootFailure')
      console.error('spawnAlice() failed:', err)
      process.exit(-1)
    })
}
