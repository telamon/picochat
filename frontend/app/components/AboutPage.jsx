import React from 'react'
import { useHistory } from 'react-router-dom'

const AboutPage = () => {
  const history = useHistory()
  return (
    <>
      <h2>About</h2>
      <h4>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio, modi!</h4>
      <button className='button is-primary' onClick={() => history.push('/')}>Back to START</button>
    </>
  )
}

export default AboutPage
