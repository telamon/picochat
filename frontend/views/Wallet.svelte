<script>
import { Profile, ITEMS } from '../api'
import Timer from '../components/Timer.svelte'
const profile = Profile(true)
</script>
<wallet-view>
  <!-- For the record: I perfer the term "inventory" but wallet is shorter and relatable -->
  <h2 class="text-center nogap">Balance</h2>
  <h1 class="text-center">¤ <Timer expiresAt={$profile.expiresAt} format="¤¤"/></h1>
  <h1 class="text-center nogap">Inventory</h1>
  <inventory class="flex wrap">
    {#if $profile.inventory}
      {#each $profile.inventory as item}
        <item>{ITEMS[item.id].image} {item.qty}</item>
      {/each}
    {/if}
  </inventory>
</wallet-view>
