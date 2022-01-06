<script>
import { createEventDispatcher } from 'svelte'
// Silly workaround for svelte props clashing with custom attrs.
export let open = false
const dispatch = createEventDispatcher()
let elem
function updateAttribute(node, name, value) {
  if (value === null || value === false) {
    node.removeAttribute(name);
  }
  else node.setAttribute(name, value+"")
}
function attr(node, entry) {
  if(entry) {
     updateAttribute(node, entry[0], entry[1])
   }
  return {
    update(updated) {
      if(!updated) return
      updateAttribute(node, updated[0], updated[1])
    }
  }
}
function onClick (ev) {
  if (ev.target !== elem) return
  dispatch('fade')
}

</script>
<dialog  use:attr={["open", !!open]} on:click={onClick} bind:this={elem}>
  <slot>Empty Modal</slot>
</dialog>
