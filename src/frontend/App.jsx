import React from 'react'
import { useBoot } from './db'
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
import Spinner from './components/Spinner.jsx'

export default function App () {
  const { loading } = useBoot()

  if (loading) {
    return (
      <main className='kernel-loader has-text-centered'>
        <Spinner />
        <h1>Loading...</h1>
      </main>
    )
  }
  return (
    <Router>
      <div className='container is-success raw-4'>
        <Header />
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
