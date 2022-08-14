<script>
export let q = {}
import { derived, writable } from 'svelte/store'
import { Profile, INVENTORY, ITEMS } from '../api'
import { requestVerificationStamp, createCheckout, redeem } from '../capi'
import { navigate } from '../router'
import Dialog from '../components/Dialog.svelte'

const profile = Profile()
const hasBadge = derived(profile, p => p?.hasBadge)
const badge = ITEMS[0xD001]

// Email verification
const showVerifyDialog = writable(false)
const email = writable('')
const badgeStatus = writable(false)
function requestStamp () {
  $badgeStatus = true
  $_waitRequestStamp = requestVerificationStamp($email)
    .catch(err => {
      $badgeStatus = false
      throw err
    })
}
let _waitRequestStamp = writable(Promise.resolve(''))

// Cart
const cart = writable([])
const cartSum = derived(cart, c =>
  c.reduce((sum, i) => (sum + ITEMS[i.id].price * i.qty), 0)
)
const cartQty = derived(cart, c => c.reduce((q, i) => q + i.qty, 0))

function addCart(id) {
  const q = $cart.find(i => i.id === id)?.qty || 0
  setQty(id, q + 1)
}
function delCart(id) {
  const q = $cart.find(i => i.id === id)?.qty || 0
  setQty(id, q - 1)
}
function setQty (id, qty = 0) {
  let item = $cart.find(i => i.id === id)
  if (!item) {
    item = { id, qty: 0}
    $cart.push(item)
  }
  item.qty = Math.max(qty, 0)
  $cart = $cart
}
const checkoutPromise = writable(Promise.resolve())
function doCheckout () {
  $checkoutPromise = createCheckout($cart)
}
const showCartDialog = writable(false)

const showRedeemDialog = writable(q.redeem)

const waitRedeem = writable(Promise.resolve())
if (q.redeem) { doRedeem() }

