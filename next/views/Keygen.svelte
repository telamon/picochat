<script>
  import { navigate } from '../router'
  import { keychain, keygen, decodePk, storeIdentity } from '../api'
  import { writable } from 'svelte/store'
  import Geohash from 'latlon-geohash'

  const progress = writable(100)
  const idsqr = writable()
  const secret = writable()
  const geohash = writable(Geohash.encode(52.20, 0.12, 6))
  const gender = writable(0)
  const unlucky = writable(false)
  async function loadKeychain () {
    const sk = await keychain.readIdentity()
    if (!sk) return
    $secret = sk
    const res = decodePk(sk.slice(32))
    $gender = res.sex
    $geohash = res.geohash
  }

  loadKeychain().catch(console.error)
  async function roll () {
    $progress = 0
    $unlucky = false
    let pair = null
    for (let i = 0; i < 100; i++) {
      $progress++
      pair = keygen($gender, $geohash, 500)
      if (pair) break
      await new Promise(resolve => setTimeout(resolve, 100)) // give browser some breathing space
    }

    if (pair) {
      await storeIdentity(pair.sk)
      $secret = pair.sk
    } else $unlucky = true
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
    $geohash = geohash()
  }
</script>
<keygen-view>
  <h1>ID² Keygen</h1>
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
  <h5>Location</h5>
  <div class="flex row">
    <div><a role="button" on:click={autoGeohash}>L</a></div>
    <div><input type="text" placeholder="geohash" bind:value={$geohash}></div>
  </div>
  <h5>IDSQR</h5>
  <div class="flex row center">
    <idsqr data-theme="dark" class="flex column space-between">
      <h5 class="text-center">inverse pyramid</h5>
      <div>
        <progress min="0" max="100" value={$progress}/>
        <!-- Some light *cough*bullshit*cough*reading while waiting for a key to manifest -->
        <p>Hyperspace is vast</p>
      </div>
      <div>
        <button on:click={roll} disabled={$progress !== 100}>Generate</button>
        <!-- <button on:click={() => {$gender = null; roll()}} disabled={$progress !== 100}>Give up</button> -->
        <danger>{$secret?.slice(32, 8).toString('hex')}</danger>
      </div>
    </idsqr>
  </div>
  <br/>
  <button disabled={!$secret} on:click={() => navigate('/profile')}>next</button>
</keygen-view>
<style>
</style>

