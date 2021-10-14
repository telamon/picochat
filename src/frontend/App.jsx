import React, { useState } from 'react'
import { kernel, useFriendsList } from './db'
import Header from './Header.jsx'
import Profile from './Profile.jsx'
import 'bulma/css/bulma.css'

const promise = kernel.load() 
    .then(l => {
     console.info('kernel loaded', l)
     return l
    }) 
    .catch (err => {
      console.error('kernel loaded fail', err)
      return false
    })

export default function () {
  const peers = useFriendsList()
  console.log('Peers Store:', peers)
  
  const [loggedIn, setLoggedIn] = useState(false)
  promise.then(setLoggedIn)
  return (
    <div className="container">
      <Header />
      <h1>Hello Hyperspace</h1>
      <p>Logged in: <b>{loggedIn ? 'yup' : 'nope'}</b></p>
      <Profile />
    </div>
  )
}
