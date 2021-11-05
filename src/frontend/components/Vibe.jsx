import React from 'react'
import { kernel, useVibes } from '../db.js'

export default function VibeList () {
  const vibes = useVibes()
  {/*console.log('VIBES', vibes)*/}
  const respondToVibe = (id, didLike) => {
    kernel.respondVibe(id, didLike)
      .then(() => {
        console.log('like was sendnd', id)
      })
      .catch(err => {
        console.log('like cant send', err)
      })
  }

  return (
    <>
      <ul className='column'>
        {vibes.map(vibe => {
          const date = new Date(vibe.createdAt)
          return (
            <li key={vibe.id}>
              <strong>
                You get one Vibe from {vibe.peer.name}
                at {date.toLocaleString('en-GB', { hour12: false })} {vibe.state}
              </strong>
              {vibe.state === 'waiting_local' && (
                <div className='column'>
                  <button className='button' onClick={() => respondToVibe(vibe.id, true)}>👍</button>
                  <button className='button' onClick={() => respondToVibe(vibe.id, false)}>👎</button>
                </div>
              )}
              {vibe.state === 'match' && (
                <a href={`#/chat/${vibe.id.toString('hex')}`}>Chat!</a>
              )}
              {vibe.state === 'waiting_remote' && (
                <span>⌛</span>
              )}
              {vibe.state === 'rejected' && (
                <span>💔</span>
              )}
            </li>
          )
        })}

      </ul>
    </>
  )
}
