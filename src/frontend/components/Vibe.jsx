import React from 'react'
import { kernel, useVibes } from '../db.js'
import dayjs from 'dayjs'
import CountDownTimer from './CountDown.jsx'

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
              {vibe.state === 'waiting_local' && (
                <div className='column'>
                  <span> You got one Vibe from
                    <strong>{vibe.peer.name}</strong>
                    <CountDownTimer expiresAt={vibe.expiresAt} />
                  </span>
                  <button
                    className='button'
                    onClick={() => respondToVibe(vibe.id, false)}
                  >👎
                  </button>
                  <button
                    className='button like-zoom'
                    onClick={() => respondToVibe(vibe.id, true)}
                  >👍
                  </button>
                </div>
              )}
              {vibe.state === 'match' && (
                <a href={`#/chat/${vibe.id.toString('hex')}`}>
                  ❤️ You matched with {vibe.peer.name}
                  <CountDownTimer expiresAt={vibe.expiresAt} />
                </a>
              )}
              {vibe.state === 'waiting_remote' && (
                <span> You sent Vibe to
                  <strong>{vibe.peer.name}</strong>
                  <span>⌛<CountDownTimer expiresAt={vibe.expiresAt || 0} /></span>
                </span>
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
