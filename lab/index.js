const Simulator = require('hyper-simulator')
const { spawnAlice, spawnBob } = require('./bots')
async function main () {
  const sim = new Simulator()
  await sim.ready()
  // Spawn alices
  for (let i = 0; i < 5; i++) {
    const name = `Alice${i}`
    sim.launch(name, { linkRate: 56 << 8 }, (ctx, done) =>
      spawnAlice(ctx, done)
    )
  }
  // Spawn bobs
  for (let i = 0; i < 2; i++) {
    const name = `Bob${i}`
    sim.launch(name, { linkRate: 56 << 8 }, (ctx, done) =>
      spawnBob(ctx, done)
    )
  }
  return sim.run(1, 100)
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
