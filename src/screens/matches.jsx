import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders } from '../lib/api.js'
import { findById, matchDetails, matchStatus, matchTeamId, playerBelongsToTeam, playerLabel, sameId, scoreValue, statValue, teamLabel } from '../lib/helpers.js'

function resolveMatchId(match) {
  return match?.match_id ?? match?.id ?? match?.tournament_match_id
}

function resolveUserId(user) {
  return user?.id ?? user?.user_id ?? user?.userId ?? user?.sub
}

function resolveMatchCreatorId(match) {
  const details = matchDetails(match)
  return (
    match?.created_by_user_id ??
    match?.created_by ??
    match?.created_by_id ??
    match?.creator_id ??
    match?.owner_id ??
    match?.user_id ??
    details?.created_by_user_id ??
    details?.created_by ??
    details?.created_by_id ??
    details?.creator_id ??
    details?.owner_id ??
    details?.user_id
  )
}

function resolveTournamentId(match) {
  const details = matchDetails(match)
  return match?.tournament_id ?? details?.tournament_id
}

function canEditMatch(user, match, ownedTournamentIds = [], tournamentId = '') {
  const userId = resolveUserId(user)
  const creatorId = resolveMatchCreatorId(match)
  const resolvedTournamentId = tournamentId || resolveTournamentId(match)
  const ownsTournament = resolvedTournamentId && ownedTournamentIds.some((id) => sameId(id, resolvedTournamentId))
  return Boolean((userId && creatorId && sameId(userId, creatorId)) || ownsTournament)
}

