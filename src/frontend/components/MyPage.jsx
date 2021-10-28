import React from 'react'
import { kernel, useProfile } from '../db'
import Pubs from './Pubs.jsx'

export default function Mypage () {
  const icons = {
    0: '♀️',
    1: '♂️',
    2: '⚧️'
  }
  function inspect () {
    kernel.feed()
      .then((feed) => {
        feed.inspect()
      })
  }
  const profile = useProfile()
  console.log('my profile', profile)
  // console.log('my pk is', profile.pk.hexSlice())
  return (
    <>
      <div>
        <br />
        <h2 className='title'>Here is your profile</h2>
        <h4 className='subtitle'>It is useful to know this data you can't change or delete </h4>
        <br />
      </div>
      <div className='columns card-div'>
        <div className='column'>
          <span className='icon-3'>👨</span>
        </div>
        <div className='column'>
          <h1>@{profile.name} {profile.age} years old</h1>
          <p className='pk'>Profile pk: {profile.pk}</p>
          <p>Profile text: {profile.tagline}</p>
          <span className='icon-2'>{icons[profile.sex]}</span>
        </div>
      </div>
      <Pubs />
      <div className='level-item'>
        <a type='inspect' className='button is-danger' onClick={inspect}>Inspect FEED</a>
      </div>
    </>
  )
}
