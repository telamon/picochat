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
  if (window.location.hash === '') return setView('pub', null, new URLSearchParams())
  const virt = new URL(
    window.location.hash.replace(/^#\/?/, 'x:').toLowerCase()
  )
  const [path, id] = virt.pathname.split('/')
  const search = new URLSearchParams(virt.search)
  setView(path, id, search)
}
export function navigate (path) {
  window.history.pushState(null, null, `/#${path}`.replace(/^#\/+/, '#/'))
  apply()
}
window.addEventListener('popstate', apply)
apply()
