import React from 'react'
import { useProfile } from '../db'
import Pubs from './Pubs.jsx'

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
        <h4 className='subtitle'>It is useful to know this data you can't change or delete </h4>
        <br />
      </div>
      <div className='columns card-div'>
        <div className='column'>
          <h1 className='pk'>@{profile.name}<span>#{profile.pk}</span></h1>
          <p>{profile.age} years old</p>
          <p>Profile text: {profile.tagline}</p>
          <span className='icon-2'>{icons[profile.sex]}</span>
        </div>
      </div>
      <Pubs />
    </>
  )
}
