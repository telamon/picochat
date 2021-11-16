import React from 'react'
import { kernel, usePeers } from '../db'
import VibeList from './Vibe.jsx'
import dayjs from 'dayjs'
import CountDownTimer from './CountDown.jsx'
import Spinner from './Spinner.jsx'

export default function Pubs () {
  const peers = usePeers()
  const icons = {
    0: '♀️',
    1: '♂️',
    2: '⚧️'
  }
  const sendVibe = (peer) => {
    console.log('pk', peer.pk)
    kernel.sendVibe(peer.pk)
      .then(chatId => {
        console.log('Vibe sent!', chatId)
      })
      .catch(err => {
        console.error('Send vibe failed', err)
      })
  }
  const pubName = 'HardCode'
  return (
    <>
      <div className='hero'>
        <h1 className='bar'>{pubName}</h1>
        <VibeList />
        {peers.length === 0 && (
          <div className='has-text-centered'>
            <Spinner />
            Looking for peers...
          </div>
        )}
        {!!peers.length && (
          <div className='peers-list peers-list-wrap'>
            {peers.map(peer => (
              <div className='peers-list-wrap-2' key={peer.pk}>
                <div className='column peers-list-2'>
                  <div className='column peers-icon'>
                    <span className='icon-3'>{peer.picture}</span>
                  </div>
                  <div className='column'>
                    <span className='icon-2'>{icons[peer.sex]}</span>
                    <h1>{peer.name}</h1>
                    <span title='Game Over when expires!'><CountDownTimer expiresAt={peer.expiresAt || 0} /></span>
                    <h3 className='smalle-tagline'>{peer.tagline}</h3>
                    <button disabled={0} className='button is-primary' onClick={() => sendVibe(peer)}>Send Vibe</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
