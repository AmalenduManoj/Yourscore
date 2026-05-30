import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders } from '../lib/api.js'
import {
  findById,
  matchDetails,
  matchStatus,
  matchTeamId,
  playerLabel,
  sameId,
  scoreValue,
  statValue,
  teamLabel,
} from '../lib/helpers.js'

function resolveMatchId(match) {
  return match?.match_id ?? match?.id ?? match?.match_details?.id
}

function resolveTournamentId(match) {
  const details = matchDetails(match)
  return match?.tournament_id ?? details?.tournament_id
}

function canManageTournamentMatch(match, ownedTournamentIds, tournamentId = '') {
  const resolvedTournamentId = tournamentId || resolveTournamentId(match)
  return Boolean(
    resolvedTournamentId && ownedTournamentIds.some((id) => sameId(id, resolvedTournamentId)),
  )
}

function buildMatchPayload(match, overrides = {}) {
  const base = matchDetails(match)
  const id = Number(resolveMatchId(match))
  return {
    id,
    tournament_id: base.tournament_id,
    team1_id: base.team1_id,
    team2_id: base.team2_id,
    venue: base.venue || '',
    total_overs: base.total_overs ?? 20,
    team1_score: overrides.team1_score ?? base.team1_score ?? 0,
    team1_wickets: overrides.team1_wickets ?? base.team1_wickets ?? 0,
    team1_overs: overrides.team1_overs ?? base.team1_overs ?? 0,
    team2_score: overrides.team2_score ?? base.team2_score ?? 0,
    team2_wickets: overrides.team2_wickets ?? base.team2_wickets ?? 0,
    team2_overs: overrides.team2_overs ?? base.team2_overs ?? 0,
    status: overrides.status ?? base.status ?? 'scheduled',
  }
}

async function updateMatchOnServer(match, overrides = {}) {
  const id = resolveMatchId(match)
  return apiRequest(`/matches/update/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(buildMatchPayload(match, overrides)),
  })
}

function lineupForTeam(lineup, teamId) {
  return lineup
    .filter((row) => sameId(row.team_id, teamId))
    .map((row) => Number(row.player_id))
}

function PlayingXISetup({ match, getTeamName, canManage, onChanged, setError, setMessage }) {
  const matchId = resolveMatchId(match)
  const team1Id = matchTeamId(match, 'team1_id')
  const team2Id = matchTeamId(match, 'team2_id')
  const [lineup, setLineup] = useState([])
  const [squad1, setSquad1] = useState([])
  const [squad2, setSquad2] = useState([])
  const [selected1, setSelected1] = useState([])
  const [selected2, setSelected2] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  const loadData = useCallback(async () => {
    if (!matchId || !team1Id || !team2Id) return
    setLoading(true)
    try {
      const lineupData = await apiRequest(`/api/matches/${matchId}/lineup`)
      const team1Squad = await apiRequest(`/team_players/${team1Id}`)
      const team2Squad = await apiRequest(`/team_players/${team2Id}`)
      const list = Array.isArray(lineupData) ? lineupData : []
      setLineup(list)
      setSquad1(Array.isArray(team1Squad) ? team1Squad : [])
      setSquad2(Array.isArray(team2Squad) ? team2Squad : [])
      setSelected1(lineupForTeam(list, team1Id))
      setSelected2(lineupForTeam(list, team2Id))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [matchId, team1Id, team2Id, setError])

  useEffect(() => {
    loadData()
  }, [loadData])

  function toggleSelection(teamKey, playerId) {
    const normalizedId = Number(playerId)
    const setter = teamKey === 1 ? setSelected1 : setSelected2
    setter((current) => (
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : current.length >= 11
          ? current
          : [...current, normalizedId]
    ))
  }

  async function saveTeamXI(teamKey) {
    const teamId = teamKey === 1 ? team1Id : team2Id
    const playerIds = teamKey === 1 ? selected1 : selected2
    if (playerIds.length !== 11) {
      setError(`${getTeamName(teamId)} must have exactly 11 players selected`)
      return
    }
    setSaving(`team${teamKey}`)
    setError('')
    try {
      await apiRequest(`/api/matches/${matchId}/lineup/${teamId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ player_ids: playerIds }),
      })
      setMessage(`Playing XI saved for ${getTeamName(teamId)}`)
      await loadData()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  if (!canManage || matchStatus(match) !== 'scheduled') return null

  function renderTeamPicker(teamKey, teamId, squad, selected) {
    return (
      <div className="playing-xi-team" key={teamKey}>
        <h3>{getTeamName(teamId)} ({selected.length}/11)</h3>
        <div className="team-picker action-team-picker">
          {squad.map((player) => (
            <label className="team-option" key={player.id}>
              <input
                type="checkbox"
                checked={selected.includes(Number(player.id))}
                onChange={() => toggleSelection(teamKey, player.id)}
              />
              <span>
                <strong>{playerLabel(player)}</strong>
                <small>{player.role || 'Player'}</small>
              </span>
            </label>
          ))}
          {squad.length === 0 && <p className="muted">No squad players. Add players to the team first.</p>}
        </div>
        <button type="button" disabled={saving === `team${teamKey}`} onClick={() => saveTeamXI(teamKey)}>
          {saving === `team${teamKey}` ? 'Saving...' : 'Save playing XI'}
        </button>
      </div>
    )
  }

  return (
    <article className="data-card detail-card playing-xi-card">
      <h2>Playing XI (before start)</h2>
      <p className="muted">Tournament creator must pick 11 players per team, then start the match.</p>
      {loading && <p className="muted">Loading squads...</p>}
      {!loading && (
        <div className="playing-xi-grid">
          {renderTeamPicker(1, team1Id, squad1, selected1)}
          {renderTeamPicker(2, team2Id, squad2, selected2)}
        </div>
      )}
      <p className="muted">
        Team 1 XI: {lineupForTeam(lineup, team1Id).length}/11 · Team 2 XI: {lineupForTeam(lineup, team2Id).length}/11
      </p>
    </article>
  )
}

