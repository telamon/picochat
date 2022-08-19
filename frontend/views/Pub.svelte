<script>
import { onMount } from 'svelte'
import { writable, derived } from 'svelte/store'
import {
  state,
  kernel,
  boot,
  Peers,
  Cooldowns,
  Vibes,
  ITEMS,
} from '../api'
import { btok } from '../../blockend/util'
import Timer from '../components/Timer.svelte'
import Portrait from '../components/PeerPortrait.svelte'
import Icon from '../components/Icon.svelte'
import Dialog from '../components/Dialog.svelte'
import { navigate } from '../router'
import { ACTION_CONJURE_WATER } from '../../blockend/transactions'

const cooldowns = Cooldowns()
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

const mintWater = writable(false)
const offerItem = writable(null)
function sendVibe (pk) {
  const transactions = []
  if ($mintWater) {
    transactions.push({ t: ACTION_CONJURE_WATER })
  }
  kernel.sendVibe(pk, transactions)
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
    {#if !$cooldowns.vibe}
      Your <strong class="purple"><purple>vibe</purple></strong> is primed and loaded.
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
              | <blue>¤{$inspectPeer.balance}</blue>
            </h6>
            <h6 class="nogap">
              <!-- {$inspectPeer.state} -->
              💀 <code><Timer expiresAt={$inspectPeer.expiresAt} format="HH:mm:ss"/></code>
            </h6>
          </div>
          <p>{$inspectPeer.tagline}</p>

          <h6>Vibe Options</h6>
          <label for="water">
            <h6>
            <input type="checkbox" name="water" id="water"
              bind:value={$mintWater}
              disabled={$activeVibe?.state === 'match'}>
            mint water {ITEMS[0xD700].image}</h6>
          </label>
          <label for="item">
            <h6>
            <input type="checkbox" name="item" id="item"
              value={!!$offerItem}
              disabled={$activeVibe?.state === 'match'}>
            offer tradeable</h6>
          </label>
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
