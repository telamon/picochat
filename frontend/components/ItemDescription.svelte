<script>
import { ITEMS } from '../api'
export let id = -1
const item = ITEMS[id]
</script>
<item-description class="flex column xcenter start">
  {#if !item}
    <h3 class="nogap"><error>Item Not Found!</error></h3>
    <emo>😥</emo>
    <div><p>Unknown item [{id}]</p></div>
  {:else}
    <h3 class="nogap">{item.name}</h3>
    <i>{item.short}</i>
    <emo>{item.image}</emo>
    <h6>
      <small>{item.type}</small>
      {#if item.time} | ¤{item.time}{/if}
      {#if item.mod} | {item.mod}{/if}
    </h6>
    <div>
      <p>
        {#if !item.desc}
          <error>The description for this item seems to be missing</error>
        {:else}
          {@html item.desc.replace(/\n/g, '<br/>\n')}
        {/if}
      </p>
    </div>
  {/if}
</item-description>
<style>
  emo {
    --size: 5em;
    display: inline-block;
    font-size: var(--size);
    /* line-height: var(--size);
    height: var(--size);
    width: var(--size); */
  }
</style>