function useMatchData(onLogout) {
  const [matches, setMatches] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMatches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const matchesData = await apiRequest('/matches')
      setMatches(Array.isArray(matchesData) ? matchesData : [])
      const liveData = await apiRequest('/matches/live').catch(() => [])
      setLiveMatches(Array.isArray(liveData) ? liveData : [])
      const teamsData = await apiRequest('/teams/get').catch(() => [])
      setTeams(Array.isArray(teamsData) ? teamsData : [])
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
      setLoading(true)
      setError('')
      try {
        const matchesData = await apiRequest('/matches')
        if (!active) return
        setMatches(Array.isArray(matchesData) ? matchesData : [])
        const liveData = await apiRequest('/matches/live').catch(() => [])
        if (!active) return
        setLiveMatches(Array.isArray(liveData) ? liveData : [])
        const teamsData = await apiRequest('/teams/get').catch(() => [])
        if (!active) return
        setTeams(Array.isArray(teamsData) ? teamsData : [])
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

  return { matches, liveMatches, teams, loading, error, setError, loadMatches }
}

function MatchTitle({ match, getTeamName }) {
  return (
    <>
      {getTeamName(matchTeamId(match, 'team1_id'))} vs {getTeamName(matchTeamId(match, 'team2_id'))}
    </>
  )
}

export function MatchListScreen({ user, goTo, onLogout }) {
  const { matches, liveMatches, teams, loading, error } = useMatchData(onLogout)
  const allMatches = useMemo(() => {
    const seen = new Set()
    return [...liveMatches, ...matches].filter((match) => {
      const id = String(resolveMatchId(match))
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [liveMatches, matches])

  const getTeamName = useCallback(
    (teamId) => teamLabel(findById(teams, teamId) || { id: teamId }),
    [teams],
  )

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="matches" goTo={goTo} onLogout={onLogout} />
      <section className="matches-page">
        <div className="directory-title">
          <div>
            <h1>Matches</h1>
            <p>Open a match to set playing XI, score ball-by-ball, and update standings.</p>
          </div>
        </div>
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <p className="muted">Loading matches...</p>}
        <div className="match-browser-grid">
          {allMatches.map((match) => (
            <article className="match-browser-card" key={`${resolveMatchId(match)}-${match.id}`}>
              <div className="match-meta">
                <span>{match.tournament_name || `Match ${match.match_number || resolveMatchId(match)}`}</span>
                <strong>{matchStatus(match)}</strong>
              </div>
              <h2><MatchTitle match={match} getTeamName={getTeamName} /></h2>
              <div className="completed-score">
                <span>{scoreValue(match, 'team1_score')}/{scoreValue(match, 'team1_wickets')}</span>
                <small>Team 1</small>
              </div>
              <p>{scoreValue(match, 'venue') || 'Venue TBA'}</p>
              <button type="button" onClick={() => goTo('score', { match: resolveMatchId(match), tournament: resolveTournamentId(match) || '' })}>Open score</button>
            </article>
          ))}
          {!loading && allMatches.length === 0 && <p className="muted">No matches found.</p>}
        </div>
      </section>
    </main>
  )
}

export function MatchScoringScreen({ user, goTo, onLogout }) {
  const { matches, liveMatches, teams, loading, error, setError, loadMatches } = useMatchData(onLogout)
  const params = new URLSearchParams(window.location.search)
  const initialMatchId = params.get('match')
  const tournamentId = params.get('tournament') || ''
  const [selectedId, setSelectedId] = useState(initialMatchId)
  const [ownedTournamentIds, setOwnedTournamentIds] = useState([])
  const [lineup, setLineup] = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [summary, setSummary] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [batterId, setBatterId] = useState('')
  const [bowlerId, setBowlerId] = useState('')
  const [innings2, setInnings2] = useState({ score: '', wickets: '', overs: '' })

  const allMatches = useMemo(() => {
    const seen = new Set()
    return [...liveMatches, ...matches].filter((match) => {
      const id = String(resolveMatchId(match))
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [liveMatches, matches])

  const selected = allMatches.find((match) => sameId(resolveMatchId(match), selectedId)) || allMatches[0]
  const progressMatchId = resolveMatchId(selected)
  const canManage = canManageTournamentMatch(selected, ownedTournamentIds, tournamentId)
  const status = matchStatus(selected)

  const getTeamName = useCallback(
    (teamId) => teamLabel(findById(teams, teamId) || { id: teamId }),
    [teams],
  )

  const lineupPlayerIds = useMemo(
    () => new Set(lineup.map((row) => Number(row.player_id))),
    [lineup],
  )

  const matchPlayers = useMemo(() => {
    if (!lineup.length) return []
    return lineup.map((row) => ({
      id: row.player_id,
      name: row.name,
      role: row.role,
    }))
  }, [lineup])

  const battersFromStats = useMemo(
    () => playerStats.filter((row) => row.balls_faced > 0).sort((a, b) => b.runs_scored - a.runs_scored),
    [playerStats],
  )

  const bowlersFromStats = useMemo(
    () => playerStats.filter((row) => row.balls_bowled > 0).sort((a, b) => b.wickets_taken - a.wickets_taken),
    [playerStats],
  )

  const activeBatters = matchPlayers.slice(0, 2)
  const activeBowlers = matchPlayers.filter((player) => /bowl/i.test(player.role || '')).slice(0, 3)
  const nextOver = deliveries.length ? Math.max(...deliveries.map((d) => d.over_number ?? 0)) : 0
  const ballsInOver = deliveries.filter((d) => d.over_number === nextOver).length
  const nextBall = ballsInOver >= 6 ? 1 : ballsInOver + 1
  const displayOver = ballsInOver >= 6 ? nextOver + 1 : nextOver

  const loadProgress = useCallback(async (matchId) => {
    if (!matchId) return
    try {
      const progressData = await apiRequest(`/api/progress/match/${matchId}`).catch(() => [])
      const summaryData = await apiRequest(`/api/progress/match/${matchId}/summary`).catch(() => null)
      const lineupData = await apiRequest(`/api/matches/${matchId}/lineup`).catch(() => [])
      const statsData = await apiRequest(`/api/matches/${matchId}/player-stats`).catch(() => [])
      setDeliveries(Array.isArray(progressData) ? progressData : [])
      setSummary(summaryData)
      setLineup(Array.isArray(lineupData) ? lineupData : [])
      setPlayerStats(Array.isArray(statsData) ? statsData : [])
    } catch (err) {
      setError(err.message)
    }
  }, [setError])

  useEffect(() => {
    let active = true

    async function loadOwnedTournaments() {
      const data = await apiRequest('/tournaments/me/list', { headers: authHeaders() }).catch(() => [])
      if (!active) return
      setOwnedTournamentIds((Array.isArray(data) ? data : []).map((tournament) => tournament.id))
    }

    loadOwnedTournaments()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function initialLoadProgress() {
      if (!progressMatchId) return
      if (active) await loadProgress(progressMatchId)
    }

    initialLoadProgress()
    return () => {
      active = false
    }
  }, [progressMatchId, loadProgress])

  const selectedBatterId = batterId || activeBatters[0]?.id || matchPlayers[0]?.id || ''
  const selectedBowlerId = bowlerId || activeBowlers[0]?.id || matchPlayers[0]?.id || ''

  async function refresh() {
    await loadMatches()
    await loadProgress(progressMatchId)
  }

  async function startMatch() {
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(`/api/matches/${progressMatchId}/start`, {
        method: 'POST',
        headers: authHeaders(),
      })
      setMessage('Match started — you can now record ball-by-ball progress')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function recordDelivery({ runs = 0, wicket = false, label = '' }) {
    if (!canManage || status !== 'live') return
    if (!lineupPlayerIds.has(Number(selectedBatterId)) || !lineupPlayerIds.has(Number(selectedBowlerId))) {
      setError('Batter and bowler must be in the playing XI')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/progress', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: 0,
          match_id: Number(progressMatchId),
          batter_id: Number(selectedBatterId),
          bowler_id: Number(selectedBowlerId),
          runs_scored: Number(runs),
          is_wicket: wicket,
          over_number: displayOver,
          ball_number: nextBall,
          commentary: label || (wicket ? 'Wicket' : `${runs} run${Number(runs) === 1 ? '' : 's'}`),
          created_at: new Date().toISOString(),
        }),
      })
      setMessage('Delivery recorded')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function completeMatch() {
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const body = {}
      if (innings2.score !== '') body.team2_score = Number(innings2.score)
      if (innings2.wickets !== '') body.team2_wickets = Number(innings2.wickets)
      if (innings2.overs !== '') body.team2_overs = Number(innings2.overs)

      await apiRequest(`/api/matches/${progressMatchId}/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      setMessage('Match completed. Standings and player stats updated.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function saveInnings1ToMatch() {
    setSubmitting(true)
    setError('')
    try {
      await updateMatchOnServer(selected, {
        team1_score: summary?.total_runs ?? scoreValue(selected, 'team1_score'),
        team1_wickets: summary?.total_wickets ?? scoreValue(selected, 'team1_wickets'),
        team1_overs: summary?.total_overs ?? scoreValue(selected, 'team1_overs'),
      })
      setMessage('Innings 1 score saved to match')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const xiReady = lineupForTeam(lineup, matchTeamId(selected, 'team1_id')).length === 11
    && lineupForTeam(lineup, matchTeamId(selected, 'team2_id')).length === 11

  return (
    <main className="dashboard-shell mobile-score-shell">
      <DashboardHeader user={user} active="score" goTo={goTo} onLogout={onLogout} />
      <section className="score-page">
        <StatusMessage type="error">{error}</StatusMessage>
        <StatusMessage type="success">{message}</StatusMessage>
        {loading && <p className="muted">Loading match...</p>}
        {!loading && selected && (
          <>
            <article className="score-hero">
              <div>
                <span className="live-chip">{status === 'live' ? 'Live match' : status}</span>
                <h1><MatchTitle match={selected} getTeamName={getTeamName} /></h1>
                <p>{scoreValue(selected, 'venue') || 'Venue TBA'}</p>
              </div>
              <div className="score-total">
                <strong>
                  {summary?.total_runs ?? scoreValue(selected, 'team1_score')}/
                  {summary?.total_wickets ?? scoreValue(selected, 'team1_wickets')}
                </strong>
                <span>({summary?.total_overs ?? scoreValue(selected, 'team1_overs')} Ov · Innings 1)</span>
              </div>
              <div className="score-total">
                <strong>{scoreValue(selected, 'team2_score')}/{scoreValue(selected, 'team2_wickets')}</strong>
                <span>({scoreValue(selected, 'team2_overs')} Ov · Innings 2)</span>
              </div>
            </article>

            <PlayingXISetup
              match={selected}
              getTeamName={getTeamName}
              canManage={canManage}
              onChanged={refresh}
              setError={setError}
              setMessage={setMessage}
            />

            {canManage && status === 'scheduled' && (
              <article className="data-card detail-card">
                <h2>Start match</h2>
                <p className="muted">
                  {xiReady
                    ? 'Both teams have a playing XI. Start the match to enable scoring.'
                    : 'Save playing XI for both teams (11 players each) before starting.'}
                </p>
                <button className="profile-submit" type="button" disabled={submitting || !xiReady} onClick={startMatch}>
                  {submitting ? 'Starting...' : 'Start match'}
                </button>
              </article>
            )}

            {canManage && status === 'live' && (
              <>
                <div className="score-player-selectors">
                  <label>
                    <span>Batter (playing XI)</span>
                    <select value={selectedBatterId} onChange={(event) => setBatterId(event.target.value)}>
                      {matchPlayers.map((player) => <option value={player.id} key={player.id}>{playerLabel(player)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Bowler (playing XI)</span>
                    <select value={selectedBowlerId} onChange={(event) => setBowlerId(event.target.value)}>
                      {matchPlayers.map((player) => <option value={player.id} key={player.id}>{playerLabel(player)}</option>)}
                    </select>
                  </label>
                </div>

                <div className="match-workspace">
                  <section className="score-main">
                    <article className="score-panel">
                      <h2>Last Balls</h2>
                      <div className="ball-strip">
                        {(deliveries.length ? deliveries.slice(-12) : [{ runs_scored: 0, id: 'empty' }]).map((delivery, index) => {
                          const label = delivery.is_wicket ? 'W' : String(delivery.runs_scored ?? 0)
                          return <span className={delivery.is_wicket ? 'wicket' : Number(delivery.runs_scored) >= 4 ? 'boundary' : ''} key={`${delivery.id}-${index}`}>{label}</span>
                        })}
                      </div>
                    </article>

                    <article className="score-panel">
                      <div className="panel-header slim">
                        <h2>Scoring controls</h2>
                        <div className="score-actions-inline">
                          <button type="button" onClick={saveInnings1ToMatch} disabled={submitting}>Save innings 1</button>
                        </div>
                      </div>
                      <div className="scoring-grid">
                        {[0, 1, 2, 3, 4, 6].map((run) => (
                          <button className={run >= 4 ? 'primary-score' : ''} type="button" onClick={() => recordDelivery({ runs: run })} disabled={submitting} key={run}>{run}</button>
                        ))}
                        <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'Wide' })} disabled={submitting}>Wide</button>
                        <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'No ball' })} disabled={submitting}>No ball</button>
                        <button type="button" onClick={() => recordDelivery({ wicket: true })} disabled={submitting}>Wicket</button>
                      </div>
                    </article>

                    <article className="score-panel">
                      <h2>Complete match</h2>
                      <p className="muted">Enter innings 2 totals, then complete to update standings and rankings.</p>
                      <div className="action-grid">
                        <input value={innings2.score} onChange={(e) => setInnings2((c) => ({ ...c, score: e.target.value }))} placeholder="Team 2 runs" />
                        <input value={innings2.wickets} onChange={(e) => setInnings2((c) => ({ ...c, wickets: e.target.value }))} placeholder="Team 2 wickets" />
                        <input value={innings2.overs} onChange={(e) => setInnings2((c) => ({ ...c, overs: e.target.value }))} placeholder="Team 2 overs" />
                      </div>
                      <button className="profile-submit" type="button" onClick={completeMatch} disabled={submitting}>
                        {submitting ? 'Completing...' : 'Complete match & update standings'}
                      </button>
                    </article>
                  </section>
                </div>
              </>
            )}

            {!canManage && (
              <p className="muted">Only the tournament creator can manage this match.</p>
            )}

            <div className="score-tables">
              <article className="data-card">
                <h2>Batting (this match)</h2>
                {battersFromStats.map((player) => (
                  <div className="stat-row" key={player.player_id}>
                    <strong>{player.name}</strong>
                    <span>{statValue(player.runs_scored)}</span>
                    <span>{statValue(player.balls_faced)}</span>
                    <span>{player.is_out ? 'out' : 'not out'}</span>
                  </div>
                ))}
                {battersFromStats.length === 0 && <p className="muted">No batting stats yet.</p>}
              </article>
              <article className="data-card">
                <h2>Bowling (this match)</h2>
                {bowlersFromStats.map((player) => (
                  <div className="stat-row" key={player.player_id}>
                    <strong>{player.name}</strong>
                    <span>{statValue(player.balls_bowled)}</span>
                    <span>{statValue(player.runs_conceded)}</span>
                    <span>{statValue(player.wickets_taken)}</span>
                  </div>
                ))}
                {bowlersFromStats.length === 0 && <p className="muted">No bowling stats yet.</p>}
              </article>
            </div>

            <aside className="score-side">
              <article className="data-card">
                <h2>Matches</h2>
                {allMatches.slice(0, 8).map((match) => (
                  <button
                    className={selected && sameId(resolveMatchId(selected), resolveMatchId(match)) ? 'data-row active' : 'data-row'}
                    type="button"
                    onClick={() => {
                      setSelectedId(resolveMatchId(match))
                      goTo('score', { match: resolveMatchId(match), tournament: resolveTournamentId(match) || tournamentId })
                    }}
                    key={`match-${resolveMatchId(match)}`}
                  >
                    <strong><MatchTitle match={match} getTeamName={getTeamName} /></strong>
                    <span>{matchStatus(match)}</span>
                  </button>
                ))}
              </article>
            </aside>
          </>
        )}
      </section>
    </main>
  )
}

export const MatchesScreen = MatchListScreen
