import React from 'react'
import { useHistory } from 'react-router-dom'

const Rules = () => {
  const history = useHistory()
  return (
    <>
      <h2>Disclaimer</h2>
      <p>At this point in time we have no control over any peer to peer interactions and by design might never have.
        <br />We do not use cookies.
        <br />And we do not store any personal information. PicoChat does not make use of a server nor a central-database. All information that you input is in your own browser.
      </p>
      <p><sub>bottomline</sub>
        <strong>We take no responsibility for how this software is used or distributed.</strong>
        <br />
        <small><a href='https://github.com/telamon/picochat/issues'>(any questions?)</a></small>
      </p>
      <button className='button is-primary' onClick={() => history.push('/')}>Back to START</button>
    </>
  )
}

export default Rules
