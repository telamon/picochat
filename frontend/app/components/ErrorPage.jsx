import React from 'react'
import { useHistory } from 'react-router-dom'

const ErrorPage = () => {
  const history = useHistory()
  const errorStyle = {
    fontSize: 80,
    color: 'purple',
    textAlign: 'center',
    margin: 20
  }

  return (
    <div className='rows'>
      <h2 style={errorStyle}>Kernel Panic!</h2>
      <p>Sorry the kernel is still an infant state and is easily scared by internal errors.</p>
      <p>If the problem persists press the "destroy" button to purge everything with 🔥.</p>
      <p>If that didn't help either then open an <a href='https://github.com/telamon/picochat/issues'>issue</a></p>
      <button className='button is-small is-primary' onClick={() => history.push('/')}>back</button>
    </div>
  )
}

export default ErrorPage
