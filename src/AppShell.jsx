import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { ForgotPasswordScreen, LoginScreen, ResetPasswordScreen, SignupScreen } from './screens/auth.jsx'
import { HomeScreen } from './screens/home.jsx'
import { MatchListScreen, MatchScoringScreen } from './screens/matches.jsx'
import { PlayerDetailScreen, PlayersScreen } from './screens/players.jsx'
import { ProfileScreen } from './screens/profile.jsx'
import { TeamDetailScreen, TeamsScreen } from './screens/teams.jsx'
import { TournamentScreen } from './screens/tournament.jsx'
import { TOKEN_KEY } from './lib/constants.js'
import { getStoredUser } from './lib/helpers.js'

export default function AppShell() {
  const params = new URLSearchParams(window.location.search)
  const resetToken = params.get('token')

  const screenFromPath = useCallback(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    if (resetToken) return 'reset'
    if (path === '/score') return 'score'
    if (path === '/matches') return 'matches'
    if (path === '/tournament' || path === '/tournaments') return 'tournaments'
    if (path === '/teams') return 'teams'
    if (path === '/team') return 'team'
    if (path === '/players') return 'players'
    if (path === '/player') return 'player'
    if (path === '/profile') return 'profile'
    if (path === '/signup') return 'signup'
    if (path === '/forgot') return 'forgot'
    return localStorage.getItem(TOKEN_KEY) && getStoredUser() ? 'home' : 'login'
  }, [resetToken])

  const [user, setUser] = useState(getStoredUser)
  const [screen, setScreen] = useState(screenFromPath)

  function goTo(nextScreen, params = {}) {
    const paths = {
      home: '/',
      score: '/score',
      matches: '/matches',
      tournaments: '/tournament',
      teams: '/teams',
      team: '/team',
      players: '/players',
      player: '/player',
      profile: '/profile',
      signup: '/signup',
      forgot: '/forgot',
    }
    if (nextScreen !== 'reset') {
      const nextPath = paths[nextScreen] || '/'
      const query = new URLSearchParams(params).toString()
      window.history.pushState({}, '', query ? `${nextPath}?${query}` : nextPath)
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
  if (screen === 'score') return <MatchScoringScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'matches') return <MatchListScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'tournaments') return <TournamentScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'teams') return <TeamsScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'team') return <TeamDetailScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'players') return <PlayersScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'player') return <PlayerDetailScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'profile') return <ProfileScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'signup') return <SignupScreen onAuthed={handleAuthed} goTo={goTo} />
  if (screen === 'forgot') return <ForgotPasswordScreen goTo={goTo} />
  if (screen === 'reset') return <ResetPasswordScreen token={resetToken} goTo={goTo} />
  return <LoginScreen onAuthed={handleAuthed} goTo={goTo} />
}
