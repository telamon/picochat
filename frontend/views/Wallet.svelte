<script>
import { writable, derived } from 'svelte/store'
import { Profile, kernel } from '../api'
import { ITEMS } from '../../blockend/items.db'
import Timer from '../components/Timer.svelte'
import Dialog from '../components/Dialog.svelte'
import ItemDescription from '../components/ItemDescription.svelte'
const profile = Profile()
const inventory = derived(profile, p => {
  if (p.state === 'loading') return []
  // dev-inventory
  // return Object.keys(ITEMS).map(id => ({ id, qty: 1}))
  return p.inventory.filter(i => i.qty)
})
const showItem = writable(false)
async function consume (id) {
  await kernel.useItem(id)
    .then(sig => console.log('Consumed item', id, sig))
    .catch(err => console.error('Failed consuming', id, err))

  $showItem = false
}
function toggle (id) {
  console.info('todo implement item activation')
}
</script>
<wallet-view>

  <div class="row column xcenter start">
    <!-- For the record: I perfer the term "inventory" but wallet is shorter and relatable -->
    <h1 class="nogap">Balance</h1>
    <h1>¤{$profile.balance}</h1>
    <div>
      <h6 class="nogap">
        💀 <code><Timer expiresAt={$profile.expiresAt} format="HH:mm:ss"/></code>
      </h6>
      Score {$profile.score}<br/>
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
