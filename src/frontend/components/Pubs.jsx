import React from 'react'
import { useHistory } from 'react-router-dom'

const Bar = () => {
  const history = useHistory()
  return (
    <div>
      <h2>Here is Bar's</h2>
      <h4>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio, modi!</h4>
      <button className='button' onClick={() => history.push('/')}>Back to START</button>
    </div>
  )
}

export default Bar
