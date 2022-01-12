<script>
import { kernel, keychain, updateProfile, decodePk, purge, saveBackup } from '../api'
import { navigate } from '../router'
import { writable } from 'svelte/store'
import ImageLoader from '../components/ImageLoader.svelte'
import Icon from '../components/Icon.svelte'
import Dialog from '../components/Dialog.svelte'
import QRCode from '../components/QRCode.svelte'

const name = writable()
const tagline = writable()
const picture = writable()
const pk = writable()
const sk = writable()
const showKeyDialog = writable(false)

async function save () {
  await updateProfile({
    name: $name,
    tagline: $tagline,
    age: 99,
    sex: 0,
    picture: $picture
  })
}

async function load () {
  const p = await keychain.readProfile()
  if (!p) return
  $name = p.name
  $tagline = p.tagline
  $picture = p.picture
  $sk = await keychain.readIdentity()
  $pk = $sk.slice(32)
  return p
}

let _loading = load()
</script>
<profile-view>
  <div class="row space-between xstart">
    <h1>Profile</h1>
    <div class="row">
      <h2 on:click={() => $showKeyDialog = true}>
        <Icon id="icon-qr" />
      </h2>
      <h2 on:click={() => navigate('/about')}>
        <Icon id="icon-info" />
      </h2>
    </div>
  </div>
  <label for="name">
    <h5>name</h5>
    <input type="text" bind:value={$name} placeholder="You got a street name?" id="name" name="name">
  </label>

  <label for="file">
    <h5>picture</h5>
    <ImageLoader output={picture} />
    <small class="block text-center">{$picture?.length} B</small>
    <!--<img src={$pictureURI} alt="profile picture preview"/>-->
  </label>

  <label for="tagline">
    <h5>spark</h5>
    <input type="text" bind:value={$tagline} placeholder="what's on your mind?" id="tagline" name="tagline">
  </label>
  {#await _loading}
    Loading...
  {:then}
  <button on:click={() => _loading = save()}>save</button>
  {:catch error}
    <danger>Loading profile failed {error.message}</danger>
    <pre>{error.stack}</pre>
  {/await}

  {#if $showKeyDialog}
    <Dialog open={true} on:fade={() => $showKeyDialog = false}>
      <article>
        <header><h5>IDSQR</h5></header>
        <div class="column xcenter">
          {#if $pk}
            <ul>
              <li>Gender: {['F', 'M', 'NB'][decodePk($pk).sex]}</li>
              <li>Location: {decodePk($pk).geohash}</li>
            </ul>
          {/if}
          <div class="vpad">
            <QRCode data={pk} size={6}/>
          </div>
          <p>
            This is your cryptographic identity.
            <br/>
            Let your friends scan your code
            but keep the backed up image safe.
          </p>
        </div>
        <footer>
          <div class="row space-between">
            <a role="button" on:click={() => purge(true)}>purge</a>
            <a role="button" on:click={saveBackup}>backup</a>
            <a role="button" on:click={() => $showKeyDialog = false}>close</a>
          </div>
        </footer>
      </article>
    </Dialog>
  {/if}
</profile-view>
