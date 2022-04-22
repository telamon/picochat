const { spawnPeer } = require('../test/test.helpers')
const Modem56 = require('../modem56.js')
const { rewrite, feedToGraph } = require('../blockend/game')
const { combine } = require('../blockend/nuro')
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
    if (!done) done = () => console.log(`<${name}> färdig!`)
    if (!ctx.signal) ctx.signal = console.info
    this.ctx = ctx
    const { swarm, signal, name } = ctx
    const { k: kernel, spawnWire } = await spawnPeer(name, this.mkProfile())
    this.kernel = kernel
    this.signal = signal
    this.name = name

    ctx.ontick(tick => {
      // kernel._collectGarbage(ctx.simulator.time)
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

    combine(
      kernel.$peers(),
      kernel.$cooldowns()
    )(
      ([peers, cooldowns]) => {
        if (cooldowns.state === 'loading') return
        const canVibe = cooldowns.canVibe
        // const wait = cooldowns.vibe - Date.now()
        // signal(`$PC ${name} ${canVibe}`)
        if (!canVibe) return
        ph(peers, peer => {
          const key = peer?.pk || peer
          // console.log('SendVibe()', canVibe, kernel.pk.hexSlice(0, 6), ' => ', key.hexSlice(0, 6))
          kernel.sendVibe(key)
            .then(cid => subscribeChat(cid))
            .catch(err => {
              signal('sendVibe() Error')
              console.error('sendVibe() failed:', err)
              if (FAILFAST) {
                kernel.feed()
                  .then(f => {
                    f.inspect()
                    console.error('journey: ', feedToGraph(f))
                    process.exit(-1)
                  })
              }
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
    return { sex: 0 }
  }

  async onPeers (peers, sendVibe) {
    const peer = peers
      .sort(() => -0.5 + this.ctx.random())
      .find(p => p.sex === 0)

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
