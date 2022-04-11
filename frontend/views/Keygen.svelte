<script>
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
const gender = writable(0)
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
<keygen-view>
  <h1 on:click={() => $showAboutDialog = true}>
    Setup
    <Icon id="icon-info" />
  </h1>
  <h5>Gender</h5>
  <fieldset>
    <input type="radio" value={1} bind:group={$gender} id="M" name="gender"/>
    <label for="M">M</label>
    <input type="radio" value={0} bind:group={$gender} id="F" name="gender"/>
    <label for="F">F</label>
    <input type="radio" value={2} bind:group={$gender} id="NB" name="gender"/>
    <label for="NB">NB</label>
  </fieldset>
  <br/>
  <!--
  <h5>Location</h5>
  <div class="flex row">
    <div>
      <a role="button" on:click={autoGeohash}><Icon id="icon-location" /></a>
    </div>
    <div>
      <input type="text"
        placeholder="Geohash"
        readonly
        on:click={autoGeohash}
        bind:value={$geohash} >
    </div>
  </div>
  -->
  <h5>IDSQR</h5>

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
  <div class="row end hpad">
    <small>
      {#if $secret}
        <a on:click={() => purge(true)}>Destroy</a> |
        <a on:click={saveBackup}>Backup</a>
      {:else}
        <a on:click={() => roll(2)}>Anonkey</a> |
        <a on:click={() => $showImportDialog = true}>Import</a>
      {/if}
    </small>
  </div>
  <br/>
  <button disabled={!$secret} on:click={() => navigate('/profile')}>next</button>

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

  {#if $showAboutDialog}
    <Dialog open={true} on:fade={() => $showAboutDialog = false}>
      <article>
        <h3>Welcome to True Decentralization</h3>
        <div class="about">
          <p>
            Picochat is a <strong>coinless blockchain</strong>, there
            are no super-nodes and everything is slightly different from
            what you're used to.<br/>
            But don't worry, it's all good.
          </p>
          <p>
            First of all, you have to generate your own key.<br/>
            It takes about a minute or two on a handheld device.<br/>
            Once you've found a one, keep it safe, it's your passport to hyperspace.
            ✨
          </p>
          <p>
            If you don't care about location nor gender, then
            feel free to use an <i>anonymous</i> key.<br/>
            Trees say "Thanks!" 🌱
          </p>
          <p>
            Please don't generate more keys than you need, mining of any form is a pointless waste of world-resources.
            Hate to say it; but don't ever trade a key, it is <strong>insecure and dangerous</strong>.
          </p>
          <p><i>
            The hyperspace is vast.<br/>
            It's real-estate, just like air -
            worth nothing while there's enough for everyone.<br/>
            Let's keep it that way
          </i> 🙂</p>
        </div>
        <footer>
          <button on:click={() => $showAboutDialog = false}>gotcha</button>
        </footer>
      </article>
    </Dialog>
  {/if}
</keygen-view>
<style>
danger { color: var(--blood); }
.about {
  max-height: 50vh;
  overflow-y: scroll;
}
</style>

