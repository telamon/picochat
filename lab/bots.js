const { spawnPeer } = require('../test/test.helpers.js')
const Modem56 = require('../modem56.js')
const { rewrite } = require('../blockend/game')
// const { settle, next } = require('../blockend/nuro')
const FAILFAST = !!process.env.FAILFAST
class PicoBot {
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

  async boot (ctx, done, topic = 'PicoBotnet') {
    if (!ctx.signal) ctx.signal = console.info
    const { swarm, signal, name } = ctx
    if (!done) done = () => console.log(`<${name}> färdig!`)
    const { k: kernel, spawnWire } = await spawnPeer(name, this.mkProfile())
    this.kernel = kernel
    this.signal = signal
    this.name = name

    const modem = new Modem56(swarm)

    modem.join(topic, spawnWire)
    // signal(`${name} joined pub`)

    kernel.$profile()(profile => {
      ctx.version = profile.score
    })

    const ph = this.onPeers.bind(this)
    const vh = this.onVibe.bind(this)
    const th = this.onTurn.bind(this)
    let vibeSent = 0
    kernel.$peers()(peers => {
      // ctx.version = peers.length
      // const vibeState = kernel.store.state.vibes

      // const canVibe = !kernel.store.state.vibes.seen[kernel.pk.toString('hex')]
      /*
      const canVibe = !vibeState.own.find(v => {
        const vibe = vibeState.matches[v.toString('hex')]
        return vibe.a.equals(kernel.pk) // this is silly, use get(kernel.$vibes()) instead
      })
      */
      const canVibe = !vibeSent

      ph(peers, canVibe, peer => {
        const key = peer?.pk || peer
        console.log('SendVibe()', canVibe, kernel.pk.hexSlice(0, 6), ' => ', key.hexSlice(0, 6))
        vibeSent++
        kernel.sendVibe(key)
          .then(cid => subscribeChat(cid))
          .catch(err => {
            signal('sendVibe() Error')
            console.error('sendVibe() failed:', err)
            if (FAILFAST) process.exit(-1)
          })
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
        .catch(err => {
          signal('respondVibe() Error')
          console.error(`${name} k.respondVibe() failed!`, err)
          if (FAILFAST) process.exit(-1)
        })
    }

    function subscribeChat (cid) {
      if (chatSubs[cid.toString('hex')]) return
      signal('ChatSubscribed')
      chatSubs[cid.toString('hex')] = kernel.$chat(cid)(chat => {
        if (chat.state === 'loading') return
        if (chat.state === 'finalizing' && chat.myTurn) return chat.bye(0).catch(console.error)
        if (chat.state === 'end') unsubscribeChat(cid, chat)
        if (chat.state === 'exhausted') {
          signal('game over')
          unsubscribeChat(cid, chat)
        }
        if (chat.state === 'active' && chat.myTurn) return onturn(chat)
        if (chat.state === 'error') {
          signal('Chat error')
          unsubscribeChat(cid, chat)
          console.error('Error loading chat', chat)
          if (FAILFAST) process.exit(-1)
        }
      })
    }

    function unsubscribeChat (cid, chat) {
      const unsub = chatSubs[cid.toString('hex')]
      signal('ChatEnd: ' + rewrite(chat.graph))
      if (!unsub) return
      delete chatSubs[cid.toString('hex')]
      vibeSent = 0
      unsub()
    }

    function onturn (chat) {
      signal('turn')
      th(chat)
        .catch(err => {
          signal('TurnError')
          console.error(err)
          if (FAILFAST) process.exit(-1)
        })
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

  async onPeers () {} // Alice ignores peers

  async onVibe (vibe) {
    return true // vibe.peer.sex === 1
  }

  async onTurn (chat) {
    const patience = (chat.messages.length + Math.random()) / 12
    const bubble = (chat.messages.length + Math.random()) / 4

    if (bubble > 1) {
      this.signal('B pass')
      await chat.pass()
    } else if (patience > 1) {
      this.signal('B bye')
      await chat.bye(0)
    } else {
      this.signal('B msg')
      await chat.send('Yup')
    }
  }
}

/**
 * Bob finds sends vibes, and talks...
 */
class Bob extends PicoBot {
  constructor () {
    super()
    this.guts = Math.random() * 2
  }

  mkProfile () {
    return { sex: 0 }
  }

  async onPeers (peers, vibeReady, sendVibe) {
    for (const peer of peers.sort(() => -0.5 + Math.random())) {
      if (vibeReady && peer.sex === 0) return sendVibe(peer.pk)
    }
  }

  async onTurn (chat) {
    const pressure = (chat.health + this.guts) - (Math.random() * 0.5)
    if (pressure < 0) {
      this.signal('W bye')
      await chat.bye(0)
    } else {
      this.signal('W msg')
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
}

function spawnBob (ctx, done) {
  const a = new Bob()
  a.boot(ctx, done)
    .catch(err => {
      ctx.signal('BootFailure')
      console.error('spawnAlice() failed:', err)
      process.exit(-1)
    })
}
module.exports = { spawnAlice, spawnBob, PicoBot }
