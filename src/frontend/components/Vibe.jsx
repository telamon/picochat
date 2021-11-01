import React from 'react'
import { useVibes } from '../db.js'

export default function VibeList () {
  const vibes = useVibes()
  console.log('tewrhtwrhtsrthwrhtwryw', vibes)


  /*const vibes = Object.values(useVibes().seen || {})*/

  return (
    <ul className='column'>
      {vibes.map(vibe => {
        const date = new Date(vibe.createdAt)
        return (<li key={vibe.id}><strong>You get one Vibe from {vibe.peer.name} at {date.toLocaleString('en-GB', { hour12: false })}</strong></li>)
      })}

    </ul>
  )
}
