const D = require('debug')('picochat:mod:net')
const { RPC } = require('../rpc')
const { writable } = require('../nuro')
// const { randomBytes } = require('crypto')
const randomBytes = n => Buffer.from(
  Array.from(new Array(n))
    // Not very random, used to generate a node-id
    .map(_ => Math.floor(Math.random() * 256))
)
module.exports = function NetworkModule (k) {
  const ctx = {
    // Workaround for WebRTC missing peer-dedupelicaiton.
    nodeId: randomBytes(8),
    store: k.store,
    spawnWire: null,
    rpc: null,
    name: null
  }
  // k._net = ctx // Expose current connection context for test/debugging
  const [connections, _setConnections] = writable([])
  const setConnections = c => {
    // console.info('Active Connections', c.length)
    _setConnections(c)
  }
  return {
    $connections () { return connections },
    async enter (name) {
      if (ctx.spawnWire) return ctx.spawnWire
      D('Net connecting to swarm %s as nodeId: %H', name, ctx.nodeId)
      ctx.name = name
      // TODO: Make disposable scoped store
      // this.pub.store = new Store(makeDatabase(name))
      // await this.pub.store.load()
      const store = ctx.store
      const repo = store.repo
      let opN = 0
      const rpc = new RPC(ctx.nodeId, {
        onblocks: async feed => {
          try {
            opN++
            D('%d %s received blocks %d %h', opN, this.store.state.peer.name, feed.length, feed.last.sig)
            D(feed.inspect(true))
            const mut = await store.dispatch(feed, false)
            D(opN, this.store.state.peer.name, 'Stores mutated', mut)
            return mut.length
          } catch (err) {
            console.warn('Remote block ignored', err)
          }
          return 0
        },
        // Lookups and read hit the permanent store first and then secondaries
        queryHead: async key => await repo.headOf(key),
        queryTail: async key => await repo.tailOf(key),
        onquery: async params => {
          const keys = Object.values(store.state.peers)
          // experimental
          // .filter(peer => peer.date > new Date().getTime() - 1000 * 60 * 60) // Only peers active last hour
            .sort((a, b) => a.date - b.date) // Newest first or something
            .map(peer => peer.pk)
          const feeds = []
          for (const key of keys) {
            const f = await repo.loadHead(key)
            // Tradeoff performance to reduce traffic
            if (f && !feeds.find(a => a.merge(f))) feeds.push(f)
          }
          const nBlocks = feeds.reduce((s, f) => f.length + s, 0)
          const nBytes = feeds.reduce((s, f) => f.tail + s, 0)
          D(
            '%s onquery: replying with %d-feeds containing %d-blocks, total: %dBytes',
            this.store.state.peer.name,
            feeds.length,
            nBlocks,
            nBytes
          )
          return feeds
        },
        onhandshake (node) {
          setConnections(Array.from(rpc.hub._nodes))
          D('PeerConnected', node.id)
          rpc.query(node, {})
            .catch(err => console.warn('Query Failed', err))
        },
        ondisconnect () {
          setConnections(Array.from(rpc.hub._nodes))
        }
      })
      ctx.rpc = rpc

      this._badCreateBlockHook = block => {
        D(this.store.state.peer.name, 'Created block, publishing')
        D(block.inspect(true))
        rpc.shareBlocks(block)
          .catch(err => console.log('shareBlocks failed:', err))
      }

      ctx.spawnWire = (details = {}) => {
        // if (blocklist.contains(details.prop)) return
        // if (details.client)
        const plug = rpc.createWire()
        D('Wire spawned', details)
        return plug
      }
      return ctx.spawnWire
    }
  }
}
