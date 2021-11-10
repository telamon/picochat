import React from 'react'
import { kernel, useVibes } from '../db.js'
import dayjs from 'dayjs'

export default function VibeList () {
  const vibes = useVibes()
  console.log('VIBES', vibes)
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
          return (
            <li key={vibe.id}>
                You get one Vibe from <strong>{vibe.peer.name}</strong> at {dayjs(vibe.createdAt).format('h:mm:ss a')}
              {vibe.state === 'waiting_local' && (
                <div className='column'>
                  <button className='button' onClick={() => respondToVibe(vibe.id, false)}>👎</button>
                  <button className='button like-zoom' onClick={() => respondToVibe(vibe.id, true)}>👍</button>
                </div>
              )}
              {vibe.state === 'match' && (
                <a href={`#/chat/${vibe.id.toString('hex')}`}> Begin to CHAT now!</a>
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
