import React, { useEffect, useState } from 'react'

export default function CountDownTimer ({ start, timeout, onTimeout }) {
  if (typeof start !== 'number') start = new Date(start).getTime()
  if (typeof timeout === 'number') throw new Error('Prop: "timeout" should be a number')

  const [timeLeft, setTimeLeft] = useState(timeout)

  useEffect(() => {
    const timerId = setInterval(() => {
      const now = Date.now()
      setTimeLeft(timeout - (now - start))
    }, 500)

    return () => clearInterval(timerId)
  }, [setTimeLeft, start, timeout])

  if (typeof onTimeout === 'function' && timeLeft <= 0) onTimeout()

  let classes = 'count-down'
  if (timeLeft < 10 * 1000) classes += ' danger'
  else if (timeLeft < 60 * 1000) classes += ' warning'

  return (
    <span className={classes}>
      {timeLeft}
      {/* TODO: use Day.js */}
      {/* 10.5s */}
      {/* 3.4m */}
    </span>
  )
}
