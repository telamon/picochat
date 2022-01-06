<script>
import { writable, derived } from 'svelte/store'
import { view, setView, navigate, routeName } from './router'
import {
  boot,
  enter,
  state,
  kernel,
  Connections,
  Profile
} from './api'
import Timer from './components/Timer.svelte'
import DebugSelector from './components/DebugSelector.svelte'
const _loading = boot()
const conn = Connections()
const showBar = derived(state, s => s.hasKey)
const showDev = writable(true)
const showDebugSelector = writable(false)

const profile = Profile()

async function inspectFeed () {
  const feed = await kernel.feed()
  feed.inspect()
}
async function reloadStores () {
  await kernel.store.reload()
  console.info('Internal cache`s cleared')
}
async function purge () {
  if (!window.confirm('Permanently wipe your data, you sure?')) return
  await kernel.db.clear()
  // await keychain.db.clear()
  window.location.reload()
}

function toggleTheme () {
  const htmlTag = document.documentElement
  if(htmlTag.dataset.theme) delete htmlTag.dataset.theme
  else htmlTag.dataset.theme = 'dark'
}

function enterPub () {
  enter()
}

const autoSwarm = JSON.parse(window.localStorage.getItem('auto_swarm'))
function toggleAutoConnect() {
  window.localStorage.setItem('auto_swarm', !autoSwarm)
  window.location.reload()
}
</script>

<root class={'view-' + $routeName}>
  {#if $showDev}
  <!-- Developer bar -->
  <dev-bar class="flex row xcenter space-between">
    <div >
      K[{$state?.state[0]}]
      ID²[{$state.hasKey ? 1 : 0}]
      P[{$state.hasProfile ? 1 : 0}]
      m56[{$conn}]
      E[{$state.entered ? 1 : 0}]
    </div>
    <div>
      <!--
        sometimes you just need to
        let yourself have some fun.
        Say hello to modem-kun!
      -->
      <btn on:click={toggleAutoConnect} class={autoSwarm ? 'm56 auto' : 'm56 no-auto'}>
        {#if !$state.swarming}
          |=_=|
        {:else if !$conn}
          |o_=|
        {:else if 2 > $conn}
          |o_o|
        {:else}
          |ó_ó|
        {/if}
      </btn>
      <btn on:click={() => $showDebugSelector = true}>D</btn>
      <btn on:click={toggleTheme}>t</btn>
      <btn on:click={inspectFeed}>i</btn>
      <btn class="danger" on:click={purge}>X</btn>
    </div>
  </dev-bar>
  <DebugSelector open={showDebugSelector}/>
  {/if}

  <!-- Main container -->
  <main class={`container ${$showDev && 'has-dev'} ${$showBar && 'has-bar'}`}>
    {#await _loading}
      <h1>Loading kernel...</h1>
    {:then}
      <svelte:component this={$view} />
    {:catch err}
      <h3>KernelPanic! {err.message}</h3>
      <pre>{err.stack}</pre>
    {/await}
  </main>
  {#if $showBar}
  <!-- Bottom bar with phat buttons -->
  <bar class="flex row xcenter space-between">
    <round class="flex column center xcenter" on:click={() => navigate('pub')}>
      <img src="gfx/gfx-vibe.svg" alt="Pub"/>
    </round>
    <round class="flex column center xcenter" on:click={() => navigate('shop')}>
      <img src="gfx/gfx-shop.svg" alt="Shop"/>
    </round>
    {#if !$state.entered}
      <stat class="flex column center xcenter outside" on:click={enterPub}>
        <h3 class="muted">--:--</h3>
        <h6 class="primary">enter</h6>
      </stat>
    {:else}
      <stat class="flex column center xcenter inside">
        <h3 class="primary"><Timer expiresAt={$profile.expiresAt} /></h3>
        <h6 class="muted">exit</h6>
      </stat>
    {/if}
    <round class="flex column center xcenter" on:click={() => navigate('msgs')}>
      <img src="gfx/gfx-msgs.svg" alt="Messages"/><br>
      <samp>0</samp>
    </round>
    <round class="flex column center xcenter" on:click={() => navigate('profile')}>
      <img src="gfx/gfx-profile.svg" alt="Profile"/>
    </round>
  </bar>
  {/if}
</root>

<style>
.m56 { padding: 0; }
.m56.no-auto { background-color: var(--grave); }

stat.outside h3 { color: var(--muted-color); }
stat.outside h6 { color: var(--ash); }
stat.inside h3 { color: var(--ash); }
stat.inside h6 { color: var(--muted-color); }
</style>
