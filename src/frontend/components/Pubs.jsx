import React from 'react'
import { useHistory } from 'react-router-dom'
import pubsList from '../pubs.json'
import { enterPub } from '../db.js'

export default function Pubs () {
  const history = useHistory()
  function Pub (pub) {
    const icons = {
      beer: '🍺',
      wine: '🍷',
      cider: '🍸'
    }
    function click () {
      enterPub(pub.name).then(() => {
        console.log('Pub entered', pub.name)
        history.push('/pub')
      }).catch(err => {
        console.error('Failed entering pub', err)
      })
    }
    return (
      <div className='w' key={pub.id} onClick={click}>
        <div className='containerbackground'><h1 className='bar-name'><strong>{pub.name}</strong></h1></div>
        <h2 className='icon-2'>
          {pub.drinks.map(drink => (
            <span className='icon-3' key={drink}>{icons[drink]}</span>
          ))}
        </h2>
      </div>
    )
  }

  return (
    <div>
      <p className='has-text-centered'>Choose a bar to enter beblow</p>
      <div>{pubsList.map(Pub)}</div>
    </div>
  )
}
