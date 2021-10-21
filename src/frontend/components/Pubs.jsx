import React from 'react'
import { useHistory } from 'react-router-dom'
import pubsList from '../pubs.json'
import { enterPub } from '../db.js'

/*
function Bar () {

}
const history = useHistory()
const [data, setData] = useState([])
const getData = () => {
  fetch('../pubs.json'
    ,{
      headers : {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).then(function (response) {
        console.log(response)
        return response.json();
    }).then(function(pubs) {
        console.log(pubs)
    });
    useEffect(() => {
      getData()
    })
},[]
*/

export default function Pubs () {
  const history = useHistory()
  console.log(pubsList)

  function Pub (pub) {
    function click () {
      console.log('pub name clicked', pub.name)
      enterPub(pub.name).then(() => {
        console.log('pub entered', pub.name)
      }).catch(err => {
        console.error('faild entered Pub', err)
      })
    }
    return (
      <div key={pub.id} onClick={click}>
        <h1><strong>{pub.name}</strong></h1>
        <h2>
          {pub.drinks.map(drink => (
            <span className='icon' key={drink}>{drink}</span>
          ))}
        </h2>
      </div>
    )
  }

  return (
    <div>
      <h2>Here is Bar's</h2>
      <h4>{pubsList.map(Pub)}</h4>
    </div>
  )
}
