import React from 'react'
import { useHistory } from 'react-router-dom'
import { useFriendsList } from '../db'

export default function Pubs () {
  const history = useHistory()
  const peers = useFriendsList()
  return (
    <>
      <div className='hero is-success'>
        <h1 className='barName'>Pubs</h1>
        <div className='peerList'>
          {peers.map(friend => (
            <div className='peerProfile' key={friend.pk}>
              <h3>{friend.name}</h3>
              <span><h2>{friend.age}</h2></span>
              <code><h2>{friend.tagline}</h2></code>
              <code><h2>{friend.sex}</h2></code>
            </div>
          ))}
        </div>
      </div>
      <button className='button is-primary' onClick={() => history.push('/')}>Back to START</button>
    </>
  )
}
