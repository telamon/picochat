import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { kernel, useProfile, usePeers } from '../db'

export default function Chat () {
  const history = useHistory()
  const profile = useProfile()
  const peers = usePeers()
  const [text, setText] = useState('')

  console.log('profile ', profile)
  console.log('peers ', peers)

  function send () {
    const msg = {
      text
    }
    console.log('regUser', msg)
    kernel.sendMessage(msg)
      .then(() => {
        console.log('message was sended')
      })
      .catch(err => {
        console.error('sending fail', err)
      })
  }

  return (
    <div className='is-success chat-div'>
      <h1>{profile.name} here is you can chat now with {peers.map(peer => (<strong key={peer.pk}>{peer.name}</strong>))} </h1>

      <div className='chat-container'>
        <span style={{ width: '100%' }}> {peers.map(peer => (<strong key={peer.pk}>{peer.picture}</strong>))} </span>
        <p>Hello. How are you today?</p>
        <span className='time-right'>11:00</span>
      </div>

      <div className='chat-container darker'>
        <img src='' alt='Avatar' className='right' style={{ width: '100%' }} />
        <p>Hey! I'm fine. Thanks for asking!</p>
        <span className='time-left'>11:01</span>
      </div>

      <div className='chat-container'>
        <img src='' alt='Avatar' style={{ width: '100%' }} />
        <p>Sweet! So, what do you wanna do today?</p>
        <span className='time-right'>11:02</span>
      </div>

      <div className='chat-container darker'>
        <img src='' alt='Avatar' className='right' style={{ width: '100%' }} />
        <p>Nah, I dunno. Play soccer.. or learn more coding perhaps?</p>
        <span className='time-left'>11:05</span>
      </div>
      <div className='column'>
        <input className='input is-hovered' type='text' placeholder='Enter your text here' value={text} onChange={ev => setText(ev.target.value)} />
        <a type='submit' className='button is-info' onClick={send}>SEND</a>
      </div>
    </div>
  )
}
