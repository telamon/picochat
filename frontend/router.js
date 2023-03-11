import { writable, gate, mute } from 'piconuro'
import { svlt } from './api'

// Import Views
import Keygen from './views/Keygen.svelte'
import Pub from './views/Pub.svelte'
import Profile from './views/Profile.svelte'
import Shop from './views/Shop.svelte'
import Messages from './views/Messages.svelte'
import Chat from './views/Chat.svelte'
import About from './views/About.svelte'
import Append from './views/Append.svelte'
import Wallet from './views/Wallet.svelte'
import Devel from './views/Devel.svelte'

const [$name, setName] = writable()
const [$id, setId] = writable()
const [$q, setQ] = writable()
// map name to component
const $view = gate(mute($name, name => {
  switch (name) {
    case 'shop': return Shop
    case 'msgs': return Messages
    case 'profile': return Profile
    case 'chat': return Chat
    case 'about': return About
    case 'keygen': return Keygen
    case 'append': return Append
    case 'wallet': return Wallet
    case 'devel': return Devel
    case 'pub': default: return Pub
  }
}))

// -----------------------------------------
// Internal router code
// (just pretend it's not here)
// ----------------------------------------
export const routeName = svlt($name)
export const view = svlt($view)
export const id = svlt($id)
export const q = svlt($q)
export const nId = $id // expose raw neuron

let current = null
export function setView (path, id, search) {
  if (current && path === current) return false
  current = path
  console.info('Rerouting to path:', path, 'id:', id, 'Q/Search:', search)
  setName(path)
  setId(id)
  setQ(search)
}

function apply () {
  const { hash, origin } = window.location
  if (hash === '' && hash !== '#/') return setView('pub', null, new URLSearchParams())

  const virt = new URL(origin + '/' + hash.replace(/^#\/?/, ''))
  // Naive approach "/path/:id", "/nested/deep/paths/:id" not supported
  let path = ''
  let id
  const match = virt.pathname.match(/^\/([^/]+)(?:\/(.+))?/)
  if (match) {
    path = match[1]
    id = match[2]
  }
  path = path.toLowerCase() // Make paths case-insensitive
  const search = new URLSearchParams(virt.search)
  const q = {}
  let searchEmpty = true
  for (const [k, v] of search.entries()) {
    q[k] = v
    searchEmpty = false
  }
  setView(path, id, searchEmpty ? undefined : q)
}
export function navigate (path) {
  window.history.pushState(null, null, `/#${path}`.replace(/^#\/+/, '#/'))
  apply()
}
window.addEventListener('popstate', apply)
apply()
