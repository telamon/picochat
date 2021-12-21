<script>
  // export let KConfig, kernel
  import { writable, derived } from 'svelte/store'
  import { view, setView, navigate } from './router'
  import { boot, kernel, Connections, enterPub } from './api'
  const booting = boot()
  const conn = Connections()
  const theme = writable()
  const showBar = derived(booting, s => s.hasKey)
  const showDev = writable(true)

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
    window.location.reload()
  }
  function toggleTheme () {
    $theme = $theme ? undefined : 'dark'
  }
  async function connect () {
    await enterPub()
  }
</script>

<root data-theme={$theme}>
  {#if $showDev}
  <!-- Developer bar -->
  <dev-bar class="flex row xcenter space-between">
    <div >
      K[{$booting.state}]
      ID²[{$booting.hasKey ? 1 : 0}]
      P[{$booting.hasProfile ? 1 : 0}]
      e[{$booting.entered ? 1 : 0}]
      m56[{$conn}]
    </div>
    <div>
      <btn on:click={toggleTheme}>t</btn>
      <btn on:click={inspectFeed}>i</btn>
      <btn class="danger" on:click={purge}>X</btn>
    </div>
  </dev-bar>
  {/if}

  <!-- Main container -->
  <main class={`container ${$showDev && 'has-dev'} ${$showBar && 'has-bar'}`}>
    <!-- <svelte:component this={$route.component} {...$route.params} />-->
    <svelte:component this={$view} />
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
    <stat class="flex column center xcenter" on:click={connect}>
      <h3>00:35</h3>
      <h6>enter</h6>
    </stat>
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
</style>
