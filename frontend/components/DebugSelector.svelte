<script>
import { writable } from 'svelte/store'
import debug from 'debug'
import Dialog from './Dialog.svelte'
export let open = null ?? writable(false)
// patterns.map(name => ({ name, enabled: debug.enabled(name) }))
const patterns = [
  '*',
  'hyper*',
  'pico*',
  'picochat:kernel',
  'picochat:mod:*',
  'picochat:mod:net',
  'picochat:mod:gc',
  'picochat:mod:reg',
  'picochat:slice*'
]
const namespaces = writable(debug.namespaces)

function set (value) {
  if (value === '') {
    debug.disable()
    $namespaces = ''
  } else {
    debug.enable(value)
    $namespaces = debug.namespaces
  }
}

</script>
<Dialog open={$open} on:fade={() => $open = false}>
  <article>
    <h6>namespaces</h6>
    <input type="text" bind:value={$namespaces} />
    <h6>quickfilters</h6>
    <div><a on:click={() => set('')}><code>DEBUG:OFF</code></a></div>
    {#each patterns as pattern}
      <div>
        <a on:click={() => set(pattern)}><code>{pattern}</code></a>
      </div>
    {/each}
    <footer>
      <!--
      <a href="#cancel" role="button" class="secondary" on:click={() => $open = false}>Cancel</a>
      <a href="#confirm" role="button" on:click={() => $open = false}>Confirm</a>
      -->
      <button on:click={() => $open = false}>ok</button>
    </footer>
  </article>
</Dialog>
<style>
</style>
