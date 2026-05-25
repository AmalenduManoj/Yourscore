import { useEffect, useMemo, useState } from 'react'
import { DashboardHeader } from '../components/ui.jsx'
import { apiRequest } from '../lib/api.js'

export function HomeScreen({ user, goTo, onLogout }) {
  const [matches, setMatches] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      try {
        const matchesData = await apiRequest('/matches')
        const liveData = await apiRequest('/matches/live').catch(() => [])

        if (active) {
          setMatches(Array.isArray(matchesData) ? matchesData : [])
          setLiveMatches(Array.isArray(liveData) ? liveData : [])
        }
      } catch {
        if (active) {
          setMatches([])
          setLiveMatches([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      active = false
    }
  }, [])

  const completedMatches = useMemo(
    () => matches.filter((match) => {
      const status = (match.status || match.match_details?.status || '').toLowerCase()
      return status === 'completed'
    }),
    [matches],
  )
  const featuredMatch = liveMatches[0]

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="home" goTo={goTo} onLogout={onLogout} />

      <section className="dashboard-content">
        <div className="section-title">
          <h1>Live Now <span></span></h1>
          <button type="button" onClick={() => goTo('tournaments')}>Open Tournaments</button>
        </div>

        <div className="live-grid">
          <article className="match-card">
            {loading ? (
              <p className="muted">Loading live cricket...</p>
            ) : featuredMatch ? (
              <>
                <div className="match-meta">
                  <span>{featuredMatch.tournament_name || 'CricScore Match'}</span>
                  <strong>LIVE</strong>
                </div>
                <div className="score-line">
                  <div className="team-badge">
                    <div className="crest">🏏</div>
                    <h2>Team {featuredMatch.team1_id}</h2>
                  </div>
                  <div className="score-center">
                    <strong>{featuredMatch.team1_score ?? 0}/{featuredMatch.team1_wickets ?? 0}</strong>
                    <span>({featuredMatch.team1_overs ?? 0} ov)</span>
                    <small>{featuredMatch.status || 'scheduled'}</small>
                  </div>
                  <div className="team-badge">
                    <div className="crest dark">●</div>
                    <h2>Team {featuredMatch.team2_id}</h2>
                  </div>
                </div>
                <div className="match-footer">
                  <div>
                    <span>Venue</span>
                    <strong>{featuredMatch.venue || 'TBA'}</strong>
                  </div>
                  <button type="button">Scorecard</button>
                </div>
              </>
            ) : (
              <p className="muted">No live matches yet. When scoring starts, the latest match will appear here.</p>
            )}
          </article>

          <aside className="side-card">
            <h2>Other live matches</h2>
            {liveMatches.slice(1, 3).map((match) => (
              <a href="#match" className="mini-match" key={match.id}>
                <strong>Team {match.team1_id} vs Team {match.team2_id}</strong>
                <span>{match.team1_score ?? 0}/{match.team1_wickets ?? 0}</span>
              </a>
            ))}
            {!loading && liveMatches.length <= 1 && <p className="muted">No other live matches.</p>}
          </aside>
        </div>

        <section className="completed-section">
          <div className="section-title compact">
            <h2>Completed Matches</h2>
            <span>{completedMatches.length} total</span>
          </div>
          <div className="completed-grid">
            {completedMatches.map((match) => (
              <article className="completed-card" key={match.id}>
                <div className="match-meta">
                  <span>{match.tournament_name || 'Match'}</span>
                  <strong>Completed</strong>
                </div>
                <h3>Team {match.team1_id} vs Team {match.team2_id}</h3>
                <div className="completed-score">
                  <span>{match.team1_score ?? 0}/{match.team1_wickets ?? 0}</span>
                  <small>Team {match.team1_id}</small>
                </div>
                <div className="completed-score">
                  <span>{match.team2_score ?? 0}/{match.team2_wickets ?? 0}</span>
                  <small>Team {match.team2_id}</small>
                </div>
                <p>{match.venue || match.match_details?.venue || 'Venue TBA'}</p>
              </article>
            ))}
            {!loading && completedMatches.length === 0 && (
              <p className="muted">No completed matches yet.</p>
            )}
            {loading && (
              <p className="muted">Loading completed matches...</p>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
