const test = require('tape')
const levelup = require('levelup')
const memdown = require('memdown')
const Kernel = require('../src/blockend/')
const makeDatabase = () => levelup(memdown())

test('Create profile', async t => {
  const app = new Kernel(makeDatabase())
  const loggedIn = await app.load()
  t.equal(loggedIn, false, 'Not logged in on first run')

  // Create a new profile
  await app.register({
    name: 'Batman',
    description: 'I love driving around at night',
    age: 42
  })

  t.equal(app.profile.name, 'Batman', 'Correct username registered')
  t.equal(app.profile.description, 'I love driving around at night')
  t.ok(app.profile.key, 'Public key is exposed')
  t.end()
})

test.skip('Create message')
test.skip('Exchange profiles with friends')
test.skip('Should see friends messages')
