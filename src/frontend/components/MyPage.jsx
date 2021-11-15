import React from 'react'
import { useProfile } from '../db'
import Pubs from './Pubs.jsx'
import dayjs from 'dayjs'
import CountDownTimer from './CountDown.jsx'

export default function Mypage () {
  const icons = {
    0: '♀️',
    1: '♂️',
    2: '⚧️'
  }
  const profile = useProfile()
  console.log('my profile', profile)
  return (
    <>
      <div>
        <br />
        <h2 className='title'>Profile</h2>
        <h4 className='subtitle'>This is your profile block, it's immutable</h4>
        <br />
      </div>
      <div className='columns card-div'>
        <div className='column'>
          <span className='icon-3'>{profile.picture}</span>
        </div>
        <div className='column'>
          <h1 className='pk'>@{profile.name}<span>#{profile.pk}</span></h1>
          <p>{profile.age} years old</p>
          <p>Pickup line: {profile.tagline}</p>
          <p className='icon-2'>{icons[profile.sex]}</p>
          <p>Was created at {dayjs(profile.date).format('DD/MM/YYYY HH:mm:ss')}</p>
          <CountDownTimer expiresAt={profile.expiresAt || 0} />
          <p>State: <samp>{profile.state}</samp></p>
        </div>
      </div>
      <Pubs />
    </>
  )
}
