import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders } from '../lib/api.js'
import {
  emptyTournamentDetails,
  firstTournamentId,
  formatDate,
  findById,
  getResourceId,
  playerLabel,
  resolveSelectedId,
  sameId,
  teamLabel,
  tournamentStatus,
} from '../lib/helpers.js'

function CreateTournamentForm({ teams, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    team_ids: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleTeam(teamId) {
    setForm((current) => {
      const selected = current.team_ids.includes(teamId)
      return {
        ...current,
        team_ids: selected
          ? current.team_ids.filter((id) => id !== teamId)
          : [...current.team_ids, teamId],
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.name.trim() || !form.location.trim() || !form.start_date || !form.end_date) {
      setError('Tournament name, location, start date, and end date are required')
      return
    }

    setSubmitting(true)
    try {
      const selectedTeamIds = form.team_ids
      const created = await apiRequest('/tournaments', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim(),
          start_date: `${form.start_date}T00:00:00`,
          end_date: `${form.end_date}T00:00:00`,
          team_ids: selectedTeamIds,
        }),
      })
      const createdId = getResourceId(created)

      onCreated(createdId, {
        name: form.name.trim(),
        location: form.location.trim(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="tournament-form" onSubmit={handleSubmit}>
      <div className="form-title-row">
        <h2>Create Tournament</h2>
        <button type="button" onClick={onCancel}>×</button>
      </div>
      <StatusMessage type="error">{error}</StatusMessage>
      <div className="form-grid">
        <label className="profile-field">
          <span>Tournament name</span>
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Champions Trophy 2024" />
        </label>
        <label className="profile-field">
          <span>Location</span>
          <input value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="Dubai" />
        </label>
        <label className="profile-field">
          <span>Start date</span>
          <input type="date" value={form.start_date} onChange={(event) => updateField('start_date', event.target.value)} />
        </label>
        <label className="profile-field">
          <span>End date</span>
          <input type="date" value={form.end_date} onChange={(event) => updateField('end_date', event.target.value)} />
        </label>
      </div>
      <div className="profile-field">
        <span>Select teams</span>
        <div className="team-picker">
          {teams.map((team) => (
            <label className="team-option" key={team.id}>
              <input
                type="checkbox"
                checked={form.team_ids.includes(Number(team.id))}
                onChange={() => toggleTeam(Number(team.id))}
              />
              <span>
                <strong>{team.name || `Team ${team.id}`}</strong>
                <small>{team.city || `ID ${team.id}`}</small>
              </span>
            </label>
          ))}
          {teams.length === 0 && <p className="muted">No teams available to select.</p>}
        </div>
      </div>
      <button className="profile-submit" type="submit" disabled={submitting}>
        {submitting ? 'Creating tournament...' : 'Create tournament'}
      </button>
    </form>
  )
}

function teamLabelHelper(team) {
  return teamLabel(team)
}

function playerLabelHelper(player) {
  return playerLabel(player)
}

function TournamentActionForms({ selected, teams, registeredTeams = [], onChanged }) {
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [matchForm, setMatchForm] = useState({
    match_number: '',
    team1_id: '',
    team2_id: '',
    venue: '',
    total_overs: 20,
    status: 'scheduled',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState('')

  const registeredIds = useMemo(
    () => new Set(registeredTeams.map((team) => String(team.id))),
    [registeredTeams],
  )

  const teamsToAdd = useMemo(
    () => teams.filter((team) => !registeredIds.has(String(team.id))),
    [teams, registeredIds],
  )

  const matchTeams = registeredTeams.length ? registeredTeams : teams

  function toggleAddTeam(teamId) {
    setSelectedTeamIds((current) => {
      const normalizedId = Number(teamId)
      return current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    })
  }

  async function addTeams(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (selectedTeamIds.length === 0) {
      setError('Select at least one team')
      return
    }

    setSubmitting('teams')
    try {
      await apiRequest(`/tournaments/${selected.id}/teams`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ team_ids: selectedTeamIds }),
      })
      setSelectedTeamIds([])
      setMessage('Teams added to tournament')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting('')
    }
  }

  async function createMatch(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!matchForm.team1_id || !matchForm.team2_id) {
      setError('Select both teams')
      return
    }

    if (sameId(matchForm.team1_id, matchForm.team2_id)) {
      setError('Choose two different teams')
      return
    }

    setSubmitting('match')
    try {
      await apiRequest(`/api/tournament/${selected.id}/matches`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          match_number: Number(matchForm.match_number),
          match_data: {
            team1_id: Number(matchForm.team1_id),
            team2_id: Number(matchForm.team2_id),
            venue: matchForm.venue,
            total_overs: Number(matchForm.total_overs),
            team1_score: 0,
            team1_wickets: 0,
            team1_overs: 0,
            team2_score: 0,
            team2_wickets: 0,
            team2_overs: 0,
            status: matchForm.status,
          },
        }),
      })
      setMatchForm({ match_number: '', team1_id: '', team2_id: '', venue: '', total_overs: 20, status: 'scheduled' })
      setMessage('Match created')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting('')
    }
  }

  return (
    <div className="tournament-actions">
      <StatusMessage type="success">{message}</StatusMessage>
      <StatusMessage type="error">{error}</StatusMessage>
      <form onSubmit={addTeams}>
        <h3>Add Teams</h3>
        <div className="team-picker action-team-picker">
          {teamsToAdd.map((team) => (
            <label className="team-option" key={team.id}>
              <input
                type="checkbox"
                checked={selectedTeamIds.includes(Number(team.id))}
                onChange={() => toggleAddTeam(team.id)}
              />
              <span>
                <strong>{teamLabelHelper(team)}</strong>
                <small>{team.city || `ID ${team.id}`}</small>
              </span>
            </label>
          ))}
          {teamsToAdd.length === 0 && <p className="muted">All available teams are already added.</p>}
        </div>
        <button type="submit" disabled={submitting === 'teams'}>{submitting === 'teams' ? 'Adding...' : 'Add team'}</button>
      </form>
      <form onSubmit={createMatch}>
        <h3>Create Match</h3>
        <div className="action-grid">
          <input value={matchForm.match_number} onChange={(event) => setMatchForm((current) => ({ ...current, match_number: event.target.value }))} placeholder="Match no." />
          <select value={matchForm.team1_id} onChange={(event) => setMatchForm((current) => ({ ...current, team1_id: event.target.value }))}>
            <option value="">Team 1</option>
            {matchTeams.map((team) => <option value={team.id} key={team.id}>{teamLabelHelper(team)}</option>)}
          </select>
          <select value={matchForm.team2_id} onChange={(event) => setMatchForm((current) => ({ ...current, team2_id: event.target.value }))}>
            <option value="">Team 2</option>
            {matchTeams.map((team) => <option value={team.id} key={team.id}>{teamLabelHelper(team)}</option>)}
          </select>
          <input value={matchForm.venue} onChange={(event) => setMatchForm((current) => ({ ...current, venue: event.target.value }))} placeholder="Venue" />
          <input type="number" value={matchForm.total_overs} onChange={(event) => setMatchForm((current) => ({ ...current, total_overs: event.target.value }))} placeholder="Overs" />
          <select value={matchForm.status} onChange={(event) => setMatchForm((current) => ({ ...current, status: event.target.value }))}>
            <option>scheduled</option>
            <option>live</option>
            <option>completed</option>
          </select>
        </div>
        <button type="submit" disabled={submitting === 'match'}>{submitting === 'match' ? 'Creating...' : 'Create match'}</button>
      </form>
    </div>
  )
}

