<script>
import inventory from '../inventory.yaml'
</script>
<shop-view data-theme="dark">
  <splash class="column xcenter">
    <img src="/gfx/shop.jpg" alt="The Bar"/>
  </splash>
  <section class="block container">
    <h1 class="text-center">Drinks</h1>
    <drinks>
      <a href="#/profile/?verifyEmail=true" class="row xcenter center">
        <div>Verify your profile to buy drinks</div>
      </a>
      {#each inventory.drinks as drink}
        <item class="drink row xcenter">
          <iimage>img</iimage>
          <description class="column xstart grow2 space-between">
            <h3>{drink.name}</h3>
            <h6>
              {drink.time} min
              {#if drink.mod}
                | {drink.mod}
              {/if}
            </h6>
            <short>{drink.short}</short>
          </description>
          <buy class="column center">
            <button>{Math.ceil(drink.price / 100)}€</button>
          </buy>
        </item>
      {/each}
    </drinks>

    <h2 class="text-center nogap">Gear</h2>
    <gear>
      {#each inventory.gear as item}
        <item class="item row xcenter">
          <iimage>img</iimage>
          <description class="column xstart grow2 space-between">
            <h3>{item.name}</h3>
            <h6>{item.short}</h6>
            <short>
              {#if item.mod}
                {item.mod}
              {/if}
            </short>
          </description>
          <buy class="column center">
            <button>{Math.ceil(item.price / 100)}¤</button>
          </buy>
        </item>
      {/each}
    </gear>
  </section>
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
</style>

