import React, { useState } from 'react'
import { kernel, useProfile } from './db'


export default function Profile() {
  
  const profile = useProfile()
  console.log('my profile', profile)

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [age, setAge] = useState(18)
  const [sex, setSex] = useState(0)
  
  function onSubmit () {
    const profile = {
      name, 
      tagline,
      age,
      sex
    }
    console.log('regUser', profile)
    kernel.register(profile)
      .then(() => {
        console.log('reg success')
      })
      .catch(err => {
        console.error('reg fail', err)
      })
  }


  return (
    <>

      <p>
        This is a monkey {x}
      </p>

      <button className="button is-danger" onClick={() => setX(x + 1)}>Banana</button>


  <section className="hero is-success is-halfheight">
  <div className="hero-body">
    <div className="rows">
      <p className="title">
        PicoCHAT is KING
      </p>
      <p className="subtitle">
        You can now CHAT
      </p>
<div className='column'>

            <input className='input is-hovered' type="text" placeholder="Username" value={name} onChange={ev => setName(ev.target.value)}/>
            
  </div>

<div className='columns'>

            
            <input id="age" type="number" min="18" max="99" placeholder="Age" className="column" value={age} onChange={ev => setAge(ev.target.value)}/>
            
<div className='column'>
            <input id="male" type="radio" name="gender" className="column" value="null" />
            <label htmlFor="male">♂️</label>
  </div>

<div className='column'>
            <input id="female" type="radio" name='gender' className="column" value="null" />
            <label htmlFor="female">♀️</label>
  </div>

<div className='column'>
            <input id="others" type="radio" name='gender' className="column" value="null" />
            <label htmlFor="others">⚧️</label>

  </div>
  </div>


<article className="media">
 

  <div className="media-content">
    <div className="field">
      <p className="control">
        <textarea className="is-one-third" placeholder="Pickup line" rows="6" value={tagline} onChange={ev => setTagline(ev.target.value)}></textarea>
      </p>
    </div>
    <nav className="level">
      <div className="level-left">
        <div className="level-item">
          <a type="submit"  className="button is-info" onClick={onSubmit}>Submit</a>
        </div>
      </div>
      <div className="level-right">
        <div className="level-item">
          
          <span>let's get it START now</span>
        </div>
      </div>
    </nav>
  </div>
</article>



    </div>
  </div>





</section>
    </>
  )
}
