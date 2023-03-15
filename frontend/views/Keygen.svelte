<script>
// this is now start view, keygen is gone
import { navigate } from '../router'
import { keychain, keygen, decodePk, storeIdentity, purge, saveBackup } from '../api'
import { writable } from 'svelte/store'
import Geohash from 'latlon-geohash'
import Dialog from '../components/Dialog.svelte'
import Icon from '../components/Icon.svelte'
import QRCode from '../components/QRCode.svelte'

const progress = writable(100)
const idsqr = writable()
const secret = writable()
const geohash = writable(null) // Geohash.encode(52.20, 0.12, 6))
const gender = writable(0) // team?
const unlucky = writable(false)
const fails = writable(0)
const showImportDialog = writable(false)
const importInput = writable('')
const showAboutDialog = writable(false)

async function loadKeychain () {
  try {
    const sk = await keychain.readIdentity()
    if (!sk) return
    $secret = sk
    const res = decodePk(sk.slice(32))
    $gender = res.sex
    $geohash = res.geohash
  } catch (err) {
    console.error('loadKeychain() failed:', err)
    throw err
  }
}

async function roll (mode = 0) {
  if ($secret) return // Refuse to roll while secret exists
  console.info(`roll(${mode})`)
  $progress = 0
  $unlucky = false
  let pair = null
  for (let i = 0; i < 100; i++) {
    $progress++
    pair = keygen(
      mode < 2 ? $gender : null,
      mode < 1 ? $geohash : null,
      500
    )
    if (pair) break
    await new Promise(resolve => setTimeout(resolve, 100)) // give browser some breathing space
  }

  if (pair) {
    await storeIdentity(pair.sk)
    $secret = pair.sk
  } else {
    $unlucky = true
    $fails++
  }
  $progress = 100
}
/* Geolocation is being moved to profile */
function fetchPosition (options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Browser does not support geolocation APIs'))
    else navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}
async function autoGeohash () {
  const res = await fetchPosition()
  console.log(res)
  const { latitude: lat, longitude: lng } = res.coords
  $geohash = Geohash.encode(lat, lng, 6)

}
async function validateImport () {
  console.error('TODO: not yet implemented')
}

</script>
<keygen-view class="block container">
  <div class="flex column xcenter">
    <idsqr data-theme="dark" class="flex column space-around">
      {#await loadKeychain()}
        <h1 aria-busy="true">%nbsp;</h1>
      {:then}
        {#if !$secret}
          <!--<h5 class="text-center">Keygen</h5>-->
          <div>
            {#if $progress === 100}
              <p class="text-center">Press the button to generate your own unique passport</p>
            {:else}
              <progress min="0" max="100" value={$progress}/>
              <!-- <p>Finding a key might take a while, but you only have to do it once.</p>-->
            {/if}
          </div>
          <div>
            <div class="row space-between xcenter">
              {#if $fails > 1}
                <button on:click={() => roll(1)} disabled={$progress !== 100}>Give up</button>
              {/if}
              <!-- Defaults to gender only; Geohash mining disabled for now -->
              <button on:click={() => roll(1)} disabled={$progress !== 100 || $secret}>Create</button>
            </div>
            {#if $unlucky}
              <danger>Sorry.. RNG0D ignored your prayers, please try again</danger>
            {/if}
          </div>
        {:else}
          <QRCode data={$secret.slice(32)} size={10}/>
        {/if}
      {:catch error}
        <div>
          <h5>Error:</h5>
          <danger>{error.message}</danger>
        </div>
      {/await}
    </idsqr>
  </div>
  <button disabled={!$secret} on:click={() => navigate('/profile')}>next</button>
  <!--
  {#if $showImportDialog}
    <Dialog open={true} on:fade={() => $showImportDialog = false}>
      <article>
        <header><h5>Import Secret</h5></header>
        <p>Paste the secret as a hex-string</p>
        <textarea bind:value={$importInput}></textarea>
        <footer>
          <div class="row space-between">
            <a role="button" on:click={() => $showImportDialog = false}>Cancel</a>
            <a role="button" on:click={validateImport}>Import</a>
          </div>
        </footer>
      </article>
    </Dialog>
  {/if}
  -->
</keygen-view>
<style>
</style>

