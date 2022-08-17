<script>
// ᚹᚽᚲᛜᚲᚻᚤᛏ
import { onMount } from 'svelte'
import { writable, derived } from 'svelte/store'
import { view, id, setView, navigate, routeName, q } from './router'
import {
  boot,
  enter,
  state,
  kernel,
  Connections,
  Profile,
  profilePicture,
  NotificationsCount,
  purge
} from './api'
import Icon from './components/Icon.svelte'
import Timer from './components/Timer.svelte'
import BinaryImage from './components/BinaryImage.svelte'
import DebugSelector from './components/DebugSelector.svelte'
const _loading = boot()
const conn = Connections()
const showBar = derived([state, routeName], ([s, name]) =>
  // Disable during profile setup
  s.hasKey && s.hasProfile &&
  // Disable on shop page
  name !== 'shop'
)
const showDev = derived(routeName, name =>
  name === 'profile'
)
const showDebugSelector = writable(false)
const nCount = NotificationsCount()
const profile = Profile()

async function inspectFeed () {
  const feed = await kernel.feed()
  feed.inspect()
  console.log(`Size: ${(feed.tail / 1024).toFixed(2)} kB`, )
}
async function reloadStores () {
  await kernel.store.reload()
  console.info('Internal cache`s cleared')
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
function globReject (error) {
  console.error('[Unhandled Rejection]', error)
}
function globError (error) {
  console.error('[GlobError]', error)
}

// Scroll top on route change
onMount(() =>
  view.subscribe(() => {
    window.document.scrollingElement.scrollTo({ top: 0, left: 0})
  })
)
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
      <btn on:click={reloadStores}>r</btn>
      <btn on:click={() => $showDebugSelector = true}>D</btn>
      <btn on:click={toggleTheme}>t</btn>
      <btn on:click={inspectFeed}>i</btn>
      <btn class="danger" on:click={() => purge(false)}>X</btn>
    </div>
  </dev-bar>
  <DebugSelector open={showDebugSelector}/>
  {/if}

  <!-- Main container -->
  <main class:has-dev={$showDev}
        class:has-bar={$showBar}>
    {#await _loading}
      <div class="column center xcenter" style="height: 100%">
        <h5 aria-busy="true">Booting up...</h5>
      </div>
    {:then}
      {#if $id && $q}
        <svelte:component this={$view} id={$id} q={$q} />
      {:else if $q}
        <svelte:component this={$view} q={$q} />
      {:else if $id}
        <svelte:component this={$view} id={$id} />
      {:else}
        <svelte:component this={$view} />
      {/if}
    {:catch err}
      <h3>KernelPanic! {err.message}</h3>
      <pre>{err.stack}</pre>
    {/await}
  </main>
  {#if $showBar}
  <!-- Bottom bar with phat buttons -->
  <bar class="flex row xcenter space-between">
    <round class="flex column center xcenter noselect" on:click={() => navigate('pub')}>
      <Icon id="gfx-vibe" nofill/>
    </round>
    <round class="flex column center xcenter noselect" on:click={() => navigate('shop')}>
      <Icon id="gfx-shop" nofill/>
    </round>
    {#if !$state.entered}
      <stat class="flex column center xcenter outside noselect btn-enter"
        on:click={enterPub}>
        <h3 class="muted">--:--</h3>
        <h6 class="primary">start</h6>
      </stat>
    {:else}
      <stat class="flex column center xcenter inside noselect"
        on:click={() => navigate('wallet')}>
        <h3 class="primary">
         ¤<Timer expiresAt={$profile.expiresAt} format='¤' />
        </h3>
        <h6 class="muted">wallet</h6>
      </stat>
    {/if}
    <round class="flex column center xcenter noselect" on:click={() => navigate('msgs')}>
      <Icon id="gfx-msgs" nofill/>
      <samp class="notifications-badge" class:zero={!$nCount}>{$nCount}</samp>
      <!-- TODO: read/unread messages tracking not yet implemented -->
    </round>
    <round class="flex column center xcenter noselect" on:click={() => navigate('profile')}>
      {#if !$profilePicture}
        <Icon id="gfx-profile" nofill/>
      {:else}
        <BinaryImage src={$profilePicture} />
      {/if}
    </round>
  </bar>
  {/if}
</root>
<svelte:window on:error={globError} on:unhandledrejection={globReject} />
<style>
.m56 { padding: 0; }
.m56.no-auto { background-color: var(--grave); }

stat.outside h3 { color: var(--muted-color); }
stat.outside h6 { color: var(--ash); }
stat.inside h3 { color: var(--ash); }
stat.inside h6 { color: var(--muted-color); }
</style>
