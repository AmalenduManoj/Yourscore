import { useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders } from '../lib/api.js'
import { getStoredUser, playerLabel, sameId, teamLabel } from '../lib/helpers.js'

function resolveUserId(user) {
  const candidates = [user?.db_id, user?.numeric_id, user?.id, user?.user_id, user?.userId]

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isInteger(value)) return value
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  }

  return null
}

function isTeamOwner(user, team) {
  const userId = resolveUserId(user)
  return Boolean(userId && team?.created_by_user_id && sameId(userId, team.created_by_user_id))
}

function normalizePlayersList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.team_players)) return data.team_players
  if (Array.isArray(data?.roster)) return data.roster
  if (Array.isArray(data?.players)) return data.players
  return []
}

async function fetchTeamsList() {
  const data = await apiRequest('/teams/get')
  return Array.isArray(data) ? data : []
}

async function fetchTeamById(teamId) {
  if (!teamId) return null
  return apiRequest(`/teams/${teamId}`)
}

async function fetchTeamRoster(teamId) {
  if (!teamId) return []
  const data = await apiRequest(`/team_players/${teamId}`)
  return normalizePlayersList(data)
}

async function fetchAllPlayers() {
  const data = await apiRequest('/players')
  return Array.isArray(data) ? data : []
}

async function createTeamOnServer({ name, city, createdByUserId }) {
  return apiRequest('/teams', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      city,
      created_by_user_id: createdByUserId,
      player_ids: [],
    }),
  })
}

