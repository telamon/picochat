<script>
import dayjs from 'dayjs'
import { onMount, afterUpdate } from 'svelte'
import { writable } from 'svelte/store'
export let expiresAt
export let format = 'HH:mm'
let intervalId = null
const timeLeft = writable(expiresAt - Date.now())
/*
let classes = 'count-down'
if (timeLeft < 10 * 1000) classes += ' danger'
else if (timeLeft < 60 * 1000) classes += ' warning'
else if (timeLeft <= 0) classes += ' expired'
*/
onMount(() => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  intervalId = setInterval(() => {
    $timeLeft = expiresAt - Date.now()
    if ($timeLeft <= 0) clearInterval(intervalId)
  }, 200)

  return () => {
    clearInterval(intervalId)
  }
})
function ddFormat(millis) {
  const dd = millis / 1000 / 60
  switch (format) {
    case '¤': return Math.floor(dd)
    case '¤¤': return `${Math.floor(dd)}<small>${(dd- Math.floor(dd)).toFixed(1).substr(1)}</small>`
    case '¤¤¤': return `${Math.floor(dd)}<small>${(dd- Math.floor(dd)).toFixed(2).substr(1)}</small>`
  }
}
</script>
<timer>
{#if /^¤+$/.test(format)}
  {@html ddFormat($timeLeft > 0 ? $timeLeft : 0)}
{:else}
  {dayjs.duration($timeLeft > 0 ? $timeLeft : 0).format(format)}
{/if}
</timer>
