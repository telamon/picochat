<script>
import { afterUpdate } from 'svelte'
import { writable, derived } from 'svelte/store'
import { Chat } from '../api'
import BinaryImage from '../components/BinaryImage.svelte'
import Icon from '../components/Icon.svelte'
import Timer from '../components/Timer.svelte'
import { rewrite, scoreGraph } from '../../blockend/game'
export let id

let messagesElement
let inputElement
const chat = Chat(id, 'Chat')
const showInput = writable(false)
const line = writable('')

// Auto-bye
$: if ($chat.state === 'finalizing' && $chat.myTurn) end()

const health = derived(chat, c =>
  Array.from(new Array(3)).map((_, n) => n < c.health)
)

const score = derived(chat, c => {
  if (!c.graph) return [0, 0]
  return c.initiator
    ? scoreGraph(c.graph)
    : scoreGraph(c.graph).reverse()
})

const preview = derived([chat, score], ([c, s]) => {
  if (!c.graph) return [[0, 0], [0, 0], [0, 0]]
  return [
    c.initiator ? 'ᛒᛔ' : 'ᛔᛒ',
    c.initiator ? 'ᛖ' : 'ᛗ',
    c.initiator ? 'ᚦ' : 'ᚧ'
  ].map(glyph =>
    c.initiator
      ? scoreGraph(c.graph + glyph)
      : scoreGraph(c.graph + glyph).reverse()
  )
})

// Auto-scroll
afterUpdate(() => {
  messagesElement.scrollTo({
    top: messagesElement.scrollHeight,
    left: 0,
    behaviour: 'smooth'
  })
  if ($showInput) inputElement.focus()
})

function sendMessage () {
  $chat.send($line.trim())
    .then(() => {
      console.info('Message published')
      $line = ''
      $showInput = false
    })
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
<chat class:white={$chat.initiator} class:black={!$chat.initiator}>
  <header class="row space-between">
    <div class="row">
      {#if $chat.peer}
        <portrait><BinaryImage src={$chat.peer.picture} size="70px" /></portrait>
        <div class="column">
          <h1 class="hgap">{$chat.peer.name}</h1>
          <div class="hgap">
            <pill><black>{$score[1]}</black><white>{$score[0]}</white></pill>
            {rewrite($chat.graph || '')}
          </div>
        </div>
      {:else}
        <placeholder aria-busy="true">&nbsp;</placeholder>
      {/if}
    </div>
    <div class="column xend">
      <health>
        {#each $health as heart}
          {#if heart}
            <Icon id="heal_resp" tag="full" />
          {:else}
            <Icon id="heal_resp" tag="empty" />
          {/if}
        {/each}
      </health>
      <h3><Timer expiresAt={$chat.expiresAt} format="mm:ss" /></h3>
    </div>
  </header>
  <messages bind:this={messagesElement}
    class="nogap">
    {#each $chat.messages as message}
      <msg
        class="row xcenter"
        class:start={message.type === 'received'}
        class:remote={message.type === 'received'}
        class:local={message.type === 'sent'}
        class:end={message.type === 'sent'}>
        {#if message.pass}
          <sym class="hgap">
            {#if ($chat.initiator && message.type === 'sent') ||
                (!$chat.initiator && message.type === 'received')
            }
              <samp>PASS</samp>
              ᚦ
              <!--<Icon id="pass_resp" tag="white" />-->
            {:else}
              <!--<Icon id="pass_resp" tag="black" />-->
              ᚧ
              <samp>PASS</samp>
            {/if}
          </sym>
        {:else}
          <txt>{message.content}</txt>
        {/if}
      </msg>
    {/each}
  </messages>
  {#if $chat.state === 'active'}
    <h2 class="text-center nogap">
        {#if $chat.myTurn}
          Your turn
        {:else}
          Waiting
        {/if}
    </h2>
    <div class="row space-between">

      <samp>{$preview[0].join('/')}</samp>
      <samp>
      {$preview[1].join('/')}
        <div class="☯">&nbsp;</div>
      </samp>
      <samp>{$preview[2].join('/')}</samp>
    </div>
    <div class="row space-between">
      {#if !$showInput}
      <button class="hgap" disabled={!$chat.myTurn}
        on:click={end.bind(null, 0)}>end</button>

      <button class="hgap"
        disabled={!$chat.myTurn}
        on:click={() => $showInput = true}>
        msg
      </button>

      <button class="hgap" disabled={!$chat.myTurn}
        on:click={pass}>
        pass
      </button>
      {:else}
        <input bind:this={inputElement}
          class="line"
          bind:value={$line}
          on:keypress={onKeyPress}
          on:blur={() => $showInput = !!$line.length} />
      {/if}
    </div>
  {:else if $chat.state === 'end'}
    <h1 class="text-center nogap">
      {#if $chat.messages % 2} <!-- ended by responder -->
        <Icon id="bye_resp" tag="black" /><Icon id="bye_res_init" tag="white" />
      {:else} <!-- ended by initator -->
        <Icon id="bye_init" tag="white" /><Icon id="bye_res_resp" tag="black" />
      {/if}
    </h1>
    <h2 class="text-center nogap">Conversion ended</h2>
  {:else}
    <h2 class="text-center nogap">{$chat.state}</h2>
  {/if}
</chat>
<style>
header h1, header h2, header h3 { margin-bottom: unset; }
header { margin-top: 1em; }
portrait {
  border-radius: 4px;
  overflow: hidden;
  height: 70px;
  width: 70px;
  box-shadow: var(--card-box-shadow);
}
messages {
  display: block;
  height: 59vh;
  overflow-y: scroll;
  overflow-x: hidden;
}
/* Common */
msg txt {
  border-radius: 2em;
  display: inline-block;
  padding: 0.2em 1.5em;
  max-width: 65%;
  margin-bottom: 0.4em;
}
/* White */
.white msg.local txt, .black msg.remote txt {
  color: var(--p2);
  background-color: var(--p1);
  border: 1.4px solid var(--p2);
}
/* Black */
.white msg.remote txt, .black msg.local txt {
  color: var(--p1);
  background-color: var(--p2);
  border: 1.4px solid var(--p1);
}
msg sym { font-size: x-large; }
</style>
