import React, { useState } from 'react'
import { kernel } from '../db'

export default function Profile () {
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [age, setAge] = useState(18)
  const [sex, setSex] = useState(1)

  function onSubmit () {
    const profile = {
      name,
      tagline,
      age: parseInt(age),
      sex
    }
    console.log('regUser', profile)
    kernel.register(profile)
      .then(() => {
        console.log('reg success')
        window.location.hash = '/'
      })
      .catch(err => {
        console.error('reg fail', err)
      })
  }
  return (
    <>
      <section className='hero is-halfheight'>
        <div className='hero-body is-success'>
          <div className='rows'>
            <p className='title'>PicoCHAT is KING </p>
            <p className='subtitle'> You can now CHAT </p>
            <div className='column'>
              <input className='input is-hovered' type='text' placeholder='Username' value={name} onChange={ev => setName(ev.target.value)} />
            </div>
            <div className='columns  raw-5' onChange={ev => setSex(parseInt (ev.target.value))}>
              <input id='age' type='number' min='18' max='99' placeholder='Age' className='column' value={age} onChange={ev => setAge(ev.target.value)} />
              <div className='column'>
                <input id='male' type='radio' name='sex' className='column' value='1' checked={sex === 1} />
                <label htmlFor='male'>♂️</label>
              </div>
              <div className='column'>
                <input id='female' type='radio' name='sex' className='column' value='0' checked={sex === 0} />
                <label htmlFor='female'>♀️</label>
              </div>
              <div className='column'>
                <input id='others' type='radio' name='sex' className='column' value='2' checked={sex === 2} />
                <label htmlFor='others'>⚧️</label>
              </div>
            </div>
            <article className='media'>
              <div className='media-content'>
                <div className='field'>
                  <p className='control'>
                    <textarea className='is-one-third raw-6' placeholder='Pickup line' column='10' rows='6' value={tagline} onChange={ev => setTagline(ev.target.value)} />
                  </p>
                </div>
                <nav className='level'>
                  <div className='level-left'>
                    <div className='level-item'>
                      <a type='submit' className='button is-info' onClick={onSubmit}>Submit</a>
                    </div>
                  </div>
                  <div className='level-right'>
                    <div className='level-item'>
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
