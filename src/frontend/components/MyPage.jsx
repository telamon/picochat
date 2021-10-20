import React from 'react'
import { kernel, useProfile } from '../db'

export default function Mypage () {
  function inspect () {
    return (null)
  }
  const profile = useProfile()
  console.log('my profile', profile)
  // console.log('my pk is', profile.pk.hexSlice())
  return (
    <>
      <div>
        <br />
        <h2 className='title'>Here is your profile</h2>
        <h4 className='subtitle'>It is useful to know this data you can't <strong> change or delete </strong></h4>
        <br />
      </div>
      <div className='row-3'>
        <div className='columns is-mobile raw-7'>
          <div className='column row-2'><strong>User Name</strong></div>
          <div className='column row-2'><strong>Old</strong></div>
          <div className='column row-2'><strong>Gender</strong></div>
          <div className='column'><strong>About you</strong></div>
        </div>
        <div className='columns is-mobile raw-7'>
          <div className='column row-2'>{profile.name}</div>
          <div className='column row-2'>{profile.age} years old</div>
          <div className='column row-2'>the sex is {profile.sex}</div>
          <div className='column'>{profile.tagline}</div>
        </div>
        <div className='level-item'>
          <a type='inspect' className='button is-danger' onClick={inspect}>Inspect FEED</a>
        </div>
      </div>
    </>
  )
}
