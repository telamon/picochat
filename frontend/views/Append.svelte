<script>
/**
 * This view imports foreign blocks via URL
 * When done maybe displays block info or merge error.
 * Like a barcode-qr scan receiver.
 */
export let id
import { Feed } from 'picostack'
import { mute, init } from 'piconuro'
import { nId, navigate } from '../router'
import { svlt, kernel } from '../api'

const block = svlt(
  init({ loading: true },
    mute(nId, async pickle => {
      if (!pickle) return { loading: true }
      const foreign = Feed.from(pickle)

      const hasBlock = !!(await kernel.repo.readBlock(foreign.last.sig))

      let error = null
      let imported = false
      if (hasBlock) {
        error = 'Already merged'
      } else {
        try {
          const mutated = await kernel.dispatch(foreign, true)
          if (!mutated.length) throw new Error('Rejected by kernel')
          else imported = true
        } catch (err) {
          console.error(err)
          error = err.message
        }
      }

      return  {
        loading: false,
        imported,
        error,
        blocks: foreign
      }
    })
  )
)

</script>
<append class="block container">
  <div class="flex column xcenter center">
    <h1>&nbsp;</h1>
    {#if $block.loading}
      <h3>Reading blocks...</h3>
      <h1 aria-busy="true"></h1>
    {:else if !$block.imported}
      <h3>Not imported</h3>
      <danger>{$block.error}</danger>
    {:else}
      <h3>Done!</h3>
      <a href={`#/explore/${$block.last.sig}`}>Explore blocks</a>
      <button on:click={() => navigate('/')}>done</button>
    {/if}
  </div>
</append>
