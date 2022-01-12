<script>
import QR from 'qrcode-generator'
import { onMount } from 'svelte'
export let data = null
export let size = 2
export let margin = 0
export let level = 'L'
// export let colorDark = '#000' // '#253900'
// export let colorLight = '#808000'
let imgElem
function paint (bin) {
  if (!bin) return
  if (Buffer.isBuffer(bin)) bin = bin.toString('base64')
  // TODO: hack to modify colors,
  // maybe use qr.drawToContext() + canvas instead of img.
  const qr = new QR(0, level)
  qr.addData(bin)
  qr.make()
  const url = qr.createDataURL(size, margin)
  imgElem.src = url
}
onMount(() => {
  if (typeof data?.subscribe === 'function') return data.subscribe(paint)
  else data && paint(data)
})
</script>
<pico-qr>
  <img bind:this="{imgElem}"/>
</pico-qr>
<style>
  pico-qr { display: block; }
</style>
