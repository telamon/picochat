<script>
export let id = ''
export let tag = ''
const SPRITE_URL = 'build/sprites.svg'
const ref = `${SPRITE_URL}#${id}`
const classes = `icon ${tag}`.trim()
</script>
<svg class={classes}>
  <use xlink:href={ref} href={ref}></use>
</svg>
