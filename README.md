[`pure | 📦`](https://github.com/telamon/create-pure)
[`code style | standard`](https://standardjs.com/)
# picochat

This is an extremely young and experimental
blockchain with a custom handwritten consensus.

I am developing it as an alternative to PoW and DPoS consensi.
A means to reaching longer lasting decentralization.

At this point in time I honestly don't know if it will ever have a crypto-coin/token. And if it does it will most likely not be worth many dollars.

The benefits of a **coinless blockchain** is that apps can be built
ontop of it without having to suffer from transaction costs or denial-of-service due market manipulation.
As long as the mining ritual is tightly coupled with the primary function
the chain's value will always equal the value of your application.

[The chain](https://github.com/telamon/picofeed) is entirely written in JS, specifically engineered to run in browsers.

A **full node** runs on a low-end user device,
now that...
_is_ Decentralization.

## Start

```bash
yarn
yarn dev
```

## Using as a dependency

```bash
$ npm install picochat
```

```js
import Kernel from 'picochat'
const k = new Kernel(leveldb)
await k.load()

// --or-- in future releases
import { kernel, useProfile, usePeers, useChat } from 'picochat/react-hooks'
```

Proper docs will emerge when the time requires it.
For now read the `blockend/`-source or just [ask](https://github.com/telamon/picochat/issues).

## credits

```ad
|  __ \   Help Wanted!     | | | |         | |
| |  | | ___  ___ ___ _ __ | |_| |     __ _| |__  ___   ___  ___
| |  | |/ _ \/ __/ _ \ '_ \| __| |    / _` | '_ \/ __| / __|/ _ \
| |__| |  __/ (_|  __/ | | | |_| |___| (_| | |_) \__ \_\__ \  __/
|_____/ \___|\___\___|_| |_|\__|______\__,_|_.__/|___(_)___/\___|
Discord: https://discord.gg/K5XjmZx

If you're reading this it means that the docs are missing or in a bad state.

Writing and maintaining friendly and useful documentation takes
effort and time. In order to do faster releases
I will from now on provide documentation relational to project activity.

  __How_to_Help____________________________________.
 |                                                 |
 |  - Open an issue if you have questions! :)      |
 |  - Star this repo if you found it interesting   |
 |  - Fork off & help document <3                  |
 |.________________________________________________|
```


## Changelog

### 0.1.0 first release

## Contributing

By making a pull request, you agree to release your modifications under
the license stated in the next section.

Only changesets by human contributors will be accepted.

## License

[AGPL-3.0-or-later](./LICENSE)

2021 &#x1f12f; Tony Ivanov
