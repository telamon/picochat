<script>
import { writable, derived } from 'svelte/store'
import { Profile, ITEMS } from '../api'
import Timer from '../components/Timer.svelte'
import Dialog from '../components/Dialog.svelte'
import ItemDescription from '../components/ItemDescription.svelte'
const profile = Profile(true)
const inventory = derived(profile, p => {
  // dev-inventory
  // return Object.keys(ITEMS).map(id => ({ id, qty: 1}))
  return p.inventory || []
})
const showItem = writable(false)
function consume (id) {
  console.info('Todo implement item consumption')
}
function activate (id) {
  console.info('todo implement item activation')
}
</script>
<wallet-view>

  <div class="row column xcenter start">
    <!-- For the record: I perfer the term "inventory" but wallet is shorter and relatable -->
    <h1 class="nogap">Balance</h1>
    <h1>¤ <Timer expiresAt={$profile.expiresAt} format="¤¤"/></h1>
    <div>
      <!-- hang on... wasn't the total amount of score gained supposed
          to be the ingame currency???
          Consuming drinks give score + bump expiresAt.
          But what's more important to show in bottom-bar,
          balance or time until death?
      -->
      Score {$profile.score}<br/>
      Total ¤{Math.floor((Math.min(Date.now(), $profile.expiresAt) - $profile.date) / 1000)}<br/>
      <small>Oops.. have to redo the scoring</small><br/>
    </div>
    <h1>&nbsp;</h1>
    <h1 class="nogap">Inventory</h1>
    <inventory>
      {#each $inventory as i}
        <item role="button" class={ITEMS[i.id].category}
          on:click={() => $showItem = i}>
          <emo>{ITEMS[i.id].image}</emo>
          {#if ITEMS[i.id].type === 'consumable'}{i.qty}{/if}
        </item>
      {/each}
    </inventory>
    {#if $showItem}
      <Dialog open={true} on:fade={() => $showItem = false}>
        <article>
          <ItemDescription id={$showItem.id} />
          <footer class="row space-between">
            <button class="hgap" on:click={() => $showItem = false}>ok</button>
            {#if ITEMS[$showItem.id].type === 'consumable'}
              <button class="hgap" on:click={() => consume($showItem.id)}>Use</button>
            {/if}
            {#if ITEMS[$showItem.id].type === 'active'}
              <button class="hgap" on:click={() => toggle($showItem.id)}>
                Activate
              </button>
            {/if}
          </footer>
        </article>
      </Dialog>
    {/if}
  </div>
</wallet-view>
