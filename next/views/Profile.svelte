<script>
import ImageLoader from '../components/ImageLoader.svelte'
import { kernel, keychain, updateProfile } from '../api'
import { navigate } from '../router'
import { writable } from 'svelte/store'
const name = writable()
const tagline = writable()
const picture = writable()

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
  return p
}
let _loading = load()
</script>
<profile-view>
  <h1>Profile</h1>
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
</profile-view>
