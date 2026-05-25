import { useCallback, useEffect, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest } from '../lib/api.js'
import { canManage, findById, matchDetails, matchStatus, matchTeamId, playerLabel, sameId, scoreValue, statValue, teamLabel } from '../lib/helpers.js'

export function MatchesScreen({ user, goTo, onLogout }) {
  const [matches, setMatches] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selected = matches.find((match) => sameId(match.id, selectedId)) || liveMatches[0] || matches[0]
  const manager = canManage(user)

  const getTeamName = useCallback(
    (teamId) => teamLabel(findById(teams, teamId) || { id: teamId }),
    [teams],
  )

  const activeBatters = players.slice(0, 2)
  const activeBowlers = players.filter((player) => /bowl/i.test(player.role || '')).slice(0, 2)

  useEffect(() => {
    let active = true

    async function loadMatches() {
      setLoading(true)
      setError('')
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
        setSelectedId((current) => current || matchesData?.[0]?.id || liveData?.[0]?.id || null)
      } catch (err) {
        if (err.status === 401) onLogout()
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMatches()
    return () => {
      active = false
    }
  }, [onLogout])

  function unavailableAction() {
    setError('Scoring update endpoint is not available in the current API. Match data is loaded fresh from /matches.')
  }

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="matches" goTo={goTo} onLogout={onLogout} />
      <section className="score-page">
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <p className="muted">Loading matches...</p>}
        {!loading && selected && (
          <>
            <article className="score-hero">
              <div>
                <span className="live-chip">{matchStatus(selected) === 'live' ? 'Live match' : matchStatus(selected)}</span>
                <h1>{getTeamName(matchTeamId(selected, 'team1_id'))} vs {getTeamName(matchTeamId(selected, 'team2_id'))}</h1>
                <p>{scoreValue(selected, 'venue') || 'Venue TBA'} | {matchDetails(selected).innings || 'Match centre'}</p>
              </div>
              <div className="score-total">
                <strong>{scoreValue(selected, 'team1_score')}/{scoreValue(selected, 'team1_wickets')}</strong>
                <span>({scoreValue(selected, 'team1_overs')} Ov)</span>
              </div>
            </article>

            <div className="match-workspace">
              <section className="score-main">
                <article className="score-panel">
                  <h2>Current Over</h2>
                  <div className="ball-strip">
                    {['0', '1', '4', '1wd', '0', 'W'].map((ball, index) => (
                      <span className={ball === 'W' ? 'wicket' : ball === '4' ? 'boundary' : ''} key={`${ball}-${index}`}>{ball}</span>
                    ))}
                  </div>
                </article>

                <article className="score-panel">
                  <div className="panel-header slim">
                    <h2>{manager ? 'Admin Scoring Controls' : 'Live Score'}</h2>
                    {manager && (
                      <div className="score-actions-inline">
                        <button type="button" onClick={unavailableAction}>Switch Innings</button>
                        <button type="button" onClick={unavailableAction}>Complete Match</button>
                      </div>
                    )}
                  </div>
                  {manager ? (
                    <div className="scoring-grid">
                      {[0, 1, 2, 3, 4, 6].map((run) => (
                        <button className={run >= 4 ? 'primary-score' : ''} type="button" onClick={unavailableAction} key={run}>{run}</button>
                      ))}
                      {['Wide', 'No Ball', 'Bye', 'Leg Bye'].map((extra) => (
                        <button type="button" onClick={unavailableAction} key={extra}>{extra}</button>
                      ))}
                      <button className="wicket-score" type="button" onClick={unavailableAction}>Out / Wicket</button>
                    </div>
                  ) : (
                    <p className="muted">Only tournament admins can update match progress. Viewers see fresh live data.</p>
                  )}
                </article>
              </section>

              <aside className="score-side">
                <article className="data-card">
                  <h2>Matches</h2>
                  {[...liveMatches, ...matches].slice(0, 8).map((match) => (
                    <button className={selected && sameId(selected.id, match.id) ? 'data-row active' : 'data-row'} type="button" onClick={() => setSelectedId(match.id)} key={`match-${match.id}`}>
                      <strong>{getTeamName(matchTeamId(match, 'team1_id'))} vs {getTeamName(matchTeamId(match, 'team2_id'))}</strong>
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
