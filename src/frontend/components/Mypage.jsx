import React from 'react'
import { kernel, useProfile } from '../db'





export default function Mypage () {
	const profile = useProfile()
  	console.log('my profile', profile)
  	//console.log('my pk is', profile.pk.hexSlice())
	return (
		
		
<div className="row-3">

		
		
<div className="columns is-mobile">
  <div className="column row-2"><strong>User Name</strong></div>
  <div className="column row-2"><strong>Old</strong></div>
  <div className="column row-2"><strong>Gender</strong></div>
  <div className="column"><strong>About you</strong></div>
</div>
<div className="columns is-vcentered">
  <div className="column row-2">{profile.name}</div>
  <div className="column row-2">{profile.age} years old</div>
  <div className="column row-2">the sex is {profile.sex}</div>
  <div className="column">{profile.tagline}</div>
</div>
<div className="level-item">
  <a type="loggOut"  className="button is-danger" /*onClick={loggOut}*/>Sign Out</a>
</div>
</div>
		)
}