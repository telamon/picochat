const Simulator = require('hyper-simulator')
const { spawnAlice, spawnBob } = require('./bots')
const lads = ['Bob', 'Charlie', 'Tony', 'Kenan', 'Gaul', 'Lars', 'Dennis', 'Jörgen', 'Faust', 'Hans']
const ladies = ['Alice', 'Cammie', 'Bella', 'Maria', 'Daphne', 'Lisa', 'Ophelia', 'Elin', 'Frida', 'Hanna']
async function main () {
  const sim = new Simulator()
  await sim.ready()
  // Spawn alices
  for (let i = 0; i < 5; i++) {
    const name = pick(ladies)
    sim.launch(name, { linkRate: 56 << 10 }, (ctx, done) =>
      spawnAlice(ctx, done)
    )
  }
  // Spawn bobs
  for (let i = 0; i < 8; i++) {
    const name = pick(lads)
    sim.launch(name, { linkRate: 56 << 10 }, (ctx, done) =>
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

function pick (arr) {
  const i = Math.floor((Math.random() * (arr.length - 1)))
  return arr.splice(i, 1)[0]
}
