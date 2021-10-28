import React from 'react'

export default function Header () {
  return (
    <>
      <div className='hero is-danger'>
        <div className='centered'>
          <nav className='breadcrumb centered' aria-label='breadcrumbs'>
            <ul>
              <a href='#/' className='brand-logo'>LOGO</a>
              <li><a href='#/'>PicoCHAT</a></li>
              <li><a href='#/policy'>Rules</a></li>
              <li><a href='#/about'>About</a></li>
              <li><a href='#/pub'>Pubs</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
