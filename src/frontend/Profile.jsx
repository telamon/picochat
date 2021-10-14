import React, { useState } from 'react'


export default function Profile() {
  const [x, setX] = useState(3)
  // const x = 3
  return (
    <>

      <p>
        This is a monkey {x}
      </p>

      <button className="button is-danger" onClick={() => setX(x + 1)}>Banana</button>


  <section class="hero is-success is-halfheight">
  <div class="hero-body">
    <div class="rows">
      <p class="title">
        PicoCHAT is KING
      </p>
      <p class="subtitle">
        You can now CHAT
      </p>
<div className='column'>

            <input className='input is-hovered' type="text" placeholder="Username"/>
            
  </div>

<div className='columns'>

            
            <input id="age" type="number" min="18" max="99" placeholder="Age" className="column" />
            
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
        <textarea className="is-one-third" placeholder="Pickup line" rows="6"></textarea>
      </p>
    </div>
    <nav className="level">
      <div className="level-left">
        <div className="level-item">
          <a type="submit"  className="button is-info">Submit</a>
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
