<script>
  import { state, connectSwarm, kernel, Peers, boot } from '../api'
  const peers = Peers()

  // Auto-connect to swarm-topic
  if (!$state.swarming) boot
    .then(connectSwarm)
    .catch(console.error.bind(null, 'Auto-connect failed'))
</script>
<pub-view>
  <h1>PubName</h1>
  <p>
    Pub description occupying a couple of lines
  </p>
  <h6>Peers {$peers.length}</h6>
</pub-view>
