import React, { useState } from 'react'
import { kernel, useFriendsList } from './db'
import Header from './components/Header.jsx'
import Profile from './components/Profile.jsx'
import Mypage from './components/MyPage.jsx'
import 'bulma/css/bulma.css'
import { HashRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import AboutPage from './components/AboutPage.jsx'
import Bar from './components/Pubs.jsx'
import Rules from './components/RulesPage.jsx'
import ErrorPage from './components/ErrorPage.jsx'

const promise = kernel.load()
  .then(l => {
    console.info('kernel loaded', l)
    window.location.hash = l ? '/' : '/register'
    return l
  })
  .catch(err => {
    window.location.hash = '/error'
    console.error('kernel loaded fail', err)
    return false
  })

export default function App () {
  const peers = useFriendsList()
  console.log('Peers Store:', peers)

  const [loggedIn, setLoggedIn] = useState(false)
  promise.then(setLoggedIn)
  return (
    <Router>
      <div className='container is-success raw-4'>
        <Header />
        <Switch>
          <Route component={Mypage} path='/' exact />
          <Route component={Profile} path='/register' />
          <Route component={AboutPage} path='/about' />
          <Route component={Bar} path='/bar' />
          <Route component={Rules} path='/policy' />
          <Route component={ErrorPage} path='/error' />
          <Redirect to='/' />
        </Switch>

        <p>Logged in: <b>{loggedIn ? 'yup' : 'nope'}</b></p>
      </div>
    </Router>

  )
}
