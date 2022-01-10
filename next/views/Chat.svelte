<script>
import { writable } from 'svelte/store'
import { Chat } from '../api'
import BinaryImage from '../components/BinaryImage.svelte'
import Icon from '../components/Icon.svelte'
import Timer from '../components/Timer.svelte'
export let id
const chat = Chat(id, true)
const showInput = writable(false)
const line = writable('')

function sendMessage () {
  $chat.send($line.trim())
    .then(() => console.info('Message published'))
    .catch(err => console.error('Failed publishing Message', err))
}

function end (gesture = 0) {
  $chat.bye(gesture)
    .then(() => console.info('Bye published'))
    .catch(err => console.error('Failed publishing Bye', err))
}

function pass () {
  $chat.pass()
    .then(() => console.info('Pass published'))
    .catch(err => console.error('Failed publishing Pass', err))
}

function onKeyPress ({ charCode }) {
  switch (charCode) {
    case 13:
      sendMessage()
      break
    default:
      break
  }
}
</script>
<chat>
  <header class="row space-between vgap">
    <div class="row">
      {#if $chat.peer}
        <portrait><BinaryImage src={$chat.peer.picture} size="70px" /></portrait>
        <h1 class="hgap">{$chat.peer.name}</h1>
      {:else}
        <placeholder aria-busy="true">&nbsp;</placeholder>
      {/if}
    </div>
    <div class="column xend">
      <health>❤❤❤</health>
      <h3><Timer expiresAt={$chat.expiresAt} format="mm:ss" /></h3>
    </div>
  </header>
  <messages>
    {#each $chat.messages as message}
      <msg
        class:black={
          ($chat.initator && message.type === 'received')
          || (!$chat.initator && message.type === 'sent')
        }
        class:remote={message.type === 'received'}
        >
        <txt>{message.content}</txt>
      </msg>
    {/each}
  </messages>
  <h2 class="text-center nogap">
    {#if $chat.state === 'active'}
      {#if $chat.myTurn}
        Your turn
      {:else}
        Waiting
      {/if}
    {:else}
      {$chat.state}
    {/if}
  </h2>
  <div class="row space-between">
    {#if !$showInput}
    <button class="gap" disabled={!$chat.myTurn}
      on:click={() => end()}>end</button>
    <button class="gap"
      disabled={!$chat.myTurn}
      on:click={() => $showInput = true}>
      msg
    </button>
    <button class="gap" disabled={!$chat.myTurn}
      on:click={() => $showInput = true}>
      pass
    </button>
    {:else}
      <input class="line" bind:value={$line} on:keypress={onKeyPress}/>
    {/if}
  </div>
</chat>
<style>
portrait {
  border-radius: 4px;
  overflow: hidden;
  height: 70px;
  width: 70px;
  box-shadow: var(--card-box-shadow);
}
messages {
  display: block;
  height: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
}
msg {
  display: block;
  text-align: right;
}
msg.remote {
  text-align: left;
}
msg txt {
  color: var(--pitch);
  background-color: var(--bone);
  border-radius: 2em;
  display: inline-block;
  border: 2px solid var(--pitch);
  padding: 0.2em 1.5em;
  max-width: 85%;
  margin-bottom: 0.4em;
}
msg.black txt {
  color: var(--bone);
  background-color: var(--pitch);
  border: 2px solid var(--bone);
}

</style>
