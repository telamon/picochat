<script>
import BinaryImage from './BinaryImage.svelte'
export let peer
export let size = 'normal'
</script>
  <article class="peer">
    <legend>
      <overlay>
        <h3 style="grid-area: nw;"><dot class="vibing">&nbsp;</dot>{peer.score}</h3>
        <div style="grid-area: sw; align-self: end;">
          <h2>{peer.name}</h2>
        </div>
        <div style="grid-area: se; align-self: end; justify-self: end;" class="end">
          <h2>[b]</h2>
        </div>
      </overlay>
      <BinaryImage src={peer.picture}/>
    </legend>
    <slot></slot>
  </article>
<style>
</style>
