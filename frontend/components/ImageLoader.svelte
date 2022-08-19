<script>
import { onMount } from 'svelte'
import Cropper from 'svelte-easy-crop' // The guy who wrote this built a hammer without a shaft.
// Other candidates
// https://www.npmjs.com/package/svelte-imgcrop
import { writable } from 'svelte/store'
import { encodeImage, decodeImage } from '../api'
export let output
let canvasElement, ctx, imgElement
const cropURL = writable()
let files
let crop = { x: 0, y: 0 }
let zoom = 1
$: if (files) {
  const file = files[0]
  preprocessFile(file).catch(console.error.bind(null, 'Preprocess failed'))
}

async function setImage (url) {
  return new Promise(resolve => {
    imgElement.onload = () => {
      if (imgElement.src === '') return
      console.info(imgElement.width, imgElement.height)
      const s =  Math.min(imgElement.height, imgElement.width)
      ctx.drawImage(imgElement,
        (imgElement.width - s) / 2, (imgElement.height - s) / 2, s, s, // Src
        0, 0, 300, 300 // Dst
      )
      imgElement.src = ''
      resolve()
    }
    imgElement.src = url
  })
}

async function preprocessFile(file) {
  let url
  try {
    url = URL.createObjectURL(file)
    await setImage(url)
    URL.revokeObjectURL(url)

    const dataUrl = canvasElement.toDataURL('image/jpeg', 0.35)
    const buf = encodeImage(dataUrl)
    console.info(`DataURL: ${dataUrl.length}, Binary: ${buf.length}, compression: ${buf.length / dataUrl.length}`)
    $output = buf
    /*
		let reader = new FileReader()
		reader.onload = e => {
			image = e.target.result
		}
		reader.readAsDataURL(imageFile)
    */
  } catch (e) {
    // URL.revokeObjectURL(url)
    throw e
  }
}

function onCrop (ev) {
  const { percent, pixels } = ev.detail
  console.info('CropComplete', percent, pixels)
  console.info('Crop', crop, 'Zoom', zoom)
  // transform: translate(11.64px, 21.84px) scale(1.84);
  // $doCrop = false
  $output = false
}

onMount(() => {
  ctx = canvasElement.getContext('2d')
  ctx.fillStyle = 'gray'
  ctx.fillRect(0, 0, 300, 300)
  const unsub = output?.subscribe(blob => {
    console.info('Redrawing preview due to change', blob?.length)
    if (blob) {
      // gonna have to tweak $profile and $peer neurons to provide object-urls
      // also have to not load peer.picture blob into register memory.
      // also have to use an interrupt to catch each incoming image and store
      // to some separate store that allows createObjectURL api/reference
      const url = decodeImage($output)
      setImage(url)
    }
  })

  return () => { // Destroy
    unsub && unsub()
  }
})
</script>
<image-loader>
  <input type="file" bind:files accept="image/*" id="picture" name="picture">
  {#if false}
    <button>done</button>
    <Cropper
      image={$cropURL}
      aspect={1}
      bind:crop bind:zoom
      on:cropcomplete={onCrop}
      showGrid={false}
      />
  {:else}
    <div class="row center">
      <canvas bind:this={canvasElement} width="300" height="300"/>
    </div>
    <img bind:this={imgElement} alt="preview" id="preview" style="display:none"/>
  {/if}
</image-loader>
<style>
  #preview {
    width: 300px;
    height: 300px;
  }
</style>
