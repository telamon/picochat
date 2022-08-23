<script>
import { ITEMS  } from '../api'
import { writable } from 'svelte/store'
import Dialog from '../components/Dialog.svelte'
export let item = undefined
export let items = []
// items = Object.values(ITEMS)
const pop = writable(false)

function select (id) {
  $pop = false
  item = id
}
</script>
<item-input role="list">
  {#if $pop}
    <Dialog>
      <backdrop>
        {#if items?.length}
        <inventory role="listbox">
          <item role="button"
            on:click={() => select(null)}>
            <emo>❌</emo>
          </item>{#each items as i}
            <item role="button" class={ITEMS[i.id].category}
              on:click={() => select(i.id)}>
              <emo>{ITEMS[i.id].image}</emo>
            </item>
          {/each}
        </inventory>
        {:else}
          <article>
            <slot>No items</slot>
            <footer>
              <button on:click={() => $pop = false}>ok</button>
          </article>
        {/if}
      </backdrop>
    </Dialog>
  {/if}
  <inventory on:click={() => $pop = !$pop}>
    {#if item}
    <item role="button" class={ITEMS[item].category}>
      <emo>{ITEMS[item].image}</emo>
    </item>
    {/if}
  </inventory>
</item-input>
<style>
backdrop inventory {
  width: calc(var(--sb) * 3);
}
</style>
