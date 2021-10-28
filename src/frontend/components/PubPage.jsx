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
    kernel.sendVibe(peer.box)
      .then(chatId => {
        console.log(chatId)
      })
      .catch(err => {
        console.log(err)
      })
  }
  return (
    <>
      <div className='hero'>
        <h1 className='bar'>Pub name is <strong>"HardRock"</strong></h1>
        <h3 className='membersList'>Here is memmbers list which is at this bar now</h3>
        <VibeList />
        <div className='friendsList friendsListWrap'>
          {peers.map(friend => (
            <div className='friendsListWrap2' key={friend.pk}>
              <div className='column friendsList-2'>
                <div className='column friendsIcon'>
                  <span className='icon-3'>{friend.picture}</span>
                </div>
                <div className='column'>
                  <h1>{friend.name}</h1>
                  <span className='icon-2'>{icons[friend.sex]}</span>
                  <h3 className='smalleTagline'>{friend.tagline}</h3>
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
