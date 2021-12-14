const Simulator = require('hyper-simulator')
const { spawnPeer } = require('../test/test.helpers.js')
const Modem56 = require('../modem56.js')
const { settle, next } = require('../blockend/nuro')

async function main () {
  const sim = new Simulator()
  await sim.ready()
  // Spawn alices
  for (let i = 0; i < 5; i++) {
    const name = `Alice${i}`
    sim.launch(name, { linkRate: 56 << 8 }, (ctx, done) =>
      makeAlice(ctx, done)
    )
  }
  // Spawn bobs
  for (let i = 0; i < 2; i++) {
    const name = `Bob${i}`
    sim.launch(name, { linkRate: 56 << 8 }, (ctx, done) =>
      makeBob(ctx, done)
    )
  }
  return sim.run(1, 200)
}

// Spawns an alice bot
// - alice likes to respond to vibes
// - alice does not like to send vibes
// - alice does not like to pass
// - alice likes short conversations (max 10msgs)
async function makeAlice (ctx, done) {
  const { swarm, signal, name } = ctx
  const { k: kernel, spawnWire } = await spawnPeer(name)
  const modem = new Modem56(swarm)
  modem.join('Abyss', spawnWire)
  signal(`${name} joined pub`)

  kernel.$peers()(peers => {
    ctx.version = peers.length
  })

  // Alice signals 'Yippiee!!' when she gets vibe
  kernel.$vibes()(vibes => {
    const waiting = vibes.filter(v => v.state === 'waiting_local')
    if (waiting.length) {
      signal(`${name} Yippiiee! I have ${waiting.length} vibes`)
    }
  })
}

// Spawn an Bob bot
// - bob send vibe
// - bob loves to talk
async function makeBob (ctx, done) {
  const { swarm, signal, name } = ctx
  const { k: kernel, spawnWire } = await spawnPeer(name)
  const modem = new Modem56(swarm)
  modem.join('Abyss', spawnWire)
  signal(`${name} joined pub`)

  kernel.$peers()(peers => {
    ctx.version = peers.length
  })

  // When bob sees a peer he immediately tries to send vibe
  const peers = await next(settle(kernel.$peers()))
  if (peers.length > 0) {
    await kernel.sendVibe(peers[0].pk)
  }
}

main()
  .then(() => {
    console.log('Simulation complete')
    process.exit(0)
  })
  .catch(err => {
    console.error('Simulation failed:', err)
    process.exit(1)
  })
