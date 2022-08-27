<script>
import { getDistance } from 'geolib'
import BinaryImage from './BinaryImage.svelte'
import { kernel, decodePk } from '../api'
import { ITEMS } from '../../blockend/items.db'
export let peer
export let size = 'normal'
let distance = null
// Let's leave distances alone it alone for now.
/*
if (kernel.pk) {
  const a = decodePk(kernel.pk)
  const b = decodePk(peer.pk)
  distance = getDistance(a, b, 1000)
}
*/
const inv = peer.inventory || []
</script>
  <article class="peer">
    <legend>
      <overlay>
        <div style="grid-area: nw;" class="hpad">
          <slot name="nw">
            <h3>
              <dot class={peer.state} data-tooltip={peer.state}>&nbsp;</dot>
              {peer.score}
            </h3>
          </slot>
        </div>
        <div style="grid-area: sw; align-self: end;" class="hpad">
          <h2>{peer.name}</h2>
        </div>
        <div style="grid-area: se; align-self: end; justify-self: end;" class="end">
          <h2>
            {#each inv as item}
              <!-- TODO: lookup inventory.yaml for:
                attr:title = item.short
                img = item.gfx
                on:click => $showItemPopup(item.id) ?
                <code>{JSON.stringify(item)}</code>
              -->
              {ITEMS[item.id].image}
            {/each}
          </h2>
        </div>
      </overlay>
      <BinaryImage src={peer.picture}/>
    </legend>
    <slot name="genderloc">
      <!--{#if distance !== null}
        Distance {distance}Km
      {/if}-->
    </slot>
    <slot></slot>
  </article>
