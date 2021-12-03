import React, { useState, useRef, useEffect } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useProfile, useChat, usePeer } from '../db'
import CountDownTimer from './CountDown.jsx'
import dayjs from 'dayjs'

export default function Chat () {
  const { id } = useParams()
  const profile = useProfile()
  const chat = useChat(id)
  const peer = usePeer(chat.peerId)
  const [text, setText] = useState('')
  const messageElement = useRef(null)
  const history = useHistory()
  console.info('Chat.jsx, chat:', chat, ' profile: ', profile)

  useEffect(() => {
    if (chat.state === 'finalizing' && chat.myTurn) {
      bye() // Auto-bye
    }
  }, [chat.state, chat.myTurn])
  console.log('ChatLoader',
    chat.state === 'loading',
    profile.state === 'loading',
    !chat.peerId
  )

  if (messageElement.current) {
    const el = messageElement.current
    setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, left: 0, behavior: 'smooth' })
    }, 150)
  }
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      send()
    }
  }

  function chatTimeout () {
    // history.push('/game_over')
    // TODO: It's not game-over when chat times out.
    // rather chat will eventually be moved into archive where
    // it can be seen in it's finished state
    // redirect to: /archive/chatId
  }

  function send () {
    chat.send(text)
      .then(() => {
        console.log('message sent')
        setText('')
      })
      .catch(err => {
        console.error('chat.send() failed:', err)
      })
  }

  function pass () {
    chat.pass()
      .then(() => {
        console.log('turn passed')
        setText('')
      })
      .catch(err => {
        console.error('chat.pass() failed:', err)
      })
  }
  function bye () {
    console.log('Ending conversation')
    return chat.bye(0)
      .then(() => {
        console.log('chat.bye() succeded')
        setText('')
      })
      .catch(err => {
        console.error('chat.bye() failed:', err)
      })
  }

  function drawHealth () {
    let output = ''
    for (let i = 0; i < 3; i++) {
      output += i < chat.health ? '❤️' : '🤍'
    }
    return output
  }

  // if (chat.state === 'loading') return (<samp>Loading chat..</samp>)
  return (
    <div className='is-success chat-div'>
      <h1>
        <strong>{peer.name}</strong>
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
      <div ref={messageElement} className='messages'>
        {chat.messages.map(message => {
          const classes = 'chat-container darker ' + message.type
          return (
            <div key={message.sig.toString('hex')} className={classes}>
              <p>{message.content}</p>
              <p>{dayjs(message.date).format('HH:mm:ss')}</p>
            </div>
          )
        })}
      </div>
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
