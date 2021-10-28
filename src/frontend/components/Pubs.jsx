import React from 'react'
import { useHistory } from 'react-router-dom'
import pubsList from '../pubs.json'
import { enterPub } from '../db.js'

export default function Pubs () {
  const history = useHistory()
  console.log(pubsList)
  function Pub (pub) {
    const icons = {
      beer: '🍺',
      wine: '🍷',
      cider: '🍸'
    }
    function click () {
      console.log('pub name clicked', pub.name)
      enterPub(pub.name).then(() => {
        console.log('pub entered', pub.name)
        history.push('/pub')
      }).catch(err => {
        console.error('faild entered Pub', err)
      })
    }
    return (
        <div className='w' key={pub.id} onClick={click}>
          <div className='containerbackground'><h1 className='barName'><strong>{pub.name}</strong></h1></div>
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
      <h2>Here is Bar's</h2>
      <div>{pubsList.map(Pub)}</div>
    </div>
  )
}
