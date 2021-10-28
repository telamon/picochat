import React from 'react'
import { useFriendsList } from '../db'

export default function Pubs () {
  const peers = useFriendsList()
  const icons = {
    0: '♀️',
    1: '♂️',
    2: '⚧️'
  }
  return (
    <>
      <div className='hero'>
        <h1 className='bar'>Pub name is <strong>"HardRock"</strong></h1>
        <h3 className='membersList'>Here is memmbers list which is at this bar now</h3>
        <div className='friendsList friendsListWrap'>
          {peers.map(friend => (
            <div className='friendsListWrap2' key={friend.pk}>
              <div className='column friendsList-2'>
                <div className='column friendsIcon'>
                  <span className='icon-3'>👨</span>
                </div>
                <div className='column'>
                  <h1>{friend.name}</h1>
                  <span className='icon-2'>{icons[friend.sex]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
