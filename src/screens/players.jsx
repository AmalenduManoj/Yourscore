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
            <div className="directory-row" key={player.id}>
              <strong>{playerLabel(player)}<small>ID {player.id}</small></strong>
              <span>{player.role || 'Player'}</span>
              <span>{player.dob ? new Date().getFullYear() - Number(player.dob) : '-'}</span>
              <span className={player.is_active ? 'positive' : 'negative'}>{player.is_active ? 'Active' : 'Inactive'}</span>
              <span>{statValue(player.runs_scored).toLocaleString()}</span>
              <span>{statValue(player.batting_average).toFixed?.(1) || 0}</span>
              <span>{statValue(player.wickets_taken)}</span>
              <span>{statValue(player.economy_rate).toFixed?.(2) || 0}</span>
            </div>
          ))}
          {loading && <p className="muted table-empty">Loading players...</p>}
          {!loading && filteredPlayers.length === 0 && <p className="muted table-empty">No players found.</p>}
        </div>
      </section>
    </main>
  )
}
