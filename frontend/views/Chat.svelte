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
  if (!c.initiator) s = s.reverse()
  return [
    c.initiator ? 'ᛒᛔ' : 'ᛔᛒ',
    c.initiator ? 'ᛖ' : 'ᛗ',
    c.initiator ? 'ᚦ' : 'ᚧ'
  ].map(glyph => {
    const path = scoreGraph(c.graph + glyph).map((n, i) => n - s[i])
      .map(n => nf(n))
    return c.initiator ? path : path.reverse()
  })
})
function nf (n) { return  n > 0 ? `+${n}` : n }

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
  console.log('Bye button pressed')
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
  <header class="container row space-between">
    <div class="row xcenter">
      {#if $chat.peer}
        <portrait><BinaryImage src={$chat.peer.picture} size="70px" /></portrait>
        <div class="column">
          <h1 class="hgap">
            {$chat.peer.name}
          </h1>
          <div class="hgap">
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
  <messages bind:this={messagesElement} class="container">
    <p class="text-center">{rewrite($chat.graph || '')}</p>
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
              ᚦ
              <!--🔥-->
            {:else}
              ᚧ
              <!--❤️-->
            {/if}

          </sym>
        {:else}
          <txt>{message.content}</txt>
        {/if}
      </msg>
    {/each}
    <msg class="row xcenter center">
      <balance class:inv={!$chat.initiator}>
        {#if $chat.initiator}
          <black>{$score[1]}</black>
          <white>{$score[0]}</white>
        {:else}
          <white>{$score[0]}</white>
          <black>{$score[1]}</black>
        {/if}
      </balance>
    </msg>
  </messages>
  <ctrls>
  {#if $chat.state === 'active'}
    <h2 class="text-center nogap">
        {#if $chat.myTurn}
          Your turn
        {:else}
          Waiting
        {/if}
    </h2>
    <div class="row space-between">
      {#if !$showInput}
      <button class="hgap" disabled={!$chat.myTurn}
        on:click={() => end(0)}>end</button>

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
    <div class="row space-between">
      <samp>{$preview[0].join('/')}</samp>
      <samp>{$preview[1].join('/')}</samp>
      <samp>{$preview[2].join('/')}</samp>
    </div>
  {:else if $chat.state === 'end'}
    <!-- depricated end-game glyph, cool if-logic
      {#if $chat.messages % 2}
        ended by responder
      {:else}
        ended by initator
      {/if}
    -->
    <h2 class="text-center nogap">Conversion ended</h2>
  {:else}
    <h2 class="text-center nogap">{$chat.state}</h2>
  {/if}
  </ctrls>
</chat>
<style>
header h1, header h2, header h3 { margin-bottom: unset; }
.black header, .black header h1, .black header h2, .black header h3 {
  background-color: var(--p2);
  color: var(--ash);
}
/* header { margin-top: 1em; }*/
portrait {
  border-radius: 4px;
  overflow: hidden;
  height: 70px;
  width: 70px;
  box-shadow: var(--card-box-shadow);
}
messages {
  display: block;
  /* height: 59vh;*/
  overflow-y: scroll;
  overflow-x: hidden;
}
/* Common */
msg {
  margin-bottom: 0.4em;
}
msg txt {
  border-radius: 2em;
  display: inline-block;
  padding: 0.2em 1.5em;
  max-width: 65%;
}
/* White */
.white msg.local txt, .black msg.remote txt {
  color: var(--p2);
  background-color: var(--p1);
  border: 1.6px solid var(--ash);

  /*
  border: 1.4px solid var(--reef);
  box-shadow: 0 0 3px var(--wizardry);
  margin: 2px;
  */
}
/* Black */
.white msg.remote txt, .black msg.local txt {
  color: var(--p1);
  background-color: var(--p2);
  border: 1.4px solid var(--p1);
}


msg sym {
  --sz: 1.6em;
  display: inline-block;
  line-height: calc(var(--sz) * 0.93);
  width: var(--sz);
  height: var(--sz);
  font-size: calc(var(--sz) * 0.8);
  border-radius: 50%;
  vertical-align: middle;
  text-align: center;
}
/* White Ev/Glyph/Pass */
.white msg.local sym, .black msg.remote sym {
  color: var(--p2);
  background-color: var(--p1);
  border: 1.4px solid gold;
  box-shadow: 0 0 5px var(--ember);
}

/* Black Ev/Glyph/Pass */
.white msg.remote sym, .black msg.local sym {
  color: var(--p1);
  background-color: var(--p2);
  border: 1.4px solid var(--wizardry); /*var(--p1);*/
  box-shadow: 0 0 5px var(--blood);
}
</style>
