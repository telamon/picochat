[`pure | 📦`](https://github.com/telamon/create-pure)
[`code style | standard`](https://standardjs.com/)
# picochat

**Picochat** is a miniverse bar that runs on top of picostack, it is the first of it's kind and will serve as a reference application for the framework.

**Picostack** is an experimental Web6 framework that focuses on contracts instead of crypto.

A custom coinless blockchain that uses a functional-consensus.

It dosen't waste energy such as PoW nor does it run corrupt same way as DPoS.
Boasting zero transaction costs it provides a means to reaching longer lasting decentralization.

The entire stack is written in pure ES6. The kernel is designed to live within a browser-tab without external dependencies, it's very lightweight.

A full node runs on a low-end user device without depending on a central service.

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

If you're reading this it means that the docs are missing or in a bad state.

Writing and maintaining friendly and useful documentation takes
effort and time.

  __How_to_Help____________________________________.
 |                                                 |
 |  - Open an issue if you have questions!         |
 |  - Star this repo if you found it interesting   |
 |  - Fork off & help document <3                  |
 |  - Say Hi! :) https://discord.gg/8RMRUPZ9RS     |
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
