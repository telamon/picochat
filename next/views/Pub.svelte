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
const vibes = Vibes('Pub.svlt:$vibes')
// Auto-connect to swarm-topic
if (!$state.swarming) boot()
  .catch(console.error.bind(null, 'Auto-connect failed'))

function sendVibe (pk) {
  kernel.sendVibe(pk)
    .catch(err => console.error('Failed sending vibe', err))
}
</script>
<pub-view>
  <h1>PubName</h1>
  <p> {$vibes.length}
    Pub description occupying a couple of lines
  </p>
  <h6>Peers {$peers.length}</h6>
  <peers class="column xcenter">
  {#each $peers as peer}
    <Portrait peer={peer}>
      <div class="flex row space-between">
        <p class="hpad">
          {peer.tagline}
        </p>
        <div>
          {#if !!$vibes.find(v => v.peerId?.equals(peer.pk)) }
            <Timer expiresAt={$vibes.find(v => v.peerId?.equals(peer.pk)).expiresAt} format="mm:ss" />
          {:else}
            <a role="button" on:click={() => sendVibe(peer.pk)}>
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
