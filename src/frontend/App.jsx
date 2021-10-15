import React, { useState } from 'react'
import { kernel, useFriendsList } from './db'
import Header from './components/Header.jsx'
import Profile from './components/Profile.jsx'
import Mypage from './components/Mypage.jsx'
import 'bulma/css/bulma.css'
import { HashRouter as Router, Route, Switch, Redirect } from "react-router-dom";
import AboutPage from './components/AboutPage.jsx'
import Bar from './components/FeedBar.jsx'
import ReactDOM from "react-dom";


const promise = kernel.load()
  .then(l => {
    console.info('kernel loaded', l)
    window.location.hash = l ? '/' : '/register'
    return l
  })
  .catch (err => {
    window.location.hash = '/error'
    console.error('kernel loaded fail', err)
    return false
  })

export default function () {
  const peers = useFriendsList()
  console.log('Peers Store:', peers)

  const [loggedIn, setLoggedIn] = useState(false)
  promise.then(setLoggedIn)
  return (
  <Router>
    <div className="container is-success">
      <Header />
      <Switch>
        <Route component={Profile} path="/" exact />
        <Route component={AboutPage} path="/about"/>
        <Route component={Bar} path="/bar"/>
        <Redirect to="/" />
      </Switch>

      {loggedIn ? <Mypage /> : <Profile />}
      <p>Logged in: <b>{loggedIn ? 'yup' : 'nope'}</b></p>
    </div>
  </Router>

  )
}
