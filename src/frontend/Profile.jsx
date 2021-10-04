import React, { useState } from 'react'

export default function Profile () {
  const [x, setX] = useState(3)
  // const x = 3
  return (
    <>
      <p>
        This is a monkey {x}
      </p>

      <button onClick={() => setX(x + 1)}>Banana</button>
    </>
  )
}
