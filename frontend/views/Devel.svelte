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
</script>
<devel-view>
  <h1>Developers view</h1>
  <p>(everything is broken)</p>
  <script src="https://cdn.jsdelivr.net/npm/@hpcc-js/wasm/dist/index.min.js"></script>
  <button on:click={a}>dump</button>
  <graph bind:this={graphElem}>g</graph>
</devel-view>
