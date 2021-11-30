const test = require('tape')
const {
  notEqual,
  notEqualDeep,
  mute,
  init,
  get,
  next,
  write
} = require('../src/blockend/nuro')

test('notEqual(a, b)', async t => {
  // some random primitives
  t.ok(notEqual(null, 1))
  t.ok(notEqual('a', 'b'))
  t.ok(notEqual('a', 'c'))
  t.ok(notEqual(1, 2))
  t.ok(notEqual(true, 1))
  // arrays
  t.notOk(notEqual([], []))
  t.notOk(notEqual(['a'], ['a']))
  t.notOk(notEqual(['a', 1], ['a', 1]))
  const p = { nam: 'dog', age: 'human', skills: 0 }
  t.notOk(notEqual([p], [p]))
  t.ok(notEqual([], [p]))

  // objects
  t.ok(notEqual({}, null))
  t.notOk(notEqual({}, {}))
  t.notOk(notEqual(p, p))
  t.notOk(notEqual({ a: 1 }, { a: 1 }))
  t.ok(notEqual({ a: 1 }, { a: 1, b: 2 }))
})

test('notEqualDeep(a, b)', async t => {
  const a = [
    {
      name: 'alice',
      pet: { state: 'loading' }
    }
  ]
  const b = [
    {
      name: 'alice',
      pet: { name: 'billy', type: 'iguana' }
    }
  ]
  t.ok(notEqual(a, b), 'children have different identities')
  t.ok(notEqualDeep(a, b), 'details in children detected')

  const c = [
    {
      name: 'alice',
      pet: { name: 'billy', type: 'iguana' }
    }
  ]
  t.notOk(notEqualDeep(b, c), 'detects deep equalities')

  const d = [...b]
  t.notOk(notEqual(d, b), 'shallow identity equality')
  t.notOk(notEqualDeep(d, b), 'deep check has same result')
})

test('The Problem', async t => {
  const $n = mute(
    init({ m: [] }),
    (chat, set) => {
      chat.m = [1, 2, 3]
      setTimeout(() => {
        chat.m = [...chat.m, 4, 5]
        console.log('async set')
        set(chat)
      }, 10)
      return chat
    }
  )
  let c = get($n)
  t.equal(c.m.length, 3, 'sync set')
  c = await next($n)
  t.equal(c.m.length, 5, 'async set')
})
/* init:    ( )->
 * mute:    >-[ => ]--( )->
 * forward: >-[ => ]-->
 * combine: >>-( )-->
 * memo:    >--( )-->>
 * write:   ]--( )-->
 * arr:   >--([])-[ => ]-->
 * hsh:   >--({})-[ => ]-->
 *
 */
test.only('arr()', t => {
  let _array = [0, 1]
  const [array, setArray] = write(_array)
  const $n = arr(
    a,
    (v, i) => {
    }
  )

  /*
  const m = memo(a)
  const $out = fwrd(
      combine(
      m,
      arr( // >-|=>|-([])->
        fwrd(m, chat => chat.messages),
        async (a, i) => asyncExpensiveCompute(a[i])
      )
    ),
    ([chat, messages]) => ({ ...chat, messages)
  )
  */
}
