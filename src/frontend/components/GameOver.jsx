import React from 'react'
import { useHistory } from 'react-router-dom'
import { useProfile } from '../db'

export default function GameOver () {
  const history = useHistory()
  const profile = useProfile()
  console.log(profile)

  return (
    <>
      <div style={{ textAlign: 'center' }} className='is-flex-direction-column'>
        <span className='is-size-1'>💩</span>
        <h1>Score: {profile.score}</h1>
        <div className='is-flex-mobile'>
          {Array.from(new Array(profile.stats.nStarted)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>🏁</span>
            )
          })}
          {Array.from(new Array(profile.stats.nExhausted)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>🎲</span>
            )
          })}
          {Array.from(new Array(profile.stats.nMessages)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>✉️</span>
            )
          })}
          {Array.from(new Array(profile.stats.nEnded)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>🍻</span>
            )
          })}
          {Array.from(new Array(profile.stats.nPassed)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>🏃</span>
            )
          })}
          {Array.from(new Array(profile.score)).map((a, score) => {
            return (
              <span key={score} className='is-size-3'>🎃</span>
            )
          })}
        </div>
        <button className='button is-primary' onClick={() => history.push('/')}>RESTART</button>
      </div>
    </>
  )
}