export function TournamentScreen({ user, goTo, onLogout }) {
  const [tournaments, setTournaments] = useState([])
  const [myTournaments, setMyTournaments] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [details, setDetails] = useState(emptyTournamentDetails)
  const [detailsTournamentId, setDetailsTournamentId] = useState(null)
  const [detailsTab, setDetailsTab] = useState('')
  const [tab, setTab] = useState('standings')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = tournaments.find((tournament) => sameId(tournament.id, selectedId)) || tournaments[0]
  const detailReady = Boolean(selected && sameId(detailsTournamentId, selected.id) && detailsTab === tab)
  const visibleDetails = detailReady ? details : emptyTournamentDetails()

  const filteredTournaments = useMemo(
    () => tournaments.filter((tournament) => `${tournament.name} ${tournament.location}`.toLowerCase().includes(query.toLowerCase())),
    [query, tournaments],
  )

  const isOwner = Boolean(selected && myTournaments.some((tournament) => sameId(tournament.id, selected.id)))
  const topBatsman = visibleDetails.batsmen[0]
  const topBowler = visibleDetails.bowlers[0]
  const topPoints = visibleDetails.leaderboard[0]?.points ?? visibleDetails.standings[0]?.points ?? 0
  const getTeamName = useCallback(
    (teamId, fallbackName) => fallbackName || teamLabelHelper(findById(allTeams, teamId) || { id: teamId }),
    [allTeams],
  )
  const getPlayerName = useCallback(
    (playerId) => playerLabelHelper(findById(visibleDetails.players, playerId) || { id: playerId }),
    [visibleDetails.players],
  )

  const fetchTournamentList = useCallback(async () => {
    try {
      const tournamentsData = await apiRequest('/tournaments')
      const list = Array.isArray(tournamentsData) ? tournamentsData : []

      if (list.length === 0) {
        return { tournaments: [], myTournaments: [], teams: [], error: '' }
      }

      const myData = await apiRequest('/tournaments/me/list', { headers: authHeaders() }).catch(() => [])
      const teamsData = await apiRequest('/teams/get').catch(() => [])

      return {
        tournaments: list,
        myTournaments: Array.isArray(myData) ? myData : [],
        teams: Array.isArray(teamsData) ? teamsData : [],
        error: '',
      }
    } catch (err) {
      if (err.status === 401) onLogout()
      return { tournaments: [], myTournaments: [], teams: [], error: err.message }
    }
  }, [onLogout])

  const fetchTournamentDetails = useCallback(async (tournamentId) => {
    const shouldLoadTeams = tab === 'teams'
    const shouldLoadStandings = tab === 'standings'
    const shouldLoadMatches = tab === 'matches'
    const teamsData = shouldLoadTeams
      ? await apiRequest(`/tournaments/${tournamentId}/teams`)
      : []
    const standingsData = shouldLoadStandings
      ? await apiRequest(`/api/tournament/${tournamentId}/standings`).catch(() => [])
      : []
    const matchesData = shouldLoadMatches
      ? await apiRequest(`/api/tournament/${tournamentId}/matches`).catch(() => [])
      : []
    const playersData = tab === 'rankings'
      ? await apiRequest('/players').catch(() => [])
      : []
    const batsmenData = tab === 'rankings'
      ? await apiRequest(`/api/tournament/${tournamentId}/rankings/batsmen`).catch(() => [])
      : []
    const bowlersData = tab === 'rankings'
      ? await apiRequest(`/api/tournament/${tournamentId}/rankings/bowlers`).catch(() => [])
      : []

    return {
      teams: Array.isArray(teamsData) ? teamsData : [],
      standings: Array.isArray(standingsData) ? standingsData : [],
      leaderboard: [],
      batsmen: Array.isArray(batsmenData) ? batsmenData : [],
      bowlers: Array.isArray(bowlersData) ? bowlersData : [],
      matches: Array.isArray(matchesData) ? matchesData : [],
      players: Array.isArray(playersData) ? playersData : [],
    }
  }, [tab])

  async function loadTournamentDetails(tournamentId) {
    setDetailLoading(true)
    const result = await fetchTournamentDetails(tournamentId)
    setDetails(result)
    setDetailsTournamentId(tournamentId)
    setDetailsTab(tab)
    setDetailLoading(false)
  }

  useEffect(() => {
    let active = true

    fetchTournamentList().then((result) => {
      if (!active) return
      setTournaments(result.tournaments)
      setMyTournaments(result.myTournaments)
      setAllTeams(result.teams)
      setSelectedId((current) => resolveSelectedId(current, result.tournaments))
      setError(result.error)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [fetchTournamentList])

  useEffect(() => {
    if (!selected?.id) {
      return undefined
    }

    let active = true

    fetchTournamentDetails(selected.id)
      .then((result) => {
        if (!active) return
        setDetails(result)
        setDetailsTournamentId(selected.id)
        setDetailsTab(tab)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setDetails(emptyTournamentDetails())
        setDetailsTournamentId(selected.id)
        setDetailsTab(tab)
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })

    return () => {
      active = false
    }
  }, [selected?.id, fetchTournamentDetails, tab])

  async function afterCreate(createdId, createdTournament = {}) {
    setShowCreate(false)
    setLoading(true)
    setError('')
    const result = await fetchTournamentList()
    const inferredTournament = result.tournaments.find((tournament) => (
      tournament.name === createdTournament.name &&
      tournament.location === createdTournament.location
    ))
    const targetId = createdId || inferredTournament?.id || firstTournamentId(result.tournaments)

    setTournaments(result.tournaments)
    setMyTournaments(result.myTournaments)
    setAllTeams(result.teams)
    setSelectedId(targetId)
    setError((current) => current || result.error)
    setLoading(false)
  }

  return (
    <main className="tournament-shell">
      <DashboardHeader user={user} active="tournaments" goTo={goTo} onLogout={onLogout} />
      <div className="tournament-layout">
        <aside className="tournament-sidebar">
          <label className="tournament-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments" />
          </label>
          <div className="tournament-list">
            {filteredTournaments.map((tournament) => (
              <article className={selected && sameId(selected.id, tournament.id) ? 'tournament-list-card selected' : 'tournament-list-card'} key={tournament.id}>
                <div>
                  <span className={`tournament-status ${tournamentStatus(tournament).toLowerCase()}`}>{tournamentStatus(tournament)}</span>
                  <small>{formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}</small>
                </div>
                <h2>{tournament.name}</h2>
                <p>⌖ {tournament.location}</p>
                <div>
                  <button type="button" onClick={() => setSelectedId(tournament.id)}>View</button>
                  <button type="button" onClick={() => { setSelectedId(tournament.id); setTab('teams') }}>Manage</button>
                </div>
              </article>
            ))}
            {!loading && filteredTournaments.length === 0 && <p className="muted">No tournaments found.</p>}
          </div>
        </aside>

        <section className="tournament-main">
          <div className="tournament-top-actions">
            <button type="button" onClick={() => setShowCreate((current) => !current)}>+ Create Tournament</button>
          </div>
          <StatusMessage type="error">{error}</StatusMessage>
          {showCreate && <CreateTournamentForm teams={allTeams} onCreated={afterCreate} onCancel={() => setShowCreate(false)} />}
          {loading && <p className="muted">Loading tournaments...</p>}
          {!loading && selected && (
            <>
              <article className="tournament-hero">
                <div>
                  <h1>{selected.name}</h1>
                  <p><span>▣</span> {formatDate(selected.start_date)} - {formatDate(selected.end_date)}</p>
                  <p><span>⌖</span> {selected.location}</p>
                </div>
                <button type="button" onClick={() => setTab('teams')}>Add Team</button>
                <button className="round-action" type="button" onClick={() => setTab('matches')}>⚙</button>
              </article>

              <div className="tournament-tabs">
                {['standings', 'rankings', 'matches', 'teams'].map((item) => (
                  <button className={tab === item ? 'active' : ''} type="button" key={item} onClick={() => setTab(item)}>
                    {item}
                  </button>
                ))}
              </div>

              <div className="tournament-summary">
                <div><span>Teams</span><strong>{visibleDetails.teams.length}</strong></div>
                <div><span>Matches</span><strong>{visibleDetails.matches.length}</strong></div>
                <div><span>Top points</span><strong>{topPoints}</strong></div>
                <div><span>Top runs</span><strong>{topBatsman?.runs ?? 0}</strong></div>
                <div><span>Top wickets</span><strong>{topBowler?.wickets ?? 0}</strong></div>
              </div>

              {(detailLoading || !detailReady) && <p className="muted">Refreshing tournament data...</p>}

              {tab === 'standings' && (
                <section className="tournament-panel">
                  <div className="panel-header">
                    <h2>Group Standings</h2>
                    <span>Updated now</span>
                  </div>
                  <div className="tournament-table standings-table">
                    <div className="tournament-table-head"><span>Pos</span><span>Team</span><span>P</span><span>W</span><span>L</span><span>NRR</span><span>Pts</span></div>
                    {(visibleDetails.leaderboard.length ? visibleDetails.leaderboard : visibleDetails.standings).map((row, index) => (
                      <div className="tournament-table-row" key={`${row.team_id}-${index}`}>
                        <span>{index + 1}</span>
                        <strong>{getTeamName(row.team_id, row.team_name)}</strong>
                        <span>{row.match_played ?? 0}</span>
                        <span>{row.wons ?? 0}</span>
                        <span>{row.losses ?? 0}</span>
                        <span className={(row.run_rate ?? 0) >= 0 ? 'positive' : 'negative'}>{row.run_rate ?? 0}</span>
                        <strong>{row.points ?? 0}</strong>
                      </div>
                    ))}
                    {!detailLoading && detailReady && visibleDetails.standings.length === 0 && visibleDetails.leaderboard.length === 0 && <p className="muted table-empty">No standings available.</p>}
                  </div>
                </section>
              )}

              {tab === 'rankings' && (
                <div className="rank-grid">
                  <section className="cap-card">
                    <h2>🏏 Orange Cap <a href="#all">View all</a></h2>
                    {(visibleDetails.batsmen.length ? visibleDetails.batsmen : [null]).slice(0, 5).map((row, index) => row ? (
                      <div className="cap-row" key={row.id}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{getPlayerName(row.player_id)}</strong>
                        <b>{row.runs} runs</b>
                      </div>
                    ) : <p className="muted" key="empty">No batsman rankings yet.</p>)}
                  </section>
                  <section className="cap-card">
                    <h2>● Purple Cap <a href="#all">View all</a></h2>
                    {(visibleDetails.bowlers.length ? visibleDetails.bowlers : [null]).slice(0, 5).map((row, index) => row ? (
                      <div className="cap-row" key={row.id}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{getPlayerName(row.player_id)}</strong>
                        <b>{row.wickets} wickets</b>
                      </div>
                    ) : <p className="muted" key="empty">No bowler rankings yet.</p>)}
                  </section>
                </div>
              )}

              {tab === 'matches' && (
                <section className="tournament-panel">
                  <div className="panel-header"><h2>Matches</h2><span>{visibleDetails.matches.length} total</span></div>
                  {isOwner && <TournamentActionForms selected={selected} teams={allTeams} registeredTeams={visibleDetails.teams} onChanged={() => loadTournamentDetails(selected.id)} />}
                  <div className="match-list">
                    {visibleDetails.matches.map((match) => (
                      <article key={match.id}>
                        <strong>Match {match.match_number}</strong>
                        <span>{getTeamName(match.match_details?.team1_id)} vs {getTeamName(match.match_details?.team2_id)}</span>
                        <small>{match.match_details?.venue} · {match.match_details?.status}</small>
                      </article>
                    ))}
                    {!detailLoading && detailReady && visibleDetails.matches.length === 0 && <p className="muted">No matches created yet.</p>}
                  </div>
                </section>
              )}

              {tab === 'teams' && (
                <section className="tournament-panel">
                  <div className="panel-header"><h2>Teams</h2><span>{visibleDetails.teams.length} registered</span></div>
                  {isOwner && <TournamentActionForms selected={selected} teams={allTeams} registeredTeams={visibleDetails.teams} onChanged={() => loadTournamentDetails(selected.id)} />}
                  <div className="team-list">
                    {visibleDetails.teams.map((team) => (
                      <article key={team.id}>
                        <strong>{teamLabel(team)}</strong>
                        <span>{team.city || 'Team registered'}</span>
                        <small>ID {team.id}</small>
                      </article>
                    ))}
                    {!detailLoading && detailReady && visibleDetails.teams.length === 0 && <p className="muted">No teams registered.</p>}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
      <footer className="tournament-footer">
        <span>© 2024 CRICSCORE. ALL RIGHTS RESERVED.</span>
        <nav><a href="#support">Support</a><a href="#privacy">Privacy Policy</a><a href="#terms">Terms of Service</a></nav>
      </footer>
    </main>
  )
}
