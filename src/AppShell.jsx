import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen, SignupScreen } from './screens/auth.jsx'
import { HomeScreen } from './screens/home.jsx'
import { MatchesScreen } from './screens/matches.jsx'
import { PlayersScreen } from './screens/players.jsx'
import { ProfileScreen } from './screens/profile.jsx'
import { TeamsScreen } from './screens/teams.jsx'
import { TournamentScreen } from './screens/tournament.jsx'
import { TOKEN_KEY } from './lib/constants.js'
import { getStoredUser } from './lib/helpers.js'

export default function AppShell() {
  const params = new URLSearchParams(window.location.search)
  const resetToken = params.get('token')

  const screenFromPath = useCallback(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    if (resetToken) return 'reset'
    if (path === '/matches') return 'matches'
    if (path === '/tournament' || path === '/tournaments') return 'tournaments'
    if (path === '/teams') return 'teams'
    if (path === '/players') return 'players'
    if (path === '/profile') return 'profile'
    if (path === '/signup') return 'signup'
    if (path === '/forgot') return 'forgot'
    return localStorage.getItem(TOKEN_KEY) && getStoredUser() ? 'home' : 'login'
  }, [resetToken])

  const [user, setUser] = useState(getStoredUser)
  const [screen, setScreen] = useState(screenFromPath)

  function goTo(nextScreen) {
    const paths = {
      home: '/',
      matches: '/matches',
      tournaments: '/tournament',
      teams: '/teams',
      players: '/players',
      profile: '/profile',
      signup: '/signup',
      forgot: '/forgot',
    }
    if (nextScreen !== 'reset') {
      window.history.pushState({}, '', paths[nextScreen] || '/')
    }
    setScreen(nextScreen)
  }

  function handleAuthed(nextUser) {
    setUser(nextUser)
    window.history.pushState({}, '', '/')
    setScreen('home')
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('cricscore_user')
    setUser(null)
    window.history.pushState({}, '', '/')
    setScreen('login')
  }

  useEffect(() => {
    function handlePopState() {
      setScreen(screenFromPath())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [screenFromPath])

  if (screen === 'home') return <HomeScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'matches') return <MatchesScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'tournaments') return <TournamentScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'teams') return <TeamsScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'players') return <PlayersScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'profile') return <ProfileScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'signup') return <SignupScreen onAuthed={handleAuthed} goTo={goTo} />
  if (screen === 'forgot') return <ForgotPasswordScreen goTo={goTo} />
  if (screen === 'reset') return <ResetPasswordScreen token={resetToken} goTo={goTo} />
  return <LoginScreen onAuthed={handleAuthed} goTo={goTo} />
}
