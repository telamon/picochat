<script>
// TODO: rewrite this component using canvas or interactive svg?
import { readable } from 'svelte/store'
import BinaryImage from '../components/BinaryImage.svelte'
export let vibe
const VIBE_TTL = vibe.expiresAt - vibe.createdAt // 5mins

const progress = readable(1, set => {
  const id = setInterval(() => {
    const left = vibe.expiresAt - Date.now()
    if (left <= 0) {
      set(0)
      clearInterval(id)
    } else set(left / VIBE_TTL)
  }, 1000)
  return () => clearInterval(id)
})

</script>
<vibe>
  <mask><tint style={`width: ${$progress * 100}px;`}>&nbsp;</tint></mask>
  <portrait><BinaryImage src={vibe.peer.picture}/></portrait>
</vibe>
<style>
vibe mask {
  z-index: 3;
  display: block;
  position: absolute;
  border-radius: 100%;
  height: 100px;
  overflow: hidden;
}
vibe tint {
  display: block;
  background-color: var(--wizardry);
  opacity: 0.5;
  height: 100px;
}
vibe {
  --size: 100px;
  display: inline-block;
  width: var(--size);
  height: var(--size);
  border: 4px solid var(--background-color);
  border-radius: 100%;
  overflow: hidden;
  box-shadow: var(--card-box-shadow);
}
vibe portrait {
  z-index: 2;
  display: block;
  position: relative;
}
</style>
