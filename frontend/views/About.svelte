<script>
import Icon from '../components/Icon.svelte'
</script>
<about>
  <div class="column xcenter vgap">
    <logo>
      <Icon id="dl-logo-red" />
    </logo>
  </div>
  <h1>Picochat <samp>2.x</samp></h1>
  <p>
    Where ever we're going, we'll get there eventually.
    Meanwhile, come say hi!
  <ul>
    <li><a href="https://discord.gg/K5XjmZx">Discord (community chat)</a></li>
    <li><a href="https://github.com/telamon/picochat/issues">Questions &amp; Support</a></li>
    <li><a href="https://github.com/telamon/picochat">Source code</a></li>
  </ul>

  <h5>Legalities</h5>
  <table>
    <tdata>
      <tr><td>Cookies</td><td>none, zilch, zero</td></tr>
      <tr><td>GDPR</td><td>All blocks are automatically erased when timers hit <code>00:00</code></td></tr>
      <tr><td>User</td><td>We have absolutley no control over p2p interactions, apply common sense, be polite</td></tr>
      <tr><td>License</td><td>GNU AGPL version 3</td></tr>
      <tr><td>Motto</td><td>No servers, no supernodes, liberate humans and machines alike</td></tr>
    </tdata>
  </table>
  <p>
    <sub>Bottom line</sub><br/>
    <samp>
      This software is presented to you as is,
      Decent Labs AB takes no responsibility for how this software is used or distributed.
      <br/>
      Refer to the contents of the aforementioned license for more details.
    </samp>
  </p>
</about>
<style>
  ul a { color: var(--pool); }
  ul li { list-style: circle; }
</style>
