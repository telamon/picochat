/**
 * Centralized API
 *                  *
 *   .  *
 *  /©\       *
 * /_±_\  Copyright © Decent Labs AB 2022
 *
 * All I wanted was to sell beer without fucking up the environment.
 * What's the point of anything? :'(
 *
 * Don't touch this file, will move it out of the way later :/
 */
import { kernel } from './api'
import { until } from 'piconuro'
import Feed from 'picofeed'

// eslint-disable-next-line no-constant-condition
const baseUri = '__ENV__' === 'dev'
  ? 'http://localhost:4000'
  : 'https://api.pico.pub'

export async function requestVerificationStamp (email) {
  const f = await kernel.feed()
  f.append(kernel.constructor.encodeBlock('badge-plz', await kernel.seq(), { email }), kernel._secret)
  const res = await postFeed(baseUri + '/v0/verify', f)
  return res.message
}

export async function postFeed (uri, feed, options = {}) {
  const headers = new window.Headers()
  const raw = {
    'Content-Type': 'pico/feed',
    ...(options?.headers || {})
  }
  for (const key in raw) headers.append(key, raw[key])
  const res = await fetch(uri, {
    method: 'POST',
    headers,
    body: feed.buf.slice(0, feed.tail)
  })

  const data = await res.json()
  if (!res.ok) {
    if (!data.error) console.error(data)
    throw new Error(`[${res.status}] ${data.error}`)
  }
  return data
}

export async function getPickle (uri, options = {}) {
  const headers = new window.Headers()
  const raw = {
    // Accept: 'pico/feed, application/json',
    ...(options?.headers || {})
  }
  for (const key in raw) headers.append(key, raw[key])
  const res = await fetch(uri, {
    method: 'GET',
    headers
  })
  const type = res.headers.get('Content-Type')
  // console.log('Response type', type)
  let data
  if (/application\/json/.test(type)) {
    data = await res.json()
  }
  if (!res.ok) {
    throw new Error(`[${res.status}] ${data?.error || ''}`)
  }
  if (!data?.feed) throw new Error('Feed missing')
  return Feed.from(data.feed)
}

export async function createCheckout (cart) {
  console.log('checkout cart', cart)
  const p = await until(kernel.$profile(), p => p.state !== 'loading')
  if (p.state !== 'active') throw new Error('Feed busy')
  const f = await kernel.feed()
  const seq = (await kernel.seq()) + 1
  cart = cart.map(i => i.id !== 0xD100
    ? ({ id: i.id, q: i.qty })
    : ({ id: i.id, q: 1, a: i.qty * 100 }))
  f.append(kernel.constructor.encodeBlock('cart', seq, { items: cart }), kernel._secret)
  const res = await postFeed(baseUri + '/v0/checkout', f)
  window.location = res.url
  return res.url
}

export async function redeem (sid, success) {
  const crate = await getPickle(baseUri + '/v0/checkout/redeem/' + sid)
  const m = await kernel.dispatch(crate, true)
  if (!m.length) {
    throw new Error('Merge Failed')
  }
  return 'Enjoy!'
}
