export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('cricscore_user'))
  } catch {
    return null
  }
}

export function toDateInputValue(year) {
  if (!year) return ''
  return `${year}-01-01`
}

export function toPlayerPayload(form) {
  const year = form.dob ? Number(form.dob.slice(0, 4)) : 0
  return {
    name: form.name.trim(),
    is_active: form.is_active,
    dob: year,
    role: form.role,
    profile_picture_url: form.profile_picture_url || null,
    bio: form.bio || null,
  }
}

export function statValue(value, fallback = 0) {
  return value ?? fallback
}

export function formatDate(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function tournamentStatus(tournament) {
  const now = new Date()
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Scheduled'
  if (now < start) return 'Upcoming'
  if (now > end) return 'Completed'
  return 'Active'
}

export function sameId(left, right) {
  return String(left) === String(right)
}

export function firstTournamentId(tournaments) {
  return tournaments[0]?.id ?? null
}

export function resolveSelectedId(currentId, tournaments) {
  if (currentId && tournaments.some((tournament) => sameId(tournament.id, currentId))) {
    return currentId
  }

  return firstTournamentId(tournaments)
}

export function emptyTournamentDetails() {
  return { teams: [], standings: [], leaderboard: [], batsmen: [], bowlers: [], matches: [], players: [] }
}

export function getResourceId(resource) {
  return resource?.id ?? resource?.tournament?.id ?? resource?.data?.id ?? null
}

export function teamLabel(team) {
  return team?.name || (team?.id ? `Team ${team.id}` : 'Team')
}

export function playerLabel(player) {
  return player?.name || player?.full_name || (player?.id ? `Player ${player.id}` : 'Player')
}

export function findById(items, id) {
  return items.find((item) => sameId(item.id, id))
}

export function canManage(user) {
  const role = String(user?.role || user?.user_role || '').toLowerCase()
  return Boolean(user?.is_admin || user?.isAdmin || role === 'admin' || role === 'owner')
}

export function matchDetails(match) {
  return match?.match_details || match || {}
}

export function matchStatus(match) {
  return (match?.status || matchDetails(match).status || 'scheduled').toLowerCase()
}

export function matchTeamId(match, key) {
  return match?.[key] ?? matchDetails(match)?.[key]
}

export function scoreValue(match, key) {
  return match?.[key] ?? matchDetails(match)?.[key] ?? 0
}