function useMatchData(onLogout) {
  const [matches, setMatches] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMatches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const matchesData = await apiRequest('/matches')
      const liveData = await apiRequest('/matches/live').catch(() => [])
      const teamsData = await apiRequest('/teams/get').catch(() => [])
      const playersData = await apiRequest('/players').catch(() => [])

      setMatches(Array.isArray(matchesData) ? matchesData : [])
      setLiveMatches(Array.isArray(liveData) ? liveData : [])
      setTeams(Array.isArray(teamsData) ? teamsData : [])
      setPlayers(Array.isArray(playersData) ? playersData : [])
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
        const matchesData = await apiRequest('/matches')
        const liveData = await apiRequest('/matches/live').catch(() => [])
        const teamsData = await apiRequest('/teams/get').catch(() => [])
        const playersData = await apiRequest('/players').catch(() => [])

        if (!active) return
        setMatches(Array.isArray(matchesData) ? matchesData : [])
        setLiveMatches(Array.isArray(liveData) ? liveData : [])
        setTeams(Array.isArray(teamsData) ? teamsData : [])
        setPlayers(Array.isArray(playersData) ? playersData : [])
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

  return { matches, liveMatches, teams, players, loading, error, setError, loadMatches }
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
            <p>Open a match to view the scorecard or update ball-by-ball progress.</p>
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

async function tryMatchUpdate(match, payload) {
  const id = resolveMatchId(match)
  const details = matchDetails(match)
  const body = JSON.stringify({ ...details, ...payload })
  const options = { method: 'PUT', headers: authHeaders(), body }
  const endpoints = [`/matches/update/${id}`, `/matches/${id}`, `/api/matches/${id}`]
  let lastError = null

  for (const endpoint of endpoints) {
    try {
      return await apiRequest(endpoint, options)
    } catch (err) {
      lastError = err
      if (err.status && err.status !== 404) throw err
    }
  }

  throw lastError || new Error('Match update endpoint is not available.')
}

export function MatchScoringScreen({ user, goTo, onLogout }) {
  const { matches, liveMatches, teams, players, loading, error, setError, loadMatches } = useMatchData(onLogout)
  const params = new URLSearchParams(window.location.search)
  const initialMatchId = params.get('match')
  const tournamentId = params.get('tournament') || ''
  const [selectedId, setSelectedId] = useState(initialMatchId)
  const [ownedTournamentIds, setOwnedTournamentIds] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [summary, setSummary] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [batterId, setBatterId] = useState('')
  const [bowlerId, setBowlerId] = useState('')

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
  const canScore = canEditMatch(user, selected, ownedTournamentIds, tournamentId)

  const getTeamName = useCallback(
    (teamId) => teamLabel(findById(teams, teamId) || { id: teamId }),
    [teams],
  )

  const matchPlayers = useMemo(() => {
    const matchTeams = [matchTeamId(selected, 'team1_id'), matchTeamId(selected, 'team2_id')]
      .filter(Boolean)
      .map((teamId) => findById(teams, teamId) || { id: teamId })
    const linkedPlayers = players.filter((player) => matchTeams.some((team) => playerBelongsToTeam(player, team)))
    return linkedPlayers.length ? linkedPlayers : players
  }, [players, selected, teams])

  const activeBatters = matchPlayers.slice(0, 2)
  const activeBowlers = matchPlayers.filter((player) => /bowl/i.test(player.role || '')).slice(0, 3)
  const nextOver = Math.floor(deliveries.length / 6)
  const nextBall = (deliveries.length % 6) + 1

  const loadProgress = useCallback(async (matchId) => {
    if (!matchId) return
    try {
      const progressData = await apiRequest(`/api/progress/match/${matchId}`).catch(() => [])
      const summaryData = await apiRequest(`/api/progress/match/${matchId}/summary`).catch(() => null)
      setDeliveries(Array.isArray(progressData) ? progressData : [])
      setSummary(summaryData)
    } catch (err) {
      setError(err.message)
    }
  }, [setDeliveries, setError, setSummary])

  useEffect(() => {
    let active = true

    async function loadOwnedTournaments() {
      const data = await apiRequest('/tournaments/me/list', { headers: authHeaders() })
        .catch(() => apiRequest('/api/tournament/me/list', { headers: authHeaders() }).catch(() => []))
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
    await Promise.all([loadMatches(), loadProgress(progressMatchId)])
  }

  async function recordDelivery({ runs = 0, wicket = false, label = '' }) {
    if (!canScore) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/progress', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          match_id: Number(progressMatchId),
          batter_id: Number(selectedBatterId || 0),
          bowler_id: Number(selectedBowlerId || 0),
          runs_scored: Number(runs),
          is_wicket: wicket,
          over_number: nextOver,
          ball_number: nextBall,
          commentary: label || (wicket ? 'Wicket' : `${runs} run${Number(runs) === 1 ? '' : 's'}`),
          created_at: new Date().toISOString(),
        }),
      })
      setMessage('Match progress updated')
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
      await tryMatchUpdate(selected, { status: 'completed' })
      setMessage('Match marked completed')
      await refresh()
    } catch (err) {
      setError(err.message || 'Backend match completion endpoint is not available.')
    } finally {
      setSubmitting(false)
    }
  }

  async function switchInnings() {
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await tryMatchUpdate(selected, { innings: '2nd innings' })
      setMessage('Innings switched')
      await refresh()
    } catch (err) {
      setError(err.message || 'Backend switch innings endpoint is not available.')
    } finally {
      setSubmitting(false)
    }
  }

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
                <span className="live-chip">{matchStatus(selected) === 'live' ? 'Live match' : matchStatus(selected)}</span>
                <h1><MatchTitle match={selected} getTeamName={getTeamName} /></h1>
                <p>{scoreValue(selected, 'venue') || 'Venue TBA'} | {matchDetails(selected).innings || 'Match centre'}</p>
              </div>
              <div className="score-total">
                <strong>{summary?.total_runs ?? scoreValue(selected, 'team1_score')}/{summary?.total_wickets ?? scoreValue(selected, 'team1_wickets')}</strong>
                <span>({summary?.total_overs ?? scoreValue(selected, 'team1_overs')} Ov)</span>
              </div>
              <div className="mobile-bowler-line">
                <span>Bowler</span>
                <strong>{playerLabel(findById(players, selectedBowlerId) || activeBowlers[0])}</strong>
                <small>{deliveries.filter((delivery) => sameId(delivery.bowler_id, selectedBowlerId)).length} balls</small>
              </div>
            </article>

            {canScore && (
              <div className="score-player-selectors">
                <label>
                  <span>Batter</span>
                  <select value={selectedBatterId} onChange={(event) => setBatterId(event.target.value)}>
                    {matchPlayers.map((player) => <option value={player.id} key={player.id}>{playerLabel(player)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Bowler</span>
                  <select value={selectedBowlerId} onChange={(event) => setBowlerId(event.target.value)}>
                    {matchPlayers.map((player) => <option value={player.id} key={player.id}>{playerLabel(player)}</option>)}
                  </select>
                </label>
              </div>
            )}

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
                    <h2>{canScore ? 'Scoring Controls' : 'Live Score'}</h2>
                    {canScore && (
                      <div className="score-actions-inline">
                        <button type="button" onClick={switchInnings} disabled={submitting}>Switch Innings</button>
                        <button type="button" onClick={completeMatch} disabled={submitting}>Complete</button>
                      </div>
                    )}
                  </div>
                  {canScore ? (
                    <div className="scoring-grid">
                      {[0, 1, 2, 3, 4, 6].map((run) => (
                        <button className={run >= 4 ? 'primary-score' : ''} type="button" onClick={() => recordDelivery({ runs: run })} disabled={submitting} key={run}>{run}</button>
                      ))}
                      <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'Wide' })} disabled={submitting}>Wide</button>
                      <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'No ball' })} disabled={submitting}>No Ball</button>
                      <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'Bye' })} disabled={submitting}>Bye</button>
                      <button type="button" onClick={() => recordDelivery({ runs: 1, label: 'Leg bye' })} disabled={submitting}>L-Bye</button>
                      <button className="wicket-score" type="button" onClick={() => recordDelivery({ wicket: true })} disabled={submitting}>Out / Wicket</button>
                    </div>
                  ) : (
                    <p className="muted">Only the user who created this match can update match progress.</p>
                  )}
                </article>
              </section>

              <aside className="score-side">
                <article className="data-card">
                  <h2>Matches</h2>
                  {allMatches.slice(0, 8).map((match) => (
                    <button className={selected && sameId(resolveMatchId(selected), resolveMatchId(match)) ? 'data-row active' : 'data-row'} type="button" onClick={() => { setSelectedId(resolveMatchId(match)); goTo('score', { match: resolveMatchId(match), tournament: resolveTournamentId(match) || tournamentId }) }} key={`match-${resolveMatchId(match)}`}>
                      <strong><MatchTitle match={match} getTeamName={getTeamName} /></strong>
                      <span>{matchStatus(match)}</span>
                    </button>
                  ))}
                </article>
              </aside>
            </div>

            <div className="score-tables">
              <article className="data-card">
                <h2>Batting</h2>
                {activeBatters.map((player) => (
                  <div className="stat-row" key={player.id}><strong>{playerLabel(player)}</strong><span>{statValue(player.runs_scored)}</span><span>{statValue(player.ball_faced)}</span><span>{statValue(player.strike_rate).toFixed?.(1) || 0}</span></div>
                ))}
                {activeBatters.length === 0 && <p className="muted">No player data loaded.</p>}
              </article>
              <article className="data-card">
                <h2>Bowling</h2>
                {activeBowlers.map((player) => (
                  <div className="stat-row" key={player.id}><strong>{playerLabel(player)}</strong><span>{statValue(player.overs_bowled)}</span><span>{statValue(player.runs_conceded)}</span><span>{statValue(player.wickets_taken)}</span></div>
                ))}
                {activeBowlers.length === 0 && <p className="muted">No bowler data loaded.</p>}
              </article>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export const MatchesScreen = MatchListScreen
