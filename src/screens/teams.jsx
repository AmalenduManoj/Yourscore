import { useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest } from '../lib/api.js'
import { canManage, playerLabel, sameId, teamLabel } from '../lib/helpers.js'

export function TeamsScreen({ user, goTo, onLogout }) {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const manager = canManage(user)

  useEffect(() => {
    let active = true

    async function loadTeams() {
      setLoading(true)
      setError('')
      try {
        const teamsData = await apiRequest('/teams/get')
        const playersData = await apiRequest('/players').catch(() => [])
        if (!active) return
        const list = Array.isArray(teamsData) ? teamsData : []
        setTeams(list)
        setPlayers(Array.isArray(playersData) ? playersData : [])
        setSelectedId((current) => current || list[0]?.id || null)
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTeams()
    return () => {
      active = false
    }
  }, [onLogout])

  const filteredTeams = useMemo(() => teams.filter((team) => `${team.name} ${team.city} ${team.id}`.toLowerCase().includes(query.toLowerCase())), [teams, query])
  const selected = teams.find((team) => sameId(team.id, selectedId)) || filteredTeams[0]
  const roster = players.filter((player) => sameId(player.team_id, selected?.id)).slice(0, 8)

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="teams" goTo={goTo} onLogout={onLogout} />
      <section className="teams-page">
        <StatusMessage type="error">{error}</StatusMessage>
        <aside className="team-rail">
          <span>Management</span>
          <button className="active" type="button">Teams</button>
          <button type="button" onClick={() => goTo('players')}>Players</button>
          <button type="button" onClick={() => goTo('matches')}>Matches</button>
        </aside>

        <section className="team-board">
          <div className="directory-title">
            <div>
              <h1>Teams</h1>
              <p>Manage registered franchises and clubs.</p>
            </div>
            {manager && <button type="button" disabled title="Create team endpoint is not available">+ Add Team</button>}
          </div>
          <div className="directory-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams" />
          </div>
          {loading && <p className="muted">Loading teams...</p>}
          <div className="team-grid">
            {filteredTeams.map((team) => (
              <button className={selected && sameId(selected.id, team.id) ? 'team-card selected' : 'team-card'} type="button" onClick={() => setSelectedId(team.id)} key={team.id}>
                <span className="team-avatar">{teamLabel(team).slice(0, 2).toUpperCase()}</span>
                <strong>{teamLabel(team)}</strong>
                <small>{team.city || 'Registered team'}</small>
                <em>ID {team.id}</em>
              </button>
            ))}
            {!loading && filteredTeams.length === 0 && <p className="muted">No teams found.</p>}
          </div>
        </section>

        <aside className="team-detail">
          {selected ? (
            <>
              <div className="team-detail-title">
                <span className="team-avatar">{teamLabel(selected).slice(0, 2).toUpperCase()}</span>
                <div>
                  <h2>{teamLabel(selected)}</h2>
                  <p>{selected.city || 'Registered team'}</p>
                </div>
              </div>
              <div className="team-metrics">
                <div><span>Roster</span><strong>{roster.length}</strong></div>
                <div><span>Status</span><strong>Active</strong></div>
              </div>
              <h3>Active Roster</h3>
              <div className="roster-list">
                {roster.map((player) => (
                  <span key={player.id}><b>{playerLabel(player)}</b><small>{player.role || 'Player'}</small></span>
                ))}
                {roster.length === 0 && <p className="muted">No linked players found.</p>}
              </div>
            </>
          ) : (
            <p className="muted">Select a team to view details.</p>
          )}
        </aside>
      </section>
    </main>
  )
}
