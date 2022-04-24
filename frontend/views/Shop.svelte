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
            <button>{drink.price}</button>
          </buy>
        </item>
      {/each}
    </drinks>
    <h1 class="text-center">Gear</h1>
  </section>
</shop-view>
<style>
  splash { margin-bottom: -3em; }
  item {
    border-bottom: 1px solid var(--slate);
    margin-bottom: 7px;
    padding-bottom: 7px;
  }
  drinks item:last-child { border-bottom: none; }

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

