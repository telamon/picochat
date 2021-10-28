import React from 'react'
import { useVibes } from '../db.js'

export default function VibeList () {
  console.log('VibeList')
  const vibes = Object.values(useVibes().seen || {})

  console.log(vibes)
  return (
    <ul className='columns'>
      {vibes.map(vibe => (
        <li key={vibe.chatId}>{JSON.stringify(vibe)}</li>
      ))}

    </ul>
  )
}
