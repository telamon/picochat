import React from 'react'
import { kernel, useFriendsList } from '../db'
import VibeList from './Vibe.jsx'

export default function Pubs () {
  const peers = useFriendsList()
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
        <h3 className='members-list'>Here is memmbers list which is at this bar now</h3>
        <VibeList />
        <div className='peers-list peers-list-wrap'>
          {peers.map(friend => (
            <div className='peers-list-wrap-2' key={friend.pk}>
              <div className='column peers-list-2'>
                <div className='column peers-icon'>
                  <span className='icon-3'>{friend.picture}</span>
                </div>
                <div className='column'>
                  <h1>{friend.name}</h1>
                  <span className='icon-2'>{icons[friend.sex]}</span>
                  <h3 className='smalle-tagline'>{friend.tagline}</h3>
                  <button className='button is-primary' onClick={() => sendVibe(friend)}>Send Vibe</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
