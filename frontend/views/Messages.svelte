<script>
import { writable } from 'svelte/store'
import PendingVibe from '../components/PendingVibe.svelte'
import PeerPortrait from '../components/PeerPortrait.svelte'
import Timer from '../components/Timer.svelte'
import Dialog from '../components/Dialog.svelte'
import Icon from '../components/Icon.svelte'
import BinaryImage from '../components/BinaryImage.svelte'
import {
  kernel,
  Vibes,
  Chats
} from '../api'
import { navigate } from '../router'
const chats = Chats()
const vibes = Vibes()
const vibeDetail = writable(null)
function respondVibe (chatId, rejected) {
  kernel.respondVibe(chatId, rejected)
    .then(() => { $vibeDetail = null })
    .catch(err => console.error('Vibe response failed', err))
}
</script>
<messages-view class="block container">
  <h1>💌 Messages</h1>
  <h5>Vibes</h5>
  <vibes class="row xcenter">
  {#each $vibes as vibe}
    {#if vibe.state !== 'match'}
    <div on:click={() => $vibeDetail = vibe}>
      <PendingVibe vibe={vibe}/>
    </div>
    {/if}
  {/each}
  </vibes>
  <h5>Conversations</h5>
  <conversations>
  {#each $chats as chat}
    <div class="row space-between"
      on:click={() => navigate('/chat/' + chat.id.toString('hex'))}>
      <div class="row xcenter">
        <BinaryImage src={chat.peer.picture} size="80px"/>
        <div class="columns space-between gap">
          <h3 class="no-margin">{chat.peer.name}</h3>
          <h6 class="no-margin">{chat.myTurn ? 'your turn' : 'waiting'}</h6>
        </div>
      </div>
      <div class="columns xcenter gap">
        <health>
          {#each [0, 1, 2] as n}
            {#if n < chat.health}
              <Icon id="heal_resp" tag="full" />
            {:else}
              <Icon id="heal_resp" tag="empty" />
            {/if}
          {/each}
        </health>
        <h3 class="no-margin"><Timer expiresAt={chat.expiresAt} format="mm:ss" /></h3>
      </div>
    </div>
  {/each}
  </conversations>
  {#if $vibeDetail}
  <Dialog open={true} on:fade={() => $vibeDetail = null}>
    <PeerPortrait peer={$vibeDetail.peer}>
      <p>{$vibeDetail.peer.tagline}</p>
      <h6 class="text-center no-margin">Vibe Expires in</h6>
      <h2 class="text-center timer"><Timer expiresAt={$vibeDetail.expiresAt} format="mm:ss"/></h2>
      {#if !$vibeDetail.initiator}
        <div class="text-center">
          <a role="button" class="reject" on:click={() => respondVibe($vibeDetail.id, true)}>reject</a>
          <a role="button" class="accept" on:click={() => respondVibe($vibeDetail.id)}>accept</a>
        </div>
      {:else}
        <div class="text-center">Waiting for player2</div>
      {/if}
      <br/>
    </PeerPortrait>
  </Dialog>
  {/if}
</messages-view>
<style>
.reject { color: var(--blood); }
.accept { color: var(--wizardry); }
.timer { margin-top: 0; margin-bottom: 0.5em; }
chat { border-bottom: 1px solid var(--ash); }
</style>
