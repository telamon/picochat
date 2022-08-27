<script>
import { onMount } from 'svelte'
import { writable, derived } from 'svelte/store'
import {
  state,
  kernel,
  boot,
  Peers,
  Cooldowns,
  Profile,
  Vibes,
} from '../api'
import { cart } from '../network-cart'
import { ITEMS } from '../../blockend/items.db'
import { btok } from '../../blockend/util'
import Timer from '../components/Timer.svelte'
import Portrait from '../components/PeerPortrait.svelte'
import Icon from '../components/Icon.svelte'
import Dialog from '../components/Dialog.svelte'
import ItemInput from '../components/ItemInput.svelte'
import { navigate } from '../router'
import { ACTION_OFFER, ACTION_NETWORK_PURCHASE } from '../../blockend/transactions'
const profile = Profile('profile')
const cooldowns = Cooldowns('cd')
const peers = Peers()
const vibes = Vibes()
const showFiltersDialog = writable(false)
const inspectPeer = writable(false)
const activeVibe = derived([vibes, inspectPeer], ([vs, peer]) => {
    const empty = { state: 'none' }
    return !peer
      ? empty
      : vs.find(v => v.peerId?.equals(peer.pk)) || empty
})
// Auto-connect to swarm-topic
if (!$state.swarming) boot()
  .catch(console.error.bind(null, 'Auto-connect failed'))

const attachment = writable(null)
const availableAttachments = derived(profile, p => {
  if (!p.inventory) return []
  const items = p.inventory.filter(i => !ITEMS[i.id].soulbound && i.qty)
    .map(i => i.id)
  return items
})


function sendVibe (pk) {
  const transactions = []
  for (const item of $cart) {
    transactions.push({
      t: ACTION_NETWORK_PURCHASE,
      p: { i: item.id, q: item.qty }
    })
  }
  if ($attachment) {
    transactions.push({ t: ACTION_OFFER, p: { i: $attachment, q: 1 } })
  }

  kernel.sendVibe(pk, transactions)
    .then(() => $cart = [])
    .catch(err => console.error('Failed sending vibe', err))
}

</script>
<pub-view class="block container">
  <h1 class="view-header">Club Room</h1>
  <p>
    This is the common room, see someone interesting?<br/>
    Shoot!
  </p>
  <p>
  {#if !$state.entered}
    Press the <strong>START</strong> button to play.
  {:else}
    {#if $cooldowns.canVibe}
      Your
        <strong
          data-tooltip="Initiate a conversation, cooldown 5min"
          data-placement="right">
          <purple>vibe</purple>
        </strong>
      is primed and loaded.
      <sup>Pow pow! 〰️🔫</sup>
    {:else}
      Vibe available in again <Timer expiresAt={$cooldowns.vibe} format="mm:ss" />
    {/if}
  {/if}
  </p>
  <div class="row space-between xcenter">
    <h6 class="nogap">Patrons {$peers.length}</h6>
    <b role="button"
       class="outline hpad vgap"
       on:click={() => $showFiltersDialog = true}>
      Filter
    </b>
  </div>
  <peers class="row wrap center">
  {#each $peers as peer}
    <!-- TODO: Make a small thumbnail cb style,
      it's awkward to be up in someone's face, when you
      enter a bar you wanna start out as part of a herd -->
    <div on:click={() => $inspectPeer = peer}>
      <Portrait peer={peer}>
        <div class="flex row space-between pad">
          <p class="nogap">
            {peer.tagline}
          </p>
        </div>
      </Portrait>
    </div>
  {/each}
  </peers>
  {#if $showFiltersDialog}
    <Dialog open={true} on:fade={() => $showFiltersDialog = false}>
      <article>
        <h6>Genders</h6>
        <fieldset>
          <label for="m">
            <input type="checkbox" id="m" name="m" role="switch">
            M
          </label>
        </fieldset>
        <fieldset>
          <label for="f">
            <input type="checkbox" id="f" name="f" role="switch">
            F
          </label>
        </fieldset>
        <fieldset>
          <label for="nb">
            <input type="checkbox" id="nb" name="nb" role="switch">
            NB
          </label>
        </fieldset>
        <h6>Distance</h6>
        <label for="distance">
          GLOBAL
          <input type="range" min="0" max="100" value="100" id="distance" name="distance">
        </label>
        <footer>
          <b role="button">reset</b>
          <b role="button" on:click={() => $showFiltersDialog = false}>filter</b>
        </footer>
      </article>
    </Dialog>
  {/if}
  {#if $inspectPeer}
    <Dialog on:fade={() => $inspectPeer = false}>
      <div>
        <Portrait peer={$inspectPeer}>
          <span slot="nw"></span>
        </Portrait>
        <article class="nogap">
          <div class="row space-between xcenter">
            <h6 class="nogap">
              Score {$inspectPeer.score}
              | ¤{$inspectPeer.balance}
            </h6>
            <h6 class="nogap">
              <!-- {$inspectPeer.state} -->
              💀 <code><Timer expiresAt={$inspectPeer.expiresAt} format="HH:mm:ss"/></code>
            </h6>
          </div>
          <p>{$inspectPeer.tagline}</p>
          <br/>
          <div class="column end xcenter">
              <h6 class="nogap">Attachments</h6>
              <ItemInput bind:item={$attachment}
                items={$availableAttachments}>
                <p>
                  You don't have anything to offer.<br/>
                  <a href="#/shop">Visit the bar to get items</a>
                </p>
              </ItemInput>
          </div>
          {#if $cart.length}
          <div class="text-right">
            Delivery: {#each $cart as item}{ITEMS[item.id].image}{/each}
          </div>
          {/if}
          <footer>
            {#if !$state.entered}
              <div class="text-right">
                <sup class="hpad">Press START to play</sup>
              </div>
            {/if}
            <div class="row space-between">
              <button class="hgap" on:click={() => $inspectPeer = false}>ok</button>
              {#if !$state.entered}
                <button class="hgap purple" disabled>vibe</button>
              {:else if $state.entered && !$cooldowns.vibe}
                <button class="hgap purple" on:click={() => sendVibe($inspectPeer.pk)}>
                  vibe
                </button>
              {:else if $activeVibe?.state === 'match'}
                <button class="hgap green"
                  on:click={() => navigate(`chat/${btok($activeVibe.id)}`)}>
                  chat
                </button>
              {:else}
                <button class="hgap red" disabled>
                  <Timer expiresAt={$cooldowns.vibe} format="mm:ss" />
                </button>
              {/if}
            </div>
          </footer>
        </article>
      </div>
    </Dialog>
  {/if}
</pub-view>
