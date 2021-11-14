import React, { useState } from 'react'
import { kernel, usePeers } from './db'
import 'bulma/css/bulma.css'
import { HashRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Profile from './components/Profile.jsx'
import Mypage from './components/MyPage.jsx'
import AboutPage from './components/AboutPage.jsx'
import Rules from './components/RulesPage.jsx'
import ErrorPage from './components/ErrorPage.jsx'
import Pubs from './components/PubPage.jsx'
import Chat from './components/Chat.jsx'

let loading = true
const promise = kernel.load()
  .then(l => {
    kernel.startGC()
    console.info('kernel loaded', l)
    loading = false
    window.location.hash = l ? '/' : '/register'
    return l
  })
  .catch(err => {
    window.location.hash = '/error'
    loading = false
    console.error('kernel loaded fail', err)
    return false
  })

export default function App () {
  const [loggedIn, setLoggedIn] = useState(false)
  promise.then(setLoggedIn)
  if (loading) {
    return (
      <main className='kernel-loader'>
        <h1>Loading...</h1>
      </main>
    )
  }
  return (
    <Router>
      <div className='container is-success raw-4'>
        <Header loggedIn={loggedIn} />
        <Switch>
          <Route component={Mypage} path='/' exact />
          <Route component={Profile} path='/register' />
          <Route component={AboutPage} path='/about' />
          <Route component={Rules} path='/policy' />
          <Route component={ErrorPage} path='/error' />
          <Route component={Pubs} path='/pub' />
          <Route component={Chat} path='/chat/:id' />
          <Redirect to='/' />
        </Switch>
      </div>
      <Footer />
    </Router>
  )
}
