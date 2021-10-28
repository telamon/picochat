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
  const clearDatabase = () => {
    if (!window.confirm('Permanently wipe your data, you sure?')) return
    kernel.db.clear()
    window.location.reload()
  }
  const goToChat = () => {
    console.log('chats')
  }
  return (
    <>
      <div>
        <br />
        <h2 className='title'>Here is your profile</h2>
        <h4 className='subtitle'>It is useful to know this data you can't change or delete </h4>
        <div className='level-item'>
          <button className='button is-primary' onClick={clearDatabase}>LogOUT</button>
          <a type='inspect' className='button is-danger' onClick={inspect}>Inspect FEED</a>
        </div>
        <br />
      </div>
      <div className='columns card-div'>
        <div className='column'>
          <span className='icon-3'>{profile.picture}</span>
        </div>
        <div className='column'>
          <h1 className='pk'>@{profile.name}<span>#{profile.pk}</span></h1>
          <p>{profile.age} years old</p>
          <p>Profile text: {profile.tagline}</p>
          <span className='icon-2'>{icons[profile.sex]}</span>
          <button className='button is-primary' onClick={goToChat}>Conversetions</button>
        </div>
      </div>
      <Pubs />
    </>
  )
}
