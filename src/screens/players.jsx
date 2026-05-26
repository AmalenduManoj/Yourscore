import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest } from '../lib/api.js'
import { canManage, playerLabel, statValue } from '../lib/helpers.js'
import { PlayerForm } from './profile.jsx'

export function PlayersScreen({ user, goTo, onLogout }) {
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const manager = canManage(user)

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/players')
      setPlayers(Array.isArray(data) ? data : [])
      setShowCreate(false)
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => {
    let active = true

    async function initialLoad() {
      try {
        const data = await apiRequest('/players')
        if (!active) return
        setPlayers(Array.isArray(data) ? data : [])
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialLoad()
    return () => {
      active = false
    }
  }, [onLogout])

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const haystack = `${player.name} ${player.role} ${player.id}`.toLowerCase()
    const matchesQuery = haystack.includes(query.toLowerCase())
    const matchesRole = role === 'all' || String(player.role).toLowerCase() === role
    const matchesStatus = status === 'all' || String(Boolean(player.is_active)) === status
    return matchesQuery && matchesRole && matchesStatus
  }), [players, query, role, status])

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="players" goTo={goTo} onLogout={onLogout} />
      <section className="directory-page">
        <div className="directory-title">
          <div>
            <h1>Players</h1>
            <p>Manage roster data and track individual performance metrics.</p>
          </div>
          {manager && <button type="button" onClick={() => setShowCreate((current) => !current)}>+ Add Player</button>}
        </div>

        <StatusMessage type="error">{error}</StatusMessage>
        {showCreate && manager && <PlayerForm mode="create" onSaved={loadPlayers} onCancel={() => setShowCreate(false)} />}

        <div className="directory-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player" />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">All Roles</option>
            <option value="batsman">Batsman</option>
            <option value="bowler">Bowler</option>
            <option value="all-rounder">All-rounder</option>
            <option value="wicket keeper">Wicket keeper</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button type="button" onClick={() => { setQuery(''); setRole('all'); setStatus('all') }}>Reset</button>
        </div>

        <div className="directory-table player-table">
          <div className="directory-head"><span>Player</span><span>Role</span><span>Age</span><span>Status</span><span>Runs</span><span>Avg</span><span>Wickets</span><span>Econ</span></div>
          {filteredPlayers.map((player) => (
            <button className="directory-row player-directory-row" type="button" onClick={() => goTo('player', { id: player.id })} key={player.id}>
              <strong>{playerLabel(player)}<small>ID {player.id}</small></strong>
              <span data-label="Role">{player.role || 'Player'}</span>
              <span data-label="Age">{player.dob ? new Date().getFullYear() - Number(player.dob) : '-'}</span>
              <span data-label="Status" className={player.is_active ? 'positive' : 'negative'}>{player.is_active ? 'Active' : 'Inactive'}</span>
              <span data-label="Runs">{statValue(player.runs_scored).toLocaleString()}</span>
              <span data-label="Avg">{statValue(player.batting_average).toFixed?.(1) || 0}</span>
              <span data-label="Wickets">{statValue(player.wickets_taken)}</span>
              <span data-label="Econ">{statValue(player.economy_rate).toFixed?.(2) || 0}</span>
            </button>
          ))}
          {loading && <p className="muted table-empty">Loading players...</p>}
          {!loading && filteredPlayers.length === 0 && <p className="muted table-empty">No players found.</p>}
        </div>
      </section>
    </main>
  )
}

export function PlayerDetailScreen({ user, goTo, onLogout }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const playerId = new URLSearchParams(window.location.search).get('id')

  useEffect(() => {
    let active = true

    async function loadPlayer() {
      setLoading(true)
      setError('')
      try {
        const data = await apiRequest('/players')
        const list = Array.isArray(data) ? data : []
        if (!active) return
        setPlayer(list.find((item) => String(item.id) === String(playerId)) || null)
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPlayer()
    return () => {
      active = false
    }
  }, [onLogout, playerId])

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="player" goTo={goTo} onLogout={onLogout} />
      <section className="detail-page">
        <button className="profile-back" type="button" onClick={() => goTo('players')}>← Back to players</button>
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <p className="muted">Loading player...</p>}
        {!loading && player && (
          <>
            <article className="profile-hero detail-card">
              <div className="profile-avatar">
                {player.profile_picture_url ? <img src={player.profile_picture_url} alt={playerLabel(player)} /> : <span>{playerLabel(player).charAt(0)}</span>}
                <strong>{player.is_active ? 'Active' : 'Inactive'}</strong>
              </div>
              <div>
                <h1>{playerLabel(player)}</h1>
                <span className="role-pill">{player.role || 'Player'}</span>
                <p>{player.bio || 'No bio added yet.'}</p>
              </div>
            </article>

            <div className="profile-stat-grid">
              <article className="profile-panel batting-panel">
                <h2>Batting Performance</h2>
                <div className="big-stats">
                  <div><span>Runs</span><strong>{statValue(player.runs_scored).toLocaleString()}</strong></div>
                  <div><span>Avg</span><strong>{statValue(player.batting_average).toFixed?.(2) || 0}</strong></div>
                  <div><span>SR</span><strong>{statValue(player.strike_rate).toFixed?.(2) || 0}</strong></div>
                  <div><span>100s</span><strong className="green">{statValue(player.centuries)}</strong></div>
                </div>
                <div className="small-stats">
                  <div><span>50s</span><strong>{statValue(player.half_centuries)}</strong></div>
                  <div><span>4s</span><strong>{statValue(player.fours)}</strong></div>
                  <div><span>6s</span><strong>{statValue(player.sixes)}</strong></div>
                  <div><span>Balls</span><strong>{statValue(player.ball_faced)}</strong></div>
                </div>
              </article>

              <article className="profile-panel general-panel">
                <h2>General</h2>
                <div className="general-list">
                  <span>Matches <strong>{statValue(player.matches_played)}</strong></span>
                  <span>Catches <strong>{statValue(player.catches)}</strong></span>
                  <span>Stumpings <strong>{statValue(player.stumpings)}</strong></span>
                  <span className="highlight">MOTM <strong>{statValue(player.player_of_the_match_awards)}</strong></span>
                  <span>DOB <strong>{player.dob || 'Not available'}</strong></span>
                </div>
              </article>
            </div>

            <article className="bowling-strip">
              <h2>Bowling Figures</h2>
              <div>
                <span>Wickets <strong>{statValue(player.wickets_taken)}</strong></span>
                <span>Avg <strong>{statValue(player.bowling_average).toFixed?.(2) || 0}</strong></span>
                <span>Econ <strong>{statValue(player.economy_rate).toFixed?.(2) || 0}</strong></span>
                <span>5W <strong>{statValue(player.five_wicket_hauls)}</strong></span>
                <span>3W <strong>{statValue(player.three_wicket_hauls)}</strong></span>
                <span>Best <strong>{player.best_bowling_figures || 'Not available'}</strong></span>
              </div>
            </article>
          </>
        )}
        {!loading && !player && <p className="muted">Player not found.</p>}
      </section>
    </main>
  )
}
