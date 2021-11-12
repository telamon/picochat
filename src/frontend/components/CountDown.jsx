import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)

export default function CountDownTimer ({ expiresAt, onTimeout }) {
  if (typeof expiresAt !== 'number') throw new Error('Prop: "expiresAt" should be a number')

  const [timeLeft, setTimeLeft] = useState(expiresAt - Date.now())
  useEffect(() => {
    const initialTimeleft = expiresAt - Date.now()
    // When countdown is already zero or less,
    // set timeLeft once and don't start interval
    if (initialTimeleft <= 0) return

    // Set up timeout that triggers onTimeout event
    const timerId = setTimeout(() => {
      if (typeof onTimeout === 'function') onTimeout()
    }, initialTimeleft)

    // Set up interval that updates timeLeft
    const intervalId = setInterval(() => {
      const left = expiresAt - Date.now()
      setTimeLeft(left)
      if (left <= 0) clearInterval(intervalId)
    }, 150)

    // clean up on component unmount
    return () => {
      clearTimeout(timerId)
      clearInterval(intervalId)
    }
  }, [setTimeLeft, expiresAt])

  let classes = 'count-down'
  if (timeLeft < 10 * 1000) classes += ' danger'
  else if (timeLeft < 60 * 1000) classes += ' warning'
  else if (timeLeft <= 0) classes += ' expired'

  return (
    <p className={classes}>

      {timeLeft > 0
        ? dayjs.duration(timeLeft).format('HH:mm:ss.SSS')
        : (
          <span>0</span>
          )}
      {/* TODO: use Day.js */}
      {/* 10.5s */}
      {/* 3.4m */}
    </p>
  )
}
