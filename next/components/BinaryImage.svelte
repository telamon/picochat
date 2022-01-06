<script>
import { decodeImage } from '../api'
export let src = null
/*
  import { onMount } from 'svelte'
  const url = ''
  onMount(() => {
    return () => URL.revokeObjectURL(url)
  })
*/
</script>
<bimg>
  <img src={decodeImage(src)}>
</bimg>
