// import * as Router from '@koffeine/svelte-router'
import Keygen from './views/Keygen.svelte'
import Pub from './views/Pub.svelte'
import Profile from './views/Profile.svelte'
import Shop from './views/Shop.svelte'
import Messages from './views/Messages.svelte'

import { writable } from 'svelte/store'

export const view = writable()
let current = null
export function setView (path) {
  if (current && path === current) return false
  current = path
  console.info('Reroute', path)
  switch (path) {
    case 'pub': return view.set(Pub)
    case 'shop': return view.set(Shop)
    case 'msgs': return view.set(Messages)
    case 'profile': return view.set(Profile)
    case 'keygen': default: return view.set(Keygen)
  }
}
function apply () {
  const path = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  setView(path)
}
export function navigate (path) {
  window.history.pushState(null, null, `/#${path}`.replace(/^#\/+/, '#/'))
  apply()
}
window.addEventListener('popstate', apply)
apply()
