import React from 'react'
import { kernel } from '../db'

export default function Header ({ loggedIn }) {
  async function inspectFeed () {
    const feed = await kernel.feed()
    feed.inspect()
  }

  async function reloadStores () {
    await kernel.store.reload()
    console.info('Internal cache`s cleared')
  }

  async function clearDatabase () {
    if (!window.confirm('Permanently wipe your data, you sure?')) return
    await kernel.db.clear()
    window.location.reload()
  }

  return (
    <>
      <div className='hero is-success'>
        <div className='centered'>
          <nav className='breadcrumb centered' aria-label='breadcrumbs'>
            <ul>
              <a href='#/' className='brand-logo'>LOGO</a>
              <li><a href='#/'>PicoCHAT</a></li>
              <li><a href='#/policy'>Rules</a></li>
              <li><a href='#/about'>About</a></li>
              <li><a href='#/pub'>Pubs</a></li>
              <li>
                <button className='button is-small' onClick={inspectFeed}>inspect</button>
                <button className='button is-small' onClick={reloadStores}>reload</button>
                <button className='button is-small is-danger' onClick={clearDatabase}>destroy</button>
              </li>
              <li>
                Logged in: {loggedIn ? 'true' : 'false'}
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
