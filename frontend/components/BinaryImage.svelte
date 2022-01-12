<script>
import { decodeImage } from '../api'
export let src = null
export let size = null
/*
  import { onMount } from 'svelte'
  const url = ''
  onMount(() => {
    return () => URL.revokeObjectURL(url)
  })
*/
const style = !(size ?? false) ? '' : `width: ${size}; height: ${size}`
</script>
<img
  class="bimg"
  style={style}
  src={decodeImage(src)}>
