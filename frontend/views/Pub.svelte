<script>
import { onMount } from 'svelte'
import { writable } from 'svelte/store'
import {
  state,
  kernel,
  boot,
  Peers,
  Cooldowns,
  Vibes,
} from '../api'
import Timer from '../components/Timer.svelte'
import Portrait from '../components/PeerPortrait.svelte'
import Icon from '../components/Icon.svelte'
import Dialog from '../components/Dialog.svelte'

const cooldowns = Cooldowns()
const peers = Peers()
const vibes = Vibes()
const showFiltersDialog = writable(false)

// Auto-connect to swarm-topic
if (!$state.swarming) boot()
  .catch(console.error.bind(null, 'Auto-connect failed'))

function sendVibe (pk) {
  kernel.sendVibe(pk)
    .catch(err => console.error('Failed sending vibe', err))
}
</script>
<pub-view class="block container">
  <h1 class="view-header">🪩 Club Room</h1>
  <p>
    This is the common room, see someone interesting?<br/>
    Shoot!
  </p>
  {#if !$state.entered}
    Press the <strong>Enter</strong> button to play.
  {:else}
    {#if !$cooldowns.vibe}
      <small>Your 〰️🔫 is primed and loaded!</small>
    {:else}
      <small>Vibe available in <Timer expiresAt={$cooldowns.vibe} format="mm:ss" /></small>
    {/if}
  {/if}
  <div class="row space-between xcenter">
    <h6 class="nogap">Patrons {$peers.length}</h6>
    <a role="button"
       class="outline hpad vgap"
       on:click={() => $showFiltersDialog = true}>
      Filter
    </a>
  </div>
  <peers class="row wrap space-between">
  {#each $peers as peer}
    <!-- TODO: Make a small thumbnail cb style,
      it's awkward to be up in someone's face, when you
      enter a bar you wanna start out as part of a herd -->
    <Portrait peer={peer}>
      <div class="flex row space-between">
        <p class="hpad">
          {peer.tagline}
        </p>
        <div>
          {#if !!$vibes.find(v => v.peerId?.equals(peer.pk)) }
            <small>Waiting</small>
            <Timer expiresAt={$vibes.find(v => v.peerId?.equals(peer.pk)).expiresAt} format="mm:ss" />
          {:else if $state.entered && !$cooldowns.vibe}
            <a role="button"
              class="nofill"
              on:click={() => sendVibe(peer.pk)}>
              <Icon id="gfx-vibe" />
            </a>
          {/if}
        </div>
      </div>
    </Portrait>
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
          <a role="button">reset</a>
          <a role="button" on:click={() => $showFiltersDialog = false}>filter</a>
        </footer>
      </article>
    </Dialog>
  {/if}
</pub-view>
<style>
.view-header {
  border-bottom: 1px solid var(--wizardry);
}
</style>
