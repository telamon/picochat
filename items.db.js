const assert = require('nanoassert')
const GROUPS = {}
const ITEMS = []

/* The Items Database
* ID ranges:
*
* 0xD000 - 0xD0FF # non-purchasable special stuff.
* 0xD100 - 0xD1FF # bartender purchasable with €
* 0xD200 - 0xD2ff # gear purchasable with ¤
*
*
* "type" prop:
* - collectible: just a gimmick
* - passive: effects while in inventory
* - active: self toggle, has cooldown
* - consumable: self use, can be attached to transfer effects to other peer on timeunlock
* - attachment: consumed on timelock.
*    - affects chat (minigames)
*    - applies effect on timeunlock (give beer)
*/

// ----------- Drinks
item(0xD101)`
name: Lager
time: 20
short: Cold, quenching
price: 200
image: 🍺
type: consumable
group: drinks
desc: |-
  Freshly brewed from the finest grains.
  There's always more.
`

item(0xD102)`
  name: Kosmo
  time: 18
  short: Sweet, intoxicating
  price: 300
  mod: Random perk
  image: 🍹
  type: consumable
group: drinks
  desc: |-
    Applies one random effect for the duration of the drink.

    - One part moonlight
    - Two parts autumn honey
    - An orange stolen from a dream
    - A leaf caught midair
    You can barely taste the vodka
`

item(0xD103)`
name: White
time: 22
short: Dry refreshing
price: 320
image: 🍷
group: drinks
type: consumable
desc:
  slightly matured
`

item(0xD104)`
name: Stout
time: 30
price: 500
mod: silence
short: Liquid darkness
image: 🍫
type: consumable
group: drinks
desc: |-
  Vibe disabled

  The bitterness is intense with aftertones of
  dark chocolate.
  Not a lager
`

item(0xD105)`
name: Sparkly Wine
time: 15
mod: 1.5X Rewards
price: 600
short: Proof of Prestige
image: 🍾
type: consumable
group: drinks
desc:
  Bob liked to show off, it was deeply embedded in his psyche.
`

// ----------- Misc
item(0xD100)`
name: Tip
image: 🙏
price: 100 # FE-Workaround, is user-customizable
short: Boost feature development
type: passive
group: misc
desc: |-
  DecentLabs - Compressing the internet to fit in the palm of your hand.

  Thank you for playing.
`

item(0xD001)`
time: 60
name: Verified Badge
short: Not a robot
type: passive
group: misc
soulbind: pickup
image: 🏅
desc: |-
  "Don't collect what you can't protect"

  We only store your email for a short while to keep track of your purchases.
`
item(0xD002)`
time: 80
name: V.I.P. Ticket
short: Welcome to the Void
type: passive
group: misc
soulbind: pickup
image: 🎫
desc: |-
  Entrance-fee and complimentary drink included.
`
item(0xD700)`
name: Water
time: 10
price: 0
short: The developers best friend
image: 🚰
group: misc
type: attachment
desc: |-
  Lorem ipsum dolor sit amet went on a long journey
  but lorem forgot to bring a snack. So amet said
  "Don't worry bruh, I got you, I brought enough chocolate to bring down the entire mountain!"
  And so the adventure continued.
`

item(0xD701)`
name: Glass of Water
time: 60
price: 0
short: Stay hydrated
image: 🥛
group: misc
type: consumable
desc: |-
  Disregarding the looks, it's a regular glass of
  water.
`
// ----------- GEAR
item(0xD200)`
name: B.A.B.
slot: head
price: 1200
mod: 1.1X rewards
soulbind: pickup
short: Never leave home without it
image: ☮️
type: active
group: gear
desc: |-
  Consecutive wins increases rewards +0.3X stacks upto 3X.
  But lose and you'll lose your stacks and
  get no reward for that game.

  Life's a gamble trust Cosmos
`

item(0xD201)`
name: Fades
slot: eyes
price: 3800
soulbind: use
mod: Silenced, Timestrech 3X
short: Lean back and enjoy your stay
image: 🕶️
type: active
group: gear
desc: |-
  Vibe disabled and time flows 3X slower while active.
  Relax, listen to the music, you're not in a hurry.
`

item(0xD203)`
name: Tic Tac Nano
price: 500
short: No talk, Play!
mod: minigame
image: ♟️
type: attachment
group: gear
desc: |-
  Attach to vibe to challenge someone to a round of tic-tac-toe.
`

item(0xD204)`
name: Question Card
price: 700
short: Draw card, compare answers
mod: minigame
image: 🃏
type: attachment
group: gear
desc: |-
  Attach to vibe to answer a random question,
  answers revealed when both players have answered.
`

item(0xD205)`
name: Twin Bed
image: 💤
price: 5000
short: Just sleep, nothing else
type: attachment
mod: sleep 6H
group: gear
desc: |-
  Had enough for one day?
  Attach to vibe to put both players to sleep
  and save your profile for tomorrow.
`

item(0xD202)`
name: Boom Deck 202
slot: hands
price: 240000
mod: DJ mode | TIMEFLOW 3X
short: Play the song of your people
image: 📻
type: active
group: gear
desc: |-
  Take the DJ seat and broadcast your tunes.
  But beware! Time flows 3X faster while active 😱
  Make sure to collect tips.
`

// TODO: port earlier prototypes to pico
item()`
name: Super POH Turbo II
short: Insert Coin
price: 1200
image: 🎮
type: collectible
group: gear
desc: |-
  Play a nervewrecking arcade featuring unique characters and combos.
`

item()`
name: Xorcery Offline
short: Crypts of Cryptography
image: ⚔️
price: 6000
type: collectible
group: gear
desc: |-
  Rougelike dungeon crawler, form your party and
  explore the Crypts of Cryptography finding treasures
  and monsters.
`

// --------- loader code
function item (id) {
  if (!id) return () => {}
  const istr = 'Item#' + id.toString(16).toUpperCase()
  assert(typeof ITEMS[id] === 'undefined', `Duplicate ${istr}`)
  return (ml, ...args) => {
    const lines = ml.join('').split('\n')
    const i = { id }
    while (lines.length) {
      const line = lines.shift().trim()
      if (!line.length) continue
      const [key, value] = line.split(':').map(s => s.trim())
      if (key === 'desc') break
      switch (key) {
        case 'time':
        case 'price':
          i[key] = parseInt(value)
          break
        default:
          i[key] = value
      }
    }
    if (lines.length) i.desc = lines.map(i => i.trim()).join('\n')
    // validate
    // Required fields
    assert(i.name?.length, `${istr}: 'name' required`)
    assert(i.short?.length, `${istr}: 'short' required`)
    assert(i.image?.length, `${istr}: 'image' required`)
    assert(i.desc?.length, `${istr}: 'desc' required`)

    const validTypes = ['consumable', 'active', 'passive', 'attachment']
    assert(i.type?.length, `${istr}: 'type' required`)
    assert(~validTypes.indexOf(i.type), `${istr}: Invalid 'type'`)

    const validGroups = ['drinks', 'gear', 'misc']
    assert(i.type?.length, `${istr}: 'group' required`)
    assert(~validGroups.indexOf(i.group), `${istr}: Invalid 'group'`)

    if (i.time) assert(Number.isFinite(i.time), `${istr}: 'time' Invalid`)
    if (i.price) assert(Number.isFinite(i.price), `${istr}: 'price' Invalid`)

    // Index
    ITEMS[id] = i
    GROUPS[i.group] = GROUPS[i.group] || []
    GROUPS[i.group].push(i)
  }
}
module.exports = { ITEMS, GROUPS }
