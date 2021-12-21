<script>
  import { kernel, Peers } from '../api'
  const peers = Peers()
</script>
<pub-view>
  <h1>PubName</h1>
  <p>
    Pub description occupying a couple of lines
  </p>
  <h6>Peers {$peers.length}</h6>
</pub-view>
