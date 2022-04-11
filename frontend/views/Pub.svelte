<script>
import { onMount } from 'svelte'
import {
  state,
  kernel,
  boot,
  connectSwarm,
  Peers,
  Cooldowns,
  Vibes,
} from '../api'
import Timer from '../components/Timer.svelte'
import Portrait from '../components/PeerPortrait.svelte'
import Icon from '../components/Icon.svelte'
const cooldowns = Cooldowns()
const peers = Peers()
const vibes = Vibes()
// Auto-connect to swarm-topic
if (!$state.swarming) boot()
  .catch(console.error.bind(null, 'Auto-connect failed'))

function sendVibe (pk) {
  kernel.sendVibe(pk)
    .catch(err => console.error('Failed sending vibe', err))
}
</script>
<pub-view>
  <h1>🪩 Club Room</h1>
  <p>
    This is the common room, see someone interesting?<br/>
    Shoot!
  </p>
  {#if !$cooldowns.vibe}
    <small>Your 〰️🔫 is primed and loaded!</small>
  {:else}
    <small>Vibe available in {$cooldowns.vibe}</small>
  {/if}
  <div class="row space-between xcenter">
    <h6 class="nogap">Patrons {$peers.length}</h6>
    <a role="button" class="outline hpad vgap">Filter</a>
  </div>
  <peers class="column xcenter">
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
            <Timer expiresAt={$vibes.find(v => v.peerId?.equals(peer.pk)).expiresAt} format="mm:ss" />
          {:else}
            <a role="button" class="nofill" on:click={() => sendVibe(peer.pk)}>
              <Icon id="gfx-vibe" />
            </a>
          {/if}
        </div>
      </div>
    </Portrait>
  {/each}
  </peers>
</pub-view>
<style>
</style>
