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

// eslint-disable-next-line no-constant-condition
const baseUri = '__ENV__' === 'dev'
  ? 'http://localhost:4000'
  : 'https://api.pico.pub'

export async function requestVerificationStamp (email) {
  const f = await kernel.feed()
  const res = await postFeed(baseUri + '/v0/verify', f, {
    headers: { 'X-Email-Address': email }
  })
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
