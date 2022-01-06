<script>
import { onMount } from 'svelte'
import {
  state,
  kernel,
  boot,
  connectSwarm,
  Peers,
  Cooldowns
} from '../api'
import Portrait from '../components/PeerPortrait.svelte'
const cooldowns = Cooldowns()
const peers = Peers()
onMount(() => peers.subscribe(peers => {
  console.log('Peers changed', peers.length, peers.map(p => p.name))
}))
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
  <p>
    Pub description occupying a couple of lines
  </p>
  <h6>Peers {$peers.length}</h6>
  <peers class="columns">
  {#each $peers as peer}
    <Portrait peer={peer}>
      <div class="flex row space-between">
        <p>{peer.tagline}</p>
        <a role="button" on:click={() => sendVibe(peer.pk)}><img src="/gfx/gfx-vibe.svg"></a>
      </div>
    </Portrait>
  {/each}
  </peers>
</pub-view>
<style>
</style>
