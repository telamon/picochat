import React from 'react'
import { useHistory } from 'react-router-dom'

const ErrorPage = () => {
  const history = useHistory()
  const errorStyle = {
    fontSize: 80,
    color: 'red',
    textAlign: 'center',
    margin: 20
  }

  return (
    <>
      <div className='rows'>
        <span style={errorStyle}>Error 500</span>
        <h1> Sorry this is internal Error</h1>
        <h4>Please click button to go main page!</h4>
        <button style={{ marginTop: 20 }} className='button is-primary' onClick={() => history.push('/')}>Back to START</button>
      </div>
    </>
  )
}

export default ErrorPage
