import React from 'react'
import { kernel, useFriendsList } from './db'
import Profile from './Profile.jsx'

export default function () {
  const peers = useFriendsList()
  console.log('Peers Store:', peers)
  return (
    <div>
      <h1>Hello Hyperspace</h1>
      <p>Logged in: <b>{kernel.ready ? 'yup' : 'nope'}</b></p>
      <Profile />
    </div>
  )
}