async function updateTeamOnServer(teamId, { name, city }) {
  return apiRequest(`/teams/${teamId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name, city }),
  })
}

async function addPlayerToTeamOnServer(teamId, playerId) {
  return apiRequest('/team_players', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      team_id: Number(teamId),
      player_id: Number(playerId),
    }),
  })
}

async function removePlayerFromTeamOnServer(teamId, playerId) {
  return apiRequest('/team_players', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({
      team_id: Number(teamId),
      player_id: Number(playerId),
    }),
  })
}

function TeamCard({ team, selected, onSelect }) {
  return (
    <button className={selected ? 'team-card selected' : 'team-card'} type="button" onClick={onSelect}>
      <span className="team-avatar">{teamLabel(team).slice(0, 2).toUpperCase()}</span>
      <strong>{teamLabel(team)}</strong>
      <small>{team.city || 'Registered team'}</small>
      <em>ID {team.id}</em>
    </button>
  )
}

function TeamRosterList({
  roster,
  onPlayerClick,
  canRemove = false,
  removingId = null,
  onRemove,
  emptyMessage = 'No players in this team.',
}) {
  return (
    <div className="roster-list">
      {roster.map((player) => (
        <div className="roster-row" key={player.id}>
          <button className="roster-player" type="button" onClick={() => onPlayerClick(player)}>
            <b>{playerLabel(player)}</b>
            <small>{player.role || 'Player'}</small>
          </button>
          {canRemove && (
            <button
              className="roster-remove-btn"
              type="button"
              disabled={removingId === player.id}
              onClick={() => onRemove(player)}
            >
              {removingId === player.id ? 'Removing...' : 'Remove'}
            </button>
          )}
        </div>
      ))}
      {roster.length === 0 && <p className="muted">{emptyMessage}</p>}
    </div>
  )
}

function TeamForm({ team, currentUserId, onSaved, onCancel }) {
  const isEdit = Boolean(team)
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
      if (isEdit) {
        await updateTeamOnServer(team.id, {
          name: form.name.trim(),
          city: form.city.trim(),
        })
      } else {
        const creatorId = currentUserId ?? resolveUserId(getStoredUser())
        if (!creatorId) {
          setError('Unable to determine the current user. Please sign in again.')
          setSubmitting(false)
          return
        }
        await createTeamOnServer({
          name: form.name.trim(),
          city: form.city.trim(),
          createdByUserId: creatorId,
        })
      }
      onSaved()
    } catch (err) {
      if (err.status === 401) {
        setError('Please sign in again to save this team.')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="team-form" onSubmit={handleSubmit}>
      <div className="form-title-row">
        <h2>{isEdit ? 'Edit Team' : 'Create Team'}</h2>
        <button type="button" onClick={onCancel}>×</button>
      </div>
      <StatusMessage type="error">{error}</StatusMessage>
      <div className="form-grid">
        <label className="profile-field">
          <span>Team name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Chennai Kings"
          />
        </label>
        <label className="profile-field">
          <span>City</span>
          <input
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="Chennai"
          />
        </label>
      </div>
      <button className="profile-submit" type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Save team'}
      </button>
    </form>
  )
}

function TeamOwnerPanel({ team, user, roster, onTeamUpdated, onRosterUpdated, onLogout, onPlayerClick }) {
  const [editing, setEditing] = useState(false)
  const [addingPlayers, setAddingPlayers] = useState(false)
  const [allPlayers, setAllPlayers] = useState([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = isTeamOwner(user, team)
  const availablePlayers = allPlayers.filter(
    (player) => !roster.some((teamPlayer) => sameId(teamPlayer.id, player.id)),
  )

  useEffect(() => {
    if (!addingPlayers) return undefined

    let active = true

    async function loadPlayers() {
      setPlayersLoading(true)
      setError('')
      try {
        const list = await fetchAllPlayers()
        if (active) setAllPlayers(list)
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setPlayersLoading(false)
      }
    }

    loadPlayers()
    return () => {
      active = false
    }
  }, [addingPlayers, onLogout])

  function togglePlayerSelection(playerId) {
    const normalizedId = Number(playerId)
    setSelectedPlayerIds((current) => (
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    ))
  }

  async function handleAddPlayers(event) {
    event.preventDefault()
    if (selectedPlayerIds.length === 0) {
      setError('Select at least one player')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')
    try {
      for (const playerId of selectedPlayerIds) {
        await addPlayerToTeamOnServer(team.id, playerId)
      }
      setSelectedPlayerIds([])
      setAddingPlayers(false)
      setSuccess('Players added to the team.')
      await onRosterUpdated()
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemovePlayer(player) {
    if (!window.confirm(`Remove ${playerLabel(player)} from this team?`)) return

    setRemovingId(player.id)
    setError('')
    setSuccess('')
    try {
      await removePlayerFromTeamOnServer(team.id, player.id)
      setSuccess(`${playerLabel(player)} removed from the team.`)
      await onRosterUpdated()
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  if (!canManage) return null

  return (
    <div className="team-owner-panel">
      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{success}</StatusMessage>
      <div className="team-actions">
        <button type="button" onClick={() => { setAddingPlayers(false); setEditing((current) => !current) }}>
          {editing ? 'Close edit' : 'Edit team'}
        </button>
        <button type="button" onClick={() => { setEditing(false); setAddingPlayers((current) => !current) }}>
          {addingPlayers ? 'Close add players' : 'Add player'}
        </button>
      </div>
      {editing && (
        <TeamForm
          team={team}
          onSaved={async () => {
            setEditing(false)
            setSuccess('Team updated.')
            await onTeamUpdated()
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      {addingPlayers && (
        <article className="data-card team-add-card">
          <form onSubmit={handleAddPlayers}>
            <h3>Add players to team</h3>
            {playersLoading && <p className="muted">Loading players...</p>}
            <div className="team-picker action-team-picker">
              {availablePlayers.map((player) => (
                <label className="team-option" key={player.id}>
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.includes(Number(player.id))}
                    onChange={() => togglePlayerSelection(player.id)}
                  />
                  <span>
                    <strong>{playerLabel(player)}</strong>
                    <small>{player.role || 'Player'}</small>
                  </span>
                </label>
              ))}
              {!playersLoading && availablePlayers.length === 0 && (
                <p className="muted">No more players available to add.</p>
              )}
            </div>
            <button className="profile-submit" type="submit" disabled={busy}>
              {busy ? 'Adding players...' : 'Add selected players'}
            </button>
          </form>
        </article>
      )}
      <TeamRosterList
        roster={roster}
        canRemove
        removingId={removingId}
        onRemove={handleRemovePlayer}
        onPlayerClick={onPlayerClick}
      />
    </div>
  )
}

function TeamRosterSection({ roster, rosterLoading, canManage, team, user, onTeamUpdated, onRosterUpdated, onLogout, onPlayerClick }) {
  if (canManage) {
    return (
      <>
        <h3>Active Roster</h3>
        {rosterLoading ? (
          <p className="muted">Loading roster...</p>
        ) : (
          <TeamOwnerPanel
            team={team}
            user={user}
            roster={roster}
            onTeamUpdated={onTeamUpdated}
            onRosterUpdated={onRosterUpdated}
            onLogout={onLogout}
            onPlayerClick={onPlayerClick}
          />
        )}
      </>
    )
  }

  return (
    <>
      <h3>Active Roster</h3>
      {rosterLoading ? (
        <p className="muted">Loading roster...</p>
      ) : (
        <TeamRosterList roster={roster} onPlayerClick={onPlayerClick} />
      )}
    </>
  )
}

export function TeamsScreen({ user, goTo, onLogout }) {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [error, setError] = useState('')
  const canCreateTeam = Boolean(user && getStoredUser())

  async function loadTeams() {
    setLoading(true)
    setError('')
    try {
      const list = await fetchTeamsList()
      setTeams(list)
      setSelectedId((current) => current || list[0]?.id || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function reloadRoster(teamId) {
    if (!teamId) {
      setPlayers([])
      return
    }
    setRosterLoading(true)
    try {
      const roster = await fetchTeamRoster(teamId)
      setPlayers(roster)
    } catch (err) {
      setPlayers([])
      setError(err.message)
    } finally {
      setRosterLoading(false)
    }
  }

  async function reloadSelectedTeam() {
    if (!selectedId) return
    try {
      const updated = await fetchTeamById(selectedId)
      setTeams((current) => current.map((item) => (sameId(item.id, selectedId) ? updated : item)))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let active = true

    async function initialLoad() {
      setLoading(true)
      setError('')
      try {
        const list = await fetchTeamsList()
        if (!active) return
        setTeams(list)
        setSelectedId((current) => current || list[0]?.id || null)
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialLoad()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadRoster(teamId) {
      if (!teamId) {
        setPlayers([])
        return
      }

      setRosterLoading(true)
      try {
        const roster = await fetchTeamRoster(teamId)
        if (active) setPlayers(roster)
      } catch (err) {
        if (active) {
          setPlayers([])
          setError(err.message)
        }
      } finally {
        if (active) setRosterLoading(false)
      }
    }

    loadRoster(selectedId)
    return () => {
      active = false
    }
  }, [selectedId])

  const filteredTeams = useMemo(
    () => teams.filter((team) => `${team.name} ${team.city || ''} ${team.id}`.toLowerCase().includes(query.toLowerCase())),
    [teams, query],
  )
  const selected = teams.find((team) => sameId(team.id, selectedId)) || filteredTeams[0]
  const canManageSelected = Boolean(selected && isTeamOwner(user, selected))

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
            {canCreateTeam && (
              <button type="button" onClick={() => setShowCreate((current) => !current)}>+ Add Team</button>
            )}
          </div>
          {showCreate && (
            <TeamForm
              currentUserId={resolveUserId(user)}
              onSaved={() => {
                setShowCreate(false)
                loadTeams()
              }}
              onCancel={() => setShowCreate(false)}
            />
          )}
          <div className="directory-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams" />
          </div>
          {loading && <p className="muted">Loading teams...</p>}
          <div className="team-grid">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                selected={selected && sameId(selected.id, team.id)}
                onSelect={() => {
                  setSelectedId(team.id)
                  goTo('team', { id: team.id })
                }}
              />
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
                <div><span>Roster</span><strong>{players.length}</strong></div>
                <div><span>Status</span><strong>Active</strong></div>
              </div>
              {canManageSelected ? (
                <TeamRosterSection
                  roster={players}
                  rosterLoading={rosterLoading}
                  canManage
                  team={selected}
                  user={user}
                  onTeamUpdated={reloadSelectedTeam}
                  onRosterUpdated={() => reloadRoster(selected.id)}
                  onLogout={onLogout}
                  onPlayerClick={(player) => goTo('player', { id: player.id })}
                />
              ) : (
                <>
                  <h3>Active Roster</h3>
                  {rosterLoading ? (
                    <p className="muted">Loading roster...</p>
                  ) : (
                    <TeamRosterList roster={players} onPlayerClick={(player) => goTo('player', { id: player.id })} />
                  )}
                </>
              )}
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const teamId = new URLSearchParams(window.location.search).get('id')

  async function loadTeamDetails() {
    if (!teamId) {
      setTeam(null)
      setPlayers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const found = await fetchTeamById(teamId)
      setTeam(found)
      const roster = await fetchTeamRoster(teamId)
      setPlayers(roster)
    } catch (err) {
      if (err.status === 401) onLogout()
      setError(err.message)
      setTeam(null)
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  async function reloadTeam() {
    if (!teamId) return
    try {
      const updated = await fetchTeamById(teamId)
      setTeam(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  async function reloadRoster() {
    if (!teamId) return
    try {
      const roster = await fetchTeamRoster(teamId)
      setPlayers(roster)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let active = true

    async function loadTeam() {
      if (!teamId) {
        if (active) {
          setTeam(null)
          setPlayers([])
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')
      try {
        const found = await fetchTeamById(teamId)
        if (!active) return
        setTeam(found)
        const roster = await fetchTeamRoster(teamId)
        if (!active) return
        setPlayers(roster)
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) {
          setError(err.message)
          setTeam(null)
          setPlayers([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTeam()
    return () => {
      active = false
    }
  }, [onLogout, teamId])

  const canManage = Boolean(team && isTeamOwner(user, team))

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="team" goTo={goTo} onLogout={onLogout} />
      <section className="detail-page">
        <button className="profile-back" type="button" onClick={() => goTo('teams')}>← Back to teams</button>
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <p className="muted">Loading team...</p>}
        {!loading && team && (
          <>
            <article className="team-detail detail-card">
              <div className="team-detail-title">
                <span className="team-avatar">{teamLabel(team).slice(0, 2).toUpperCase()}</span>
                <div>
                  <h2>{teamLabel(team)}</h2>
                  <p>{team.city || 'Registered team'}</p>
                </div>
              </div>
              <div className="team-metrics">
                <div><span>Roster</span><strong>{players.length}</strong></div>
                <div><span>Status</span><strong>Active</strong></div>
                <div><span>Team ID</span><strong>{team.id}</strong></div>
              </div>
            </article>

            <article className="data-card detail-card">
              {canManage ? (
                <>
                  <h2>Manage team</h2>
                  <TeamOwnerPanel
                    team={team}
                    user={user}
                    roster={players}
                    onTeamUpdated={reloadTeam}
                    onRosterUpdated={reloadRoster}
                    onLogout={onLogout}
                    onPlayerClick={(player) => goTo('player', { id: player.id })}
                  />
                </>
              ) : (
                <>
                  <h2>Players</h2>
                  <TeamRosterList roster={players} onPlayerClick={(player) => goTo('player', { id: player.id })} />
                </>
              )}
            </article>
          </>
        )}
        {!loading && !team && <p className="muted">Team not found.</p>}
      </section>
    </main>
  )
}
