<script>
import { kernel } from '../api'
let graphElem

async function a () {
  const { graphviz } = window["@hpcc-js/wasm"]
  const dot = await kernel.inspect()
  const svg = await graphviz.layout(dot, 'svg', 'dot')
  graphElem.innerHTML = svg
  /*
  const feed = await kernel.feed()
  feed.inspect()
  console.log(`Size: ${(feed.tail / 1024).toFixed(2)} kB`, )
  */
}

async function reload () {
  await kernel.reload()
}
</script>
<devel-view>
  <h1>Developers view</h1>
  <p>(everything is broken)</p>
  <script src="https://cdn.jsdelivr.net/npm/@hpcc-js/wasm/dist/index.min.js"></script>
  <div class="flex row space-between">
    <button class="hpad" on:click={a}>dump</button>
    <button class="hpad" on:click={reload}>reload</button>
  </div>
  <graph bind:this={graphElem}>g</graph>
</devel-view>
