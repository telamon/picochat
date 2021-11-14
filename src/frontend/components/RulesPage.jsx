import React from 'react'

const Rules = () => {
  return (
    <>
      <h2 style={{ fontSize: '2.4em', textAlign: 'center' }}>Disclaimer</h2>
      <p>
        At this point in time we have no control over any peer to peer interactions and by design should never have.
        <br />We do not use cookies.
        <br />And we do not track nor store any personal information.
        <br />PicoChat does not make use of a server nor a central-database.
        <br />All information that you input temporarily lives in your own browser and the browsers of peers you choose to communicate with.
      </p>
      <p style={{ textAlign: 'center' }}>
        <sub>bottomline</sub><br />
        <samp>We take no responsibility for how this software is used or distributed.</samp>
        <br /><small>(<a href='https://github.com/telamon/picochat/issues'>questions?</a>)</small>
      </p>
    </>
  )
}

export default Rules
