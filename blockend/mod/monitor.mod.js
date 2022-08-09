const { mute, combine } = require('piconuro')
const { ACTIVE } = require('../slices/peers.reg')

module.exports = function MonitorModule () {
  return {
    $cooldowns () {
      return mute(
        combine(
          this.$profile(),
          s => this.store.on('vibes', s),
          s => this.store.on('chats', s)
        ),
        ([profile, vibes, chats]) => {
          const cd = {
            canVibe: profile.state === ACTIVE,
            vibe: -1
          }
          if (profile.state === 'loading') return { state: 'loading', ...cd }

          // Peer has a sent vibe
          const sent = vibes.seen[profile.pk.toString('hex')]
          if (!sent) {
            cd.vibe = 0
            return cd
          }

          // Peer is initiating a conversation
          const match = vibes.matches[sent.toString('hex')]
          if (!match) throw new Error('MentalError')
          cd.vibe = match.expiresAt

          // Peer is having an conversation
          const chat = chats.chats[sent.toString('hex')]
          if (chat) {
            cd.vibe = chat.expiresAt
          }
          return cd
        }
      )
    }
  }
}