function doRedeem () {
  const success = q.redeem === 'success'
  const sid = q.session
  $waitRedeem = redeem(sid, success)
}
</script>
<shop-view data-theme="dark">
  <splash class="column xcenter">
    <img src="/gfx/shop.jpg" alt="The Bar"/>
  </splash>
  <section class="block container">
    <h1 class="text-center">The Bartender</h1>
    <drinks>
      <!-- BADGE LINE -->
      <item class="drink row xcenter">
        <iimage>{badge.image}</iimage>
        <description class="column xstart grow2 space-between">
          <h3>{badge.name}</h3>
          <h6>¤ {badge.time} | ONE TIME</h6>
          <short>{badge.short}</short>
        </description>
        <buy class="column center">
          <button disabled={$hasBadge} class="green"
            on:click={() => $showVerifyDialog = true}>
            free
          </button>
        </buy>
      </item>

      <h2 class="text-center nogap">Drinks</h2>
      {#if !$hasBadge}
      <a on:click={() => $showVerifyDialog = true} class="row xcenter center">
        <div>Verify your profile to buy drinks</div>
      </a>
      {/if}

      {#each INVENTORY.drinks as drink}
        <item class="drink row xcenter">
          <iimage>{drink.image}</iimage>
          <description class="column xstart grow2 space-between">
            <h3>{drink.name}</h3>
            <h6>
              ¤ {drink.time}
              {#if drink.mod}
                | {drink.mod}
              {/if}
            </h6>
            <short>{drink.short}</short>
          </description>
          <buy class="column center">
            <button class="blue" disabled={!$hasBadge}
              on:click={() => addCart(drink.id)}>
              € {(drink.price / 100)}
            </button>
          </buy>
        </item>
      {/each}
    </drinks>

    <h2 class="text-center nogap">Gear</h2>
    <gear>
      {#each INVENTORY.gear as item}
        <item class="item row xcenter">
          <iimage>{item.image}</iimage>
          <description class="column xstart grow2 space-between">
            <h3>{item.name}</h3>
            <h6>
              {#if item.mod}
                {item.mod}
              {/if}
            </h6>
            <short>{item.short}</short>
          </description>
          <buy class="column center">
            <button>¤ {Math.ceil(item.price / 100)}</button>
          </buy>
        </item>
      {/each}
    </gear>
  </section>

  {#if $showVerifyDialog}
    <Dialog open={true} on:fade={() => $showVerifyDialog = false}>
      <article>
        <header><h5>Verify Profile</h5></header>
        <label for="email">
          <h5>email</h5>
          <input type="email"
            bind:value={$email}
            placeholder="name@host.tld"
            disabled={$badgeStatus ? 'true' : null}
            on:keypress={e => e.charCode === 13 && requestStamp()} />
        </label>
        <div class="row center xcenter">
          {#await $_waitRequestStamp}
            <p aria-busy="true">Requesting badge</p>
          {:then message}
            <p>{message}</p>
          {:catch err}
            <error>{err.message}</error>
          {/await}
        </div>
        <footer>
          <div class="row space-between">
            <b role="button" on:click={() => $showVerifyDialog = false}>close</b>
            <b role="button"
              on:click={requestStamp}
              disabled={$badgeStatus ? 'true' : null}>
              verify
            </b>
          </div>
        </footer>
      </article>
    </Dialog>
  {/if}
  {#if $showCartDialog}
    <Dialog open={true} on:fade={() => $showCartDialog = false}>
      <article>
        <header><h5>Cart</h5></header>
        {#if !$cart.length}
          <h3>Your cart is empty</h3>
        {/if}

        {#each $cart as item}
          <item class="item row xcenter">
            <iimage>{ITEMS[item.id].image}</iimage>
            <description class="column xstart grow2 space-between">
              <h3>{ITEMS[item.id].name}</h3>
              <short>{ITEMS[item.id].short}</short>
            </description>
            <buy class="row center xcenter">
              <b role="button" class="blue" on:click={() => delCart(item.id)}>-</b>
              <!-- <input type="number" value={item.qty} /> -->
              <h3 class="nogap nopad hpad">{item.qty}</h3>
              <b role="button" class="blue" on:click={() => addCart(item.id)}>+</b>
            </buy>
          </item>
        {/each}
          <h3 class="text-right">
            Sum € {($cartSum / 100).toFixed(2)}
          </h3>
        {#await $checkoutPromise}
          <h2 aria-busy="true" class="nogap text-center">Loading...</h2>
        {:then url}
          {#if url?.length}
            <h3 class="nogap text-center"><a href={url}>Proceed to checkout</a></h3>
          {/if}
        {:catch err}
          <p class="error text-center">{err.message}</p>
        {/await}
        <footer class="flex row space-between xcenter">
          <button on:click={() => $showCartDialog = false}>hide</button>
          <div>&nbsp;</div>
          <button class="green" on:click={doCheckout} disabled={!$cart.length}>checkout</button>
        </footer>
      </article>
    </Dialog>
  {/if}
  {#if $showRedeemDialog}
    <Dialog open={true}>
      <article>
        <header><h5>Redeeming order</h5></header>
        <div class="flex column xcenter">
          {#await $waitRedeem}
            <emo aria-busy="true">📦</emo>
          {:then message}
            <emo>🥂</emo>
            <p>{message}</p>
          {:catch err}
            <emo>😥</emo>
            <error>{err.message}</error>
            <p>
            Something went wrong, please contact support
            tony@decentlabs.se and include error report
            below in the message<br/>
            We're very sorry to be us right now.
            </p>
<pre class="error-report vgap">
{window.location}
{err.message}
{err.stack}
</pre>
          {/await}
        </div>
        <footer class="flex row space-between xcenter">
          {#await $waitRedeem}
            <button class="green" disabled="true">Ok</button>
          {:then}
            <button class="green" on:click={() => navigate('/wallet')}>Ok</button>
          {:catch}
            <button class="red" on:click={doRedeem}>Retry</button>
          {/await}
        </footer>
      </article>
    </Dialog>
  {/if}
  <bar class="flex row space-between xcenter">
    <div class="flex row center xcenter">
      <button class="round" on:click={() => navigate('/')}>back</button>
    </div>
    <h3 class="stat nopad nogap">¤ {Math.floor(Math.max($profile.expiresAt - Date.now(), 0) / 1000)}</h3>

    <h3 class="nopad nogap" on:click={() => $showCartDialog = !$showCartDialog}>
      🛒 {$cartQty}
    </h3>
  </bar>
</shop-view>
<style>
  splash { margin-bottom: -3em; }
  item {
    border-bottom: 1px solid var(--slate);
    margin-bottom: 7px;
    padding-bottom: 7px;
  }
  gear item, drinks item:last-child { border-bottom: none; }

  item iimage {
    display: block;
    width: 50px;
    height: 50px;
    border: 1px solid var(--slate);
    line-height: 50px;
    vertical-align: middle;
    text-align: center;
  }
  item description {
    line-height: 1em;
  }
  item description h3, item description h6, item description short { margin: 3px; }
  item buy button {
    margin: 0;
    padding: 4px 1em;
  }
  item description short { color: var(--h6-color); }
  item description h6 { color: var(--muted-color); }
  emo {
    --size: 5em;
    display: inline-block;
    font-size: var(--size);
    /* line-height: var(--size);
    height: var(--size);
    width: var(--size); */
  }
  .error-report {
    max-width: 100%;
    max-height: 5em;
    overflow: scroll;
  }
</style>

