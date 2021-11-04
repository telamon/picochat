import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProfile, useChat } from '../db'

export default function Chat () {
  const { id } = useParams()
  console.log('useparams ', id)
  const profile = useProfile()
  const chat = useChat(id)
  const peer = chat.peer
  console.log('chat', chat)
  const [text, setText] = useState('')

  console.log('profile ', profile)
  console.log('peer ', peer)

  function send () {
    chat.send(text)
      .then(() => {
        console.log('message was sended')
        setText('')
      })
      .catch(err => {
        console.error('sending fail', err)
      })
  }
  if (chat.state === 'loading' || !peer) return (<h5>loading</h5>)
  return (
    <div className='is-success chat-div'>
      <h1>{profile.name} here is you can chat now with
        <strong key={peer.pk}>{peer.name}</strong>
      </h1>

      {/* <div className='chat-container'>
        <span style={{ width: '100%' }}><strong key={peer.pk}>{peer.picture}</strong></span>
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
      </div> */}
      {chat.messages.map(message => {
        return (
          <div key={message.sig} className='chat-container darker'>
            <p>{message.content}</p>
          </div>
        )
      })}
      <div className='column'>
        <div key={peer.box}>{peer.name} user name</div>
        <input
          className='input'
          style={{ width: '75%' }}
          type='text'
          placeholder='Enter your text here'
          value={text}
          onChange={ev => setText(ev.target.value)}
        />
        <button className='button is-info' onClick={send}>SEND</button>
      </div>
    </div>
  )
}
