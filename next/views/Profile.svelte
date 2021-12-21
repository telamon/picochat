<script>
  import { kernel } from '../api'
  import { navigate } from '../router'
  import { writable } from 'svelte/store'

  const name = writable()
  const tagline = writable()
  async function save () {
    const profile = {
      name: $name,
      tagline: $tagline,
      age: 99,
      sex: 0, // TODO: read from public-key
      picture: ':-)'
    }
    console.log('setting profile', profile)
    try {
      await kernel.register(profile)
      console.log('reg success')
      navigate('pub')
    } catch (err)  {
      console.error('reg fail', err)
    }
  }
</script>
<profile-view>
  <h1>Profile</h1>

  <label for="name">
    <h5>name</h5>
    <input type="text" bind:value={$name} placeholder="You got a street name?" id="name" name="name">
  </label>

  <label for="file">
    <h5>picture</h5>
    <input type="file" id="picture" name="picture">
  </label>

  <label for="tagline">
    <h5>spark</h5>
    <input type="text" bind:value={$tagline} placeholder="what's on your mind?" id="tagline" name="tagline">
  </label>
  <button on:click={save}>save</button>
</profile-view>
