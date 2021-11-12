import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProfile, useChat } from '../db'
import CountDownTimer from './CountDown.jsx'
import dayjs from 'dayjs'

export default function Chat () {
  const { id } = useParams()
  const profile = useProfile()
  const chat = useChat(id)
  const peer = chat.peer
  const [text, setText] = useState('')
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      send()
      console.log('message was sended by ENTER key')
    }
  }
  function chatTimeout () {
    const [gameOver, setGameOver] = useState()
  }
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

  function pass () {
    chat.pass()
      .then(() => {
        console.log('Turn is passed')
        setText('')
      })
      .catch(err => {
        console.error('Writing turn to other is fail', err)
      })
  }
  function bye () {
    const gest = 0
    chat.bye(gest)
      .then(() => {
        console.log('Conversation is closed by BYE')
        setText('')
      })
      .catch(err => {
        console.error('Bye function is fail', err)
      })
  }

  if (chat.state === 'finalizing' && chat.myTurn) {
    bye()
  }

  function drawHealth () {
    let output = ''
    for (let i = 0; i < 3; i++) {
      output += i < chat.health ? '❤️' : '🤍'
    }
    return output
  }

  if (chat.state === 'loading' || !peer) return (<h5>loading</h5>)
  return (
    <div className='is-success chat-div'>
      <h1>{profile.name} here is you can chat now with
        <strong key={peer.pk}>{peer.name}</strong>
      </h1>
      <span className='count-down-1'>
        Time left to end of conversation <CountDownTimer expiresAt={chat.expiresAt} onTimeout={chatTimeout} />
      </span>
      <span>
        Chat life(s) left {drawHealth(chat.health)}
      </span>
      <span>
        {(chat.health < 1) ? ' Conversation exhausted' : ` Life left: ${chat.health}`}
      </span>
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
            <p>{dayjs(message.date).format('HH:mm:ss')}</p>
          </div>
        )
      })}
      <div className='column chat-input'>
        {chat.state === 'active' && (
          <div>
            <input
              disabled={!chat.myTurn}
              className='input is-focused'
              style={{ width: '60%' }}
              type='text'
              placeholder='Enter your text here'
              value={text}
              onChange={ev => setText(ev.target.value)}
              onKeyDown={handleKeyDown}
              ref={inputElement => {
                // constructs a new function on each render
                if (inputElement) {
                  inputElement.focus()
                }
              }}
            />
            <button disabled={!chat.myTurn} className='button is-info' onClick={send}>SEND</button>
            <button disabled={!chat.myTurn} className='button is-success' onClick={pass}>Pass</button>
            <button disabled={!chat.myTurn} className='button is-danger' onClick={bye}>GoodBYE</button>
          </div>
        )}
        <pre>{chat.myTurn ? 'your Turn' : 'is not your Turn'}</pre>
        <div>
          <code>chat state is {chat.state}</code>
          <code>chat health is {chat.health}</code>
        </div>
      </div>
    </div>
  )
}
