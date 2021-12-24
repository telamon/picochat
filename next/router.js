// import * as Router from '@koffeine/svelte-router'
import Keygen from './views/Keygen.svelte'
import Pub from './views/Pub.svelte'
import Profile from './views/Profile.svelte'
import Shop from './views/Shop.svelte'
import Messages from './views/Messages.svelte'

import { writable, svlt, gate, mute } from '../blockend/nuro'
const [$name, setName] = writable()
const $view = gate(mute($name, name => {
  switch (name) {
    case 'pub': return Pub
    case 'shop': return Shop
    case 'msgs': return Messages
    case 'profile': return Profile
    case 'keygen': default: return Keygen
  }
}))
export const routeName = svlt($name)
export const view = svlt($view)
let current = null
export function setView (path) {
  if (current && path === current) return false
  current = path
  console.info('Reroute', path)
  setName(path)
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
