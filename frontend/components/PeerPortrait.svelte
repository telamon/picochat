<script>
import { getDistance } from 'geolib'
import BinaryImage from './BinaryImage.svelte'
import { kernel, decodePk, ITEMS } from '../api'
export let peer
export let size = 'normal'
let distance = null
if (kernel.pk) {
  const a = decodePk(kernel.pk)
  const b = decodePk(peer.pk)
  distance = getDistance(a, b, 1000)
}
</script>
  <article class="peer">
    <legend>
      <overlay>
        <h3 style="grid-area: nw;"><dot class="vibing">&nbsp;</dot>{peer.score}</h3>
        <div style="grid-area: sw; align-self: end;">
          <h2>{peer.name}</h2>
        </div>
        <div style="grid-area: se; align-self: end; justify-self: end;" class="end">
          <h2>
            {#each peer.inventory as item}
              <!-- TODO: lookup inventory.yaml for:
                attr:title = item.short
                img = item.gfx
                on:click => $showItemPopup(item.id) ?
              -->
              <code>{JSON.stringify(item)}</code>
            {/each}
          </h2>
        </div>
      </overlay>
      <BinaryImage src={peer.picture}/>
    </legend>
    <slot name="genderloc">
      {#if distance !== null}
        Distance {distance}Km
      {/if}
    </slot>
    <slot></slot>
  </article>
<style>
</style>
