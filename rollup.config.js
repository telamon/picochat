import polyfills from 'rollup-plugin-node-polyfills'
import commonjs from '@rollup/plugin-commonjs'
// import builtins from 'rollup-plugin-node-builtins'
// import globals from 'rollup-plugin-node-globals'
import resolve from '@rollup/plugin-node-resolve'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import css from 'rollup-plugin-css-only'
import json from '@rollup/plugin-json'
import yaml from '@rollup/plugin-yaml'
import svelte from 'rollup-plugin-svelte'
import svgSprite from 'rollup-plugin-svg-sprite-deterministic'
import replace from '@rollup/plugin-replace'

const production = !process.env.ROLLUP_WATCH
const version = JSON.parse(require('fs').readFileSync('./package.json')).version
const commit = require('child_process')
  .execSync('git rev-parse HEAD')
  ?.toString('utf8').trim()

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
        // enable run-time checks when not in production
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
    yaml(),
    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
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
    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('public'),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
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
          'run', 'start', '--', '--dev', '--host 0.0.0.0'
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
