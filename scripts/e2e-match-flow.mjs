#!/usr/bin/env node
const API = process.env.API || 'http://127.0.0.1:8080'
const email = process.env.E2E_EMAIL || `e2e_${Date.now()}@test.local`
const password = process.env.E2E_PASSWORD || 'TestPass123!'

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  })
  const text = await res.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log('=== E2E match flow ===')
  console.log('API:', API)

  const signup = await req('/auth/signup', {
    method: 'POST',
    body: { email, password },
  })
  const token = signup.token
  const userId = signup.user?.id
  assert(token, 'No token from signup')
  console.log('✓ Signed up', email, 'user', userId)

  const teams = await req('/teams/get')
  let team1Id = null
  let team2Id = null
  let squad1 = []
  let squad2 = []

  for (const team of teams) {
    const squad = await req(`/team_players/${team.id}`)
    if (squad.length >= 11) {
      if (!team1Id) {
        team1Id = team.id
        squad1 = squad.slice(0, 11)
      } else if (team.id !== team1Id) {
        team2Id = team.id
        squad2 = squad.slice(0, 11)
        break
      }
    }
  }

  if (!team1Id || !team2Id) {
    const team1 = await req('/teams', {
      method: 'POST',
      token,
      body: {
        name: `E2E Team A ${Date.now()}`,
        city: 'City A',
        created_by_user_id: userId,
        player_ids: [],
      },
    })
    const team2 = await req('/teams', {
      method: 'POST',
      token,
      body: {
        name: `E2E Team B ${Date.now()}`,
        city: 'City B',
        created_by_user_id: userId,
        player_ids: [],
      },
    })
    team1Id = team1.team_id
    team2Id = team2.team_id
    throw new Error(
      `Created teams ${team1Id}/${team2Id} but squads need 11 players each. Run scripts/seed-e2e-squad.sql or add players in the UI first.`,
    )
  }

  console.log('✓ Using teams', team1Id, 'vs', team2Id, 'with full squads')

  const tour = await req('/tournaments', {
    method: 'POST',
    token,
    body: {
      name: `E2E Tournament ${Date.now()}`,
      location: 'Browser Test Ground',
      start_date: '2026-05-01T00:00:00',
      end_date: '2026-06-30T00:00:00',
      team_ids: [team1Id, team2Id],
    },
  })
  const tournamentId = tour.tournament_id
  assert(tournamentId, 'No tournament_id')
  console.log('✓ Tournament', tournamentId)

  const matchRes = await req(`/api/tournament/${tournamentId}/matches`, {
    method: 'POST',
    token,
    body: {
      match_number: 99,
      match_data: {
        team1_id: team1Id,
        team2_id: team2Id,
        venue: 'E2E Arena',
        total_overs: 20,
        team1_score: 0,
        team1_wickets: 0,
        team1_overs: 0,
        team2_score: 0,
        team2_wickets: 0,
        team2_overs: 0,
        status: 'scheduled',
      },
    },
  })
  const matchId = matchRes.match_id
  assert(matchId, 'No match_id')
  console.log('✓ Match created', matchId)

  await req(`/api/matches/${matchId}/lineup/${team1Id}`, {
    method: 'PUT',
    token,
    body: { player_ids: squad1.map((p) => p.id) },
  })
  await req(`/api/matches/${matchId}/lineup/${team2Id}`, {
    method: 'PUT',
    token,
    body: { player_ids: squad2.map((p) => p.id) },
  })
  console.log('✓ Playing XI saved (11 + 11)')

  const lineup = await req(`/api/matches/${matchId}/lineup`)
  assert(lineup.length === 22, `Expected 22 lineup rows, got ${lineup.length}`)
  console.log('✓ Lineup verified', lineup.length, 'players')

  await req(`/api/matches/${matchId}/start`, { method: 'POST', token })
  console.log('✓ Match started')

  const batter = squad1[0].id
  const bowler = squad2[0].id
  for (let i = 0; i < 6; i += 1) {
    await req('/api/progress', {
      method: 'POST',
      token,
      body: {
        id: 0,
        match_id: matchId,
        batter_id: batter,
        bowler_id: bowler,
        runs_scored: i % 2 === 0 ? 4 : 1,
        is_wicket: i === 5,
        over_number: 0,
        ball_number: i + 1,
        commentary: `Ball ${i + 1}`,
        created_at: new Date().toISOString(),
      },
    })
  }
  console.log('✓ Recorded 6 deliveries')

  const summary = await req(`/api/progress/match/${matchId}/summary`)
  console.log('  Summary:', summary)

  const stats = await req(`/api/matches/${matchId}/player-stats`)
  assert(stats.length > 0, 'No player stats after progress')
  console.log('✓ Player stats', stats.length, 'rows')

  const complete = await req(`/api/matches/${matchId}/complete`, {
    method: 'POST',
    token,
    body: { team2_score: 80, team2_wickets: 5, team2_overs: 20 },
  })
  console.log('✓ Match completed:', complete.message)

  const standings = await req(`/api/tournament/${tournamentId}/standings`)
  const s1 = standings.find((s) => s.team_id === team1Id)
  const s2 = standings.find((s) => s.team_id === team2Id)
  assert(s1?.match_played >= 1 && s2?.match_played >= 1, 'Standings not updated')
  console.log('✓ Standings updated team', team1Id, s1.points, 'pts; team', team2Id, s2.points, 'pts')

  const creds = { email, password, tournamentId, matchId, team1Id, team2Id }
  console.log('\n=== ALL E2E CHECKS PASSED ===')
  console.log(JSON.stringify(creds, null, 2))
  return creds
}

main()
  .then((creds) => {
    if (creds && process.env.E2E_CREDS_FILE) {
      return import('node:fs').then((fs) =>
        fs.writeFileSync(process.env.E2E_CREDS_FILE, JSON.stringify(creds, null, 2)),
      )
    }
  })
  .catch((err) => {
  console.error('\n=== E2E FAILED ===')
  console.error(err.message)
  if (err.data) console.error(err.data)
  process.exit(1)
})
