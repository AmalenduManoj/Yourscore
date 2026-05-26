import { useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders } from '../lib/api.js'
import { playerBelongsToTeam, playerLabel, sameId, teamLabel } from '../lib/helpers.js'

function resolveUserId(user) {
  return user?.id ?? user?.user_id ?? user?.userId ?? user?.sub
}

function isTeamOwner(user, team) {
  const userId = resolveUserId(user)
  const ownerId = team?.created_by_user_id ?? team?.created_by ?? team?.created_by_id ?? team?.owner_id ?? team?.user_id
  return Boolean(userId && ownerId && sameId(userId, ownerId))
}

async function saveTeamRequest(team, payload) {
  const options = {
    method: team ? 'PUT' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  }
  const endpoints = team
    ? [`/teams/update/${team.id}`, `/teams/${team.id}`, `/api/teams/${team.id}`]
    : ['/teams', '/teams/create', '/api/teams']
  let lastError = null

  for (const endpoint of endpoints) {
    try {
      return await apiRequest(endpoint, options)
    } catch (err) {
      lastError = err
      if (err.status && err.status !== 404) throw err
    }
  }

  throw lastError || new Error('Team endpoint is not available.')
}

function TeamForm({ team, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: team?.name || '',
    city: team?.city || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Team name is required')
      return
    }

    setSubmitting(true)
    try {
      await saveTeamRequest(team, {
        name: form.name.trim(),
        city: form.city.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="team-form" onSubmit={handleSubmit}>
      <div className="form-title-row">
        <h2>{team ? 'Edit Team' : 'Create Team'}</h2>
        <button type="button" onClick={onCancel}>×</button>
      </div>
      <StatusMessage type="error">{error}</StatusMessage>
      <div className="form-grid">
        <label className="profile-field">
          <span>Team name</span>
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Chennai Kings" />
        </label>
        <label className="profile-field">
          <span>City</span>
          <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Chennai" />
        </label>
      </div>
      <button className="profile-submit" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save team'}</button>
    </form>
  )
}

export function TeamsScreen({ user, goTo, onLogout }) {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canCreateTeam = Boolean(user)

  async function loadTeams() {
    setLoading(true)
    setError('')
    try {
      const teamsData = await apiRequest('/teams/get')
      const playersData = await apiRequest('/players').catch(() => [])
      const list = Array.isArray(teamsData) ? teamsData : []
      setTeams(list)
      setPlayers(Array.isArray(playersData) ? playersData : [])
      setSelectedId((current) => current || list[0]?.id || null)
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function initialLoad() {
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

    initialLoad()
    return () => {
      active = false
    }
  }, [onLogout])

  const filteredTeams = useMemo(() => teams.filter((team) => `${team.name} ${team.city} ${team.id}`.toLowerCase().includes(query.toLowerCase())), [teams, query])
  const selected = teams.find((team) => sameId(team.id, selectedId)) || filteredTeams[0]
  const linkedRoster = players.filter((player) => playerBelongsToTeam(player, selected))
  const roster = linkedRoster.length ? linkedRoster : players

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
            {canCreateTeam && <button type="button" onClick={() => { setEditingTeam(null); setShowCreate((current) => !current) }}>+ Add Team</button>}
          </div>
          {showCreate && <TeamForm onSaved={() => { setShowCreate(false); loadTeams() }} onCancel={() => setShowCreate(false)} />}
          {editingTeam && <TeamForm team={editingTeam} onSaved={() => { setEditingTeam(null); loadTeams() }} onCancel={() => setEditingTeam(null)} />}
          <div className="directory-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams" />
          </div>
          {loading && <p className="muted">Loading teams...</p>}
          <div className="team-grid">
            {filteredTeams.map((team) => (
              <button className={selected && sameId(selected.id, team.id) ? 'team-card selected' : 'team-card'} type="button" onClick={() => { setSelectedId(team.id); goTo('team', { id: team.id }) }} key={team.id}>
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
              {isTeamOwner(user, selected) && <button className="edit-profile-btn team-edit-btn" type="button" onClick={() => { setShowCreate(false); setEditingTeam(selected) }}>Edit team</button>}
              <h3>Active Roster</h3>
              <div className="roster-list">
                {roster.map((player) => (
                  <button className="roster-player" type="button" onClick={() => goTo('player', { id: player.id })} key={player.id}><b>{playerLabel(player)}</b><small>{player.role || 'Player'}</small></button>
                ))}
                {linkedRoster.length === 0 && roster.length > 0 && <p className="muted">No team link found, showing available players.</p>}
                {roster.length === 0 && <p className="muted">No players found.</p>}
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

export function TeamDetailScreen({ user, goTo, onLogout }) {
  const [team, setTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const teamId = new URLSearchParams(window.location.search).get('id')

  async function loadTeamDetails() {
    setLoading(true)
    setError('')
    try {
      const teamsData = await apiRequest('/teams/get')
      const playersData = await apiRequest('/players').catch(() => [])
      const list = Array.isArray(teamsData) ? teamsData : []
      setTeam(list.find((item) => sameId(item.id, teamId)) || null)
      setPlayers(Array.isArray(playersData) ? playersData : [])
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadTeam() {
      setLoading(true)
      setError('')
      try {
        const teamsData = await apiRequest('/teams/get')
        const playersData = await apiRequest('/players').catch(() => [])
        if (!active) return
        const list = Array.isArray(teamsData) ? teamsData : []
        setTeam(list.find((item) => sameId(item.id, teamId)) || null)
        setPlayers(Array.isArray(playersData) ? playersData : [])
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTeam()
    return () => {
      active = false
    }
  }, [onLogout, teamId])

  const linkedRoster = players.filter((player) => playerBelongsToTeam(player, team))
  const roster = linkedRoster.length ? linkedRoster : players

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="team" goTo={goTo} onLogout={onLogout} />
      <section className="detail-page">
        <button className="profile-back" type="button" onClick={() => goTo('teams')}>← Back to teams</button>
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <p className="muted">Loading team...</p>}
        {!loading && team && (
          <>
            {editing && (
              <TeamForm
                team={team}
                onSaved={() => {
                  setEditing(false)
                  loadTeamDetails()
                }}
                onCancel={() => setEditing(false)}
              />
            )}
            <article className="team-detail detail-card">
              <div className="team-detail-title">
                <span className="team-avatar">{teamLabel(team).slice(0, 2).toUpperCase()}</span>
                <div>
                  <h2>{teamLabel(team)}</h2>
                  <p>{team.city || 'Registered team'}</p>
                </div>
              </div>
              <div className="team-metrics">
                <div><span>Roster</span><strong>{roster.length}</strong></div>
                <div><span>Status</span><strong>Active</strong></div>
                <div><span>Team ID</span><strong>{team.id}</strong></div>
              </div>
              {isTeamOwner(user, team) && <button className="edit-profile-btn team-edit-btn" type="button" onClick={() => setEditing(true)}>Edit team</button>}
            </article>

            <article className="data-card detail-card">
              <h2>Players</h2>
              <div className="roster-list">
                {roster.map((player) => (
                  <button className="roster-player" type="button" onClick={() => goTo('player', { id: player.id })} key={player.id}>
                    <b>{playerLabel(player)}</b>
                    <small>{player.role || 'Player'}</small>
                  </button>
                ))}
                {linkedRoster.length === 0 && roster.length > 0 && <p className="muted">No team link found, showing available players.</p>}
                {roster.length === 0 && <p className="muted">No players found.</p>}
              </div>
            </article>
          </>
        )}
        {!loading && !team && <p className="muted">Team not found.</p>}
      </section>
    </main>
  )
}
