<script>
/**
* This component is not in use.
* After a hard think, decided to simplify the transaction system.

* - collectible: just a gimmick
* - passive: effects while in inventory
* - active: self toggle, has cooldown
* - consumable: self use, can be attached to transfer effects to other peer on timeunlock
* - attachment: consumed on timelock.
    - affects chat (minigames)
    - applies effect on timeunlock (give beer)

*/
import { ITEMS  } from '../api'
import { writable } from 'svelte/store'
import Dialog from '../components/Dialog.svelte'
import {
  ACTION_CONJURE_WATER
} from '../../blockend/transactions'
export let attachments
export let items = Object.values(ITEMS)
const id = writable(0)
const pop = writable(false)
function add (t) {
  $pop = false
  $attachments.push(t)
}
function addConjureWater () {
  add({ t: ACTION_CONJURE_WATER })
}
function offer (i, q = 1) {
  add({ t: ACTION_OFFER, p: { i: $id, q } })
}
</script>
<attachments>
  {#if $pop}
    <Dialog on:fade={() => $pop = false}>
      <backdrop>
        {#if $id}
          <preview class="column xcenter">
            <h5 class="nogap">{ITEMS[$id].name}</h5>
            <emo>{ITEMS[$id].image}</emo>
          </preview>
        {/if}
        {#if items?.length}
        <inventory role="listbox">
          <item role="button"
            class:selected={$id === 0}
            on:click={() => select(null)}>
            <emo>❌</emo>
          </item>{#each items as i}
            <item role="button" class={ITEMS[i.id].category}
              class:selected={$id === i.id}
              on:click={() => $id = i.id}>
              <emo>{ITEMS[i.id].image}</emo>
            </item>
          {/each}
        </inventory>
        {:else}
          <article>
            You don't have anything to trade
            <footer>
              <button on:click={() => $pop = false}>ok</button>
          </article>
        {/if}
        <div class="row space-between xcenter">
          <button class="hgap">use</button>
          <button class="hgap">offer</button>
        </div>
        <br/>
      </backdrop>
    </Dialog>
  {/if}
  <inventory on:click={() => $pop = !$pop}>
    {#if $id}
    <item role="button" class={ITEMS[$id].category}>
      <emo>{ITEMS[$id].image}</emo>
    </item>
    {/if}
  </inventory>
</attachments>
<style>
backdrop {
  background-color: var(--slate);
}
backdrop inventory {
  width: calc(var(--sb) * 4);
}

backdrop preview h5 { color: var(--bone); }
backdrop preview emo {
  font-size: 3rem;
  aspect-ratio: 1;
  text-align: center;
  display: inline-block;
  background: var(--ash);
  border-radius: 50%;
  text-shadow: 0px 1px 3px var(--pitch);
}
</style>
