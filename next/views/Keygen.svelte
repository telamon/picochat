<script>
  import { navigate } from '../router'
  import { keygen } from '../../blockend'
  import { writable } from 'svelte/store'
  import Geohash from 'latlon-geohash'

  const progress = writable(0)
  const idsqr = writable()
  const geohash = writable(Geohash.encode(52.20, 0.12, 6))
  function roll () {
    $progress = 99
    $idsqr = keygen()
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
    <input type="radio" value="1" id="M" name="gender"/>
    <label for="M">M</label>
    <input type="radio" value="0" id="F" name="gender"/>
    <label for="F">F</label>
    <input type="radio" value="2" id="NB" name="gender"/>
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
        <!-- Some light reading while waiting for a key to manifest -->
        <p>Hyperspace is vast</p>
      </div>
      <div>
        <button on:click={roll}>Generate</button>
        <danger>{$idsqr?.pk.slice(0, 8).toString('hex')}</danger>
      </div>
    </idsqr>
  </div>
  <br/>
  <button disabled={!$idsqr} on:click={() => navigate('/profile')}>next</button>
</keygen-view>
<style>
</style>

