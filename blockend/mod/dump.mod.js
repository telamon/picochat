const { inspect: dumpDot } = require('picorepo/dot')
const { SimpleKernel } = require('picostack')
const {
  btok,
  TYPE_PROFILE,
  TYPE_VIBE,
  TYPE_VIBE_RESP,
  TYPE_MESSAGE,
  TYPE_BYE,
  TYPE_BYE_RESP,
  TYPE_ITEMS,
  TYPE_ACTIVATE,
  PASS_TURN,
  VIBE_REJECTED
} = require('../util')
const { ITEMS } = require('../items.db')
const { ACTION_OFFER, ACTION_NETWORK_PURCHASE } = require('../transactions')
const { scoreGraph } = require('../game')
module.exports = function InspectModule () {
  return {
    async inspect () {
      const peers = this.store.state.peers
      const chats = this.store.state.chats
      const dot = await dumpDot(this.repo, {
        blockLabel (block, { link }) {
          const data = SimpleKernel.decodeBlock(block.body)
          let author = peers[btok(block.key)]?.name
          if (!author) author = btok(block.key, 3)
          let str = bq`
            [${btok(block.sig, 3)}]
            ${data.seq}:${author}
          `
          switch (data.type) {
            case TYPE_PROFILE: return bq`
              ${str}
              ${data.sex ? '👨' : '👩' }
            `
            case TYPE_VIBE: {
              const { t: transactions } = data
              const give = transactions.filter(ts => ts.t === ACTION_OFFER)
                .map(({ p }) => p.q + ITEMS[p.i].image)
              const buy = transactions.filter(ts => ts.t === ACTION_NETWORK_PURCHASE)
                .map(({ p }) => p.q + ITEMS[p.i].image)
              str += '\n👋'
              if (give.length) str += '\n💁' + give.join(' ')
              if (buy.length) str += '\n🤌' + buy.join(' ')
              return str
            }
            case TYPE_VIBE_RESP: {
              link(data.link)
              const resp = VIBE_REJECTED.equals(data.box) ? '🙅' : '🙋'
              return bq`
                ${str}
                ${resp}
              `
            }
            case TYPE_MESSAGE: {
              const t = PASS_TURN.equals(data.content) ? '😶' : '💬'
              return bq`
                ${str}
                ${t}
              `
            }
            case TYPE_BYE: {
              str += '\n' + ['✌️', '👊', '❤️'][data.gesture]
              return str
            }
            case TYPE_BYE_RESP: {
              str += '\n' + ['✌️', '👊', '❤️'][data.gesture]
              const cid = chats.heads[btok(block.sig)]
              if (cid) {
                const chat = chats.chats[btok(cid)]
                return bq`
                  ${str}
                  ${scoreGraph(chat.graph).join('/')}
                `
              }
              return str
            }
            case TYPE_ACTIVATE: {
              return bq`
                ${str}
                use ${ITEMS[data.i].image}
              `
            }
            default:
              console.info('Unknown type', data.type, data)
              return bq`
                ${str}
                ${data.type}
              `
          }
        }
      })
      return dot
    }
  }
}

// nice this is a useful hack for multiline strings
function bq (str, ...tokens) {
  str = [...str]
  for (let i = tokens.length; i > 0; i--) str.splice(i, 0, tokens.pop())
  return str.join('').split('\n').map(t => t.trim()).join('\n').trim()
}
