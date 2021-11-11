import React, { useState } from 'react'
import debug from 'debug'
const patterns = [
  '*',
  'hyper*',
  'pico*',
  'picochat:kernel',
  'picochat:mod:*',
  'picochat:mod:net',
  'picochat:mod:gc',
  'picochat:mod:reg',
  'picochat:slice*'
]

export default function DebugLogging () {
  const opts = patterns.map(name => ({ name, enabled: debug.enabled(name) }))
  const [names, setNames] = useState(debug.namespaces)

  function set (value) {
    if (value === '') {
      debug.disable()
      setNames('')
    } else {
      debug.enable(value)
      setNames(debug.namespaces)
    }
  }
  return (
    <div className='debug-logger'>
      <code> Logging:</code>
      <input list='patterns' value={names} onChange={ev => set(ev.target.value)} />
      <datalist id='patterns'>
        {opts.map(({ name, enabled }) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}
