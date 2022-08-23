import polyfills from 'rollup-plugin-node-polyfills'
import commonjs from '@rollup/plugin-commonjs'
// import builtins from 'rollup-plugin-node-builtins'
// import globals from 'rollup-plugin-node-globals'
import resolve from '@rollup/plugin-node-resolve'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import css from 'rollup-plugin-css-only'
import json from '@rollup/plugin-json'
import svelte from 'rollup-plugin-svelte'
import svgSprite from 'rollup-plugin-svg-sprite-deterministic'
import replace from '@rollup/plugin-replace'

const production = !process.env.ROLLUP_WATCH
const version = JSON.parse(require('fs').readFileSync('./package.json')).version
const commit = require('child_process')
  .execSync('git rev-parse HEAD')
  ?.toString('utf8').trim()

const PORT = 5000

export default {
  input: 'frontend/main.js',
  output: {
    sourcemap: true, // !production, costs about ~2MB
    format: 'iife',
    name: 'app',
    file: 'public/build/bundle.js',
    globals: { }
  },

  plugins: [
    svelte({
      compilerOptions: {
        dev: !production
      }
    }),
    replace({
      preventAssignment: true,
      __ENV__: production ? 'production' : 'dev',
      __VERSION__: version,
      __COMMIT__: commit
    }),
    // we'll extract any component CSS out into
    // a separate file - better for performance
    css({ output: 'bundle.css', sourceMap: false }),
    json(),
    resolve({
      browser: true,
      dedupe: ['svelte', 'sodium-universal'],
      preferBuiltins: false
    }),
    commonjs(),
    polyfills({ sourceMap: true, include: ['buffer'] }),

    // builtins(),
    // globals(),

    svgSprite({
      outputFolder: 'public/build'
    }),
    !production && serve(),
    !production && livereload('public'),
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
}

function serve () {
  let server

  function toExit () {
    if (server) server.kill(0)
  }

  return {
    writeBundle () {
      if (server) return
      server = require('child_process').spawn('npm',
        [
          'run', 'start', '--', '--dev', '--host 0.0.0.0', `--port ${PORT}`
        ],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true
        })

      process.on('SIGTERM', toExit)
      process.on('exit', toExit)
    }
  }
}
