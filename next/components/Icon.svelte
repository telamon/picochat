<script>
export let id = ''
export let tag = ''
export let nofill = false
const SPRITE_URL = 'build/sprites.svg'
const ref = `${SPRITE_URL}#${id}`
const classes = `icon ${tag}`.trim()
</script>
<svg class={classes} class:nofill={nofill}>
  <use xlink:href={ref} href={ref}></use>
</svg>
<style>
.icon { fill: unset; }
.nofill { fill: none; }
</style>
