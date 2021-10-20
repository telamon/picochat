import React from 'react'
import { useHistory } from 'react-router-dom'

const ErrorPage = () => {
  const history = useHistory()
  return (
    <>
      <h2>Sorry this is Error 404 Page</h2>
      <h4>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio, modi!</h4>
      <button className='button' onClick={() => history.push('/')}>Back to START</button>
    </>
  )
}

export default ErrorPage
