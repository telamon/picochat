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
</script>
<timer>
{dayjs.duration($timeLeft > 0 ? $timeLeft : 0).format(format)}
</timer>
