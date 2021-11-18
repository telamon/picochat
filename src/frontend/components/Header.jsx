import React from 'react'
import { kernel, useProfile } from '../db'
import CountDown from './CountDown.jsx'
import DebugLogging from './DebugLogging.jsx'
import { useHistory } from 'react-router-dom'

export default function Header () {
  const peer = useProfile()
  const history = useHistory()

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

  function gameOver () {
    window.alert('GAME OVER!\n You ran out of time, press the destroy button to restart and play again')
    history.push('/game_over')
  }
  return (
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
              <DebugLogging />
            </li>
            {peer.state === 'loading' && (
              <li>
                <a href='/#/register'>Register</a>
              </li>
            )}
            {peer.state === 'active' && (
              <>
                <li><strong>{peer.name}</strong></li>
                <li>
                  GameOver in &nbsp;&nbsp;
                  <samp><CountDown expiresAt={peer.expiresAt} onTimeout={gameOver} /></samp>
                </li>
              </>
            )}
            {peer.state === 'expired' && (
              <li onClick={clearDatabase}>
                GAME OVER
              </li>
            )}
          </ul>
        </nav>
      </div>
    </div>
  )
}
