import React from 'react'
import { useHistory } from 'react-router-dom'

export default function Chat () {
  const history = useHistory()
  console.log('chats-console')
  return (
    <div className='hero is-success'>
      <h1>hej</h1>
      <button className='button is-primary' onClick={() => history.push('/')}>Back to START</button>

    </div>
  )
}
