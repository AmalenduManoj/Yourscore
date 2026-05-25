import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080'
const TOKEN_KEY = 'cricscore_token'
const USER_KEY = 'cricscore_user'

function Logo({ compact = false }) {
  return (
    <div className={compact ? 'brand brand-compact' : 'brand'}>
      <img className="brand-mark" src="/logo.png" alt="" aria-hidden="true" />
      <span>CricScore</span>
    </div>
  )
}

async function apiRequest(path, options = {}) {
  const { headers, ...requestOptions } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })

  const text = await response.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Something went wrong')
    error.status = response.status
    throw error
  }

  return data
}

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary env is missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || 'Image upload failed')
  }

  return data.secure_url
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

function AuthLayout({ children, footer = true }) {
  return (
    <main className="auth-shell">
      <div className="auth-pattern" />
      <header className="auth-header">
        <Logo />
      </header>
      {children}
      {footer && (
        <footer className="auth-footer">
          <p>© 2024 CricScore. All rights reserved.</p>
          <nav aria-label="Footer links">
            <a href="#support">Support</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
          </nav>
        </footer>
      )}
    </main>
  )
}

function TextInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  action,
  icon,
  autoComplete,
}) {
  return (
    <label className="field">
      <span className="field-row">
        <span>{label}</span>
        {action}
      </span>
      <span className="input-wrap">
        {icon && <span className="field-icon">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      </span>
    </label>
  )
}

function PasswordInput({ label, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <TextInput
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      action={
        <button
          className="ghost-icon"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          ◉
        </button>
      }
    />
  )
}

function StatusMessage({ type, children }) {
  if (!children) return null
  return <p className={`status ${type}`}>{children}</p>
}

function LoginScreen({ onAuthed, goTo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      onAuthed(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout footer={false}>
      <section className="auth-card login-card">
        <form onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          <p className="lead">Sign in to track your favorite matches.</p>
          <StatusMessage type="error">{error}</StatusMessage>
          <TextInput
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="alex@example.com"
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <button className="text-link forgot-link" type="button" onClick={() => goTo('forgot')}>
          Forgot password?
        </button>
        <p className="switch-text">
          Don&apos;t have an account?{' '}
          <button className="text-link" type="button" onClick={() => goTo('signup')}>
            Create an account
          </button>
        </p>
      </section>
      <p className="desktop-stamp">© 2024 CRICSCORE ANALYTICS V2.4.1</p>
    </AuthLayout>
  )
}

function SignupScreen({ onAuthed, goTo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const data = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      onAuthed(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout footer={false}>
      <section className="auth-card signup-card">
        <form onSubmit={handleSubmit}>
          <h1>Create your account</h1>
          <p className="lead">Join the community of cricket enthusiasts.</p>
          <StatusMessage type="error">{error}</StatusMessage>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Min 8 characters"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Sign up'}
          </button>
        </form>
        <div className="divider" />
        <p className="switch-text">
          Already have an account?{' '}
          <button className="text-link" type="button" onClick={() => goTo('login')}>
            Login
          </button>
        </p>
      </section>
      <div className="trust-row">
        <span>🛡 Secure data</span>
        <span>⚡ Real-time sync</span>
      </div>
    </AuthLayout>
  )
}

function ForgotPasswordScreen({ goTo }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <section className="auth-card forgot-card">
        <form onSubmit={handleSubmit}>
          <h1>Forgot password?</h1>
          <p className="lead">Enter your email and we&apos;ll send you a reset link.</p>
          <StatusMessage type="success">{message}</StatusMessage>
          <StatusMessage type="error">{error}</StatusMessage>
          <TextInput
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            autoComplete="email"
            icon="◌"
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link →'}
          </button>
        </form>
        <button className="back-link" type="button" onClick={() => goTo('login')}>
          ← Back to login
        </button>
      </section>
    </AuthLayout>
  )
}

function ResetPasswordScreen({ token, goTo }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!token) {
      setError('Reset token is missing')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const data = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <section className="auth-card reset-card">
        <form onSubmit={handleSubmit}>
          <h1>Reset password</h1>
          <p className="lead">Enter your new credentials to regain access to your account.</p>
          <StatusMessage type="success">{message}</StatusMessage>
          <StatusMessage type="error">{error}</StatusMessage>
          <PasswordInput
            label="New password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <button className="primary-btn bright" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
        {message && (
          <button className="back-link" type="button" onClick={() => goTo('login')}>
            Back to login
          </button>
        )}
      </section>
    </AuthLayout>
  )
}

function DashboardHeader({ user, active = 'home', goTo, onLogout }) {
  return (
    <header className="topbar">
      <button className="brand-button" type="button" onClick={() => goTo('home')}>
        <Logo compact />
      </button>
      <nav>
        <button type="button" className={active === 'home' ? 'active' : ''} onClick={() => goTo('home')}>Home</button>
        <button type="button" className={active === 'matches' ? 'active' : ''} onClick={() => goTo('matches')}>Matches</button>
        <button type="button" className={active === 'tournaments' ? 'active' : ''} onClick={() => goTo('tournaments')}>Tournaments</button>
        <button type="button" className={active === 'teams' ? 'active' : ''} onClick={() => goTo('teams')}>Teams</button>
        <button type="button" className={active === 'players' ? 'active' : ''} onClick={() => goTo('players')}>Players</button>
        <button type="button" className={active === 'profile' ? 'active' : ''} onClick={() => goTo('profile')}>Profile</button>
      </nav>
      <div className="session">
        <button className="welcome-button" type="button" onClick={() => goTo('profile')}>
          Welcome, {user?.email || 'User'}
        </button>
        <button type="button" onClick={onLogout} title="Logout" aria-label="Logout">
          ↪
        </button>
      </div>
    </header>
  )
}

function toDateInputValue(year) {
  if (!year) return ''
  return `${year}-01-01`
}

function toPlayerPayload(form) {
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

function PlayerForm({ mode, initialPlayer, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initialPlayer?.name || '',
    dob: toDateInputValue(initialPlayer?.dob),
    role: initialPlayer?.role || 'Batsman',
    profile_picture_url: initialPlayer?.profile_picture_url || '',
    bio: initialPlayer?.bio || '',
    is_active: initialPlayer?.is_active ?? true,
  }))
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setUploading(true)
    try {
      const imageUrl = await uploadToCloudinary(file)
      updateField('profile_picture_url', imageUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Full name is required')
      return
    }

    if (!form.dob) {
      setError('Date of birth is required')
      return
    }

    setSubmitting(true)
    try {
      const payload = toPlayerPayload(form)
      const path = mode === 'edit' ? `/players/update/${initialPlayer.id}` : '/players'
      await apiRequest(path, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="profile-setup">
      <div className="profile-copy">
        <button className="profile-back" type="button" onClick={onCancel}>← Back to dashboard</button>
        <h1>{mode === 'edit' ? 'Edit Profile' : 'Profile Setup'}</h1>
        <p>
          {mode === 'edit'
            ? 'Update your player details and save the latest profile image.'
            : "It looks like you haven't created a player profile yet. Fill in the details below to get started."}
        </p>
      </div>

      <form className="player-form" onSubmit={handleSubmit}>
        <h2>{mode === 'edit' ? 'Update Player Profile' : 'Create Player Profile'}</h2>
        <StatusMessage type="error">{error}</StatusMessage>

        <div className="avatar-uploader">
          <div className="avatar-preview">
            {form.profile_picture_url ? (
              <img src={form.profile_picture_url} alt="Player profile preview" />
            ) : (
              <span>Profile image</span>
            )}
          </div>
          <label className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploading || submitting} />
          </label>
          <small>Uploaded to Cloudinary. The returned URL is saved with your profile.</small>
        </div>

        <div className="form-grid">
          <label className="profile-field">
            <span>Full name</span>
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Rahul Dravid" />
          </label>
          <label className="profile-field">
            <span>Date of birth</span>
            <input type="date" value={form.dob} onChange={(event) => updateField('dob', event.target.value)} />
          </label>
        </div>

        <label className="profile-field">
          <span>Player role</span>
          <select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
            <option>Batsman</option>
            <option>Bowler</option>
            <option>All-rounder</option>
            <option>Wicket keeper</option>
          </select>
        </label>

        <label className="profile-field">
          <span>Profile picture URL</span>
          <input value={form.profile_picture_url} onChange={(event) => updateField('profile_picture_url', event.target.value)} placeholder="Cloudinary URL appears here" />
        </label>

        <label className="profile-field">
          <span>Bio</span>
          <textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} placeholder="Tell us about your cricketing journey..." />
        </label>

        <label className="active-toggle">
          <span>
            <strong>Active Player</strong>
            <small>Visible in selection and stats leaderboards.</small>
          </span>
          <input type="checkbox" checked={form.is_active} onChange={(event) => updateField('is_active', event.target.checked)} />
        </label>

        <button className="profile-submit" type="submit" disabled={submitting || uploading}>
          {submitting ? (mode === 'edit' ? 'Saving changes...' : 'Creating profile...') : mode === 'edit' ? 'Save changes' : 'Create profile'}
        </button>
      </form>
    </section>
  )
}

function statValue(value, fallback = 0) {
  return value ?? fallback
}

function ProfileStats({ player, onEdit, onBack }) {
  const avatar = player.profile_picture_url

  return (
    <section className="profile-view">
      <button className="profile-back" type="button" onClick={onBack}>← Back to dashboard</button>
      <article className="profile-hero">
        <div className="profile-avatar">
          {avatar ? <img src={avatar} alt={player.name} /> : <span>{player.name?.charAt(0) || 'P'}</span>}
          <strong>{player.is_active ? 'Active' : 'Inactive'}</strong>
        </div>
        <div>
          <h1>{player.name}</h1>
          <span className="role-pill">{player.role}</span>
          <p>{player.bio || 'No bio added yet.'}</p>
        </div>
        <button className="edit-profile-btn" type="button" onClick={onEdit}>✎ Edit profile</button>
      </article>

      <div className="profile-stat-grid">
        <article className="profile-panel batting-panel">
          <h2>🏏 Batting Performance</h2>
          <div className="big-stats">
            <div><span>Runs</span><strong>{statValue(player.runs_scored).toLocaleString()}</strong></div>
            <div><span>Avg</span><strong>{statValue(player.batting_average).toFixed?.(2) || 0}</strong></div>
            <div><span>SR</span><strong>{statValue(player.strike_rate).toFixed?.(2) || 0}</strong></div>
            <div><span>100s</span><strong className="green">{statValue(player.centuries)}</strong></div>
          </div>
          <div className="small-stats">
            <div><span>50s</span><strong>{statValue(player.half_centuries)}</strong></div>
            <div><span>4s</span><strong>{statValue(player.fours)}</strong></div>
            <div><span>6s</span><strong>{statValue(player.sixes)}</strong></div>
            <div><span>Balls</span><strong>{statValue(player.ball_faced)}</strong></div>
          </div>
        </article>

        <article className="profile-panel general-panel">
          <h2>🏆 General</h2>
          <div className="general-list">
            <span>Matches <strong>{statValue(player.matches_played)}</strong></span>
            <span>Catches <strong>{statValue(player.catches)}</strong></span>
            <span>Stumpings <strong>{statValue(player.stumpings)}</strong></span>
            <span className="highlight">MOTM <strong>{statValue(player.player_of_the_match_awards)}</strong></span>
            <span>MOTS <strong>{statValue(player.player_of_the_series_awards)}</strong></span>
            <span>DOB <strong>{player.dob || 'Not available'}</strong></span>
          </div>
        </article>
      </div>

      <article className="bowling-strip">
        <h2>● Bowling Figures</h2>
        <div>
          <span>Wickets <strong>{statValue(player.wickets_taken)}</strong></span>
          <span>Avg <strong>{statValue(player.bowling_average).toFixed?.(2) || 0}</strong></span>
          <span>Econ <strong>{statValue(player.economy_rate).toFixed?.(2) || 0}</strong></span>
          <span>5W <strong>{statValue(player.five_wicket_hauls)}</strong></span>
          <span>3W <strong>{statValue(player.three_wicket_hauls)}</strong></span>
          <span>Best <strong>{player.best_bowling_figures || 'Not available'}</strong></span>
        </div>
      </article>
    </section>
  )
}

function ProfileScreen({ user, goTo, onLogout }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiRequest('/players/me', { headers: authHeaders() })
      return { player: data, error: '' }
    } catch (err) {
      if (err.status === 404) return { player: null, error: '' }
      if (err.status === 401) {
        onLogout()
        return { player: null, error: '' }
      }
      return { player: null, error: err.message }
    }
  }, [onLogout])

  async function loadProfile() {
    setLoading(true)
    setError('')
    const result = await fetchProfile()
    setPlayer(result.player)
    setError(result.error)
    setEditing(false)
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    fetchProfile().then((result) => {
      if (!active) return
      setPlayer(result.player)
      setError(result.error)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [fetchProfile])

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="profile" goTo={goTo} onLogout={onLogout} />
      <section className="profile-page">
        {loading && <p className="muted">Loading profile...</p>}
        <StatusMessage type="error">{error}</StatusMessage>
        {!loading && !error && player && !editing && (
          <ProfileStats player={player} onEdit={() => setEditing(true)} onBack={() => goTo('home')} />
        )}
        {!loading && !error && (!player || editing) && (
          <PlayerForm
            mode={player ? 'edit' : 'create'}
            initialPlayer={player}
            onSaved={loadProfile}
            onCancel={() => (player ? setEditing(false) : goTo('home'))}
          />
        )}
      </section>
    </main>
  )
}

function formatDate(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function tournamentStatus(tournament) {
  const now = new Date()
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Scheduled'
  if (now < start) return 'Upcoming'
  if (now > end) return 'Completed'
  return 'Active'
}

function sameId(left, right) {
  return String(left) === String(right)
}

function firstTournamentId(tournaments) {
  return tournaments[0]?.id ?? null
}

function resolveSelectedId(currentId, tournaments) {
  if (currentId && tournaments.some((tournament) => sameId(tournament.id, currentId))) {
    return currentId
  }

  return firstTournamentId(tournaments)
}

function emptyTournamentDetails() {
  return { teams: [], standings: [], leaderboard: [], batsmen: [], bowlers: [], matches: [], players: [] }
}

function getResourceId(resource) {
  return resource?.id ?? resource?.tournament?.id ?? resource?.data?.id ?? null
}

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

function teamLabel(team) {
  return team?.name || (team?.id ? `Team ${team.id}` : 'Team')
}

function playerLabel(player) {
  return player?.name || player?.full_name || (player?.id ? `Player ${player.id}` : 'Player')
}

function findById(items, id) {
  return items.find((item) => sameId(item.id, id))
}

function canManage(user) {
  const role = String(user?.role || user?.user_role || '').toLowerCase()
  return Boolean(user?.is_admin || user?.isAdmin || role === 'admin' || role === 'owner')
}

function matchDetails(match) {
  return match?.match_details || match || {}
}

function matchStatus(match) {
  return (match?.status || matchDetails(match).status || 'scheduled').toLowerCase()
}

function matchTeamId(match, key) {
  return match?.[key] ?? matchDetails(match)?.[key]
}

function scoreValue(match, key) {
  return match?.[key] ?? matchDetails(match)?.[key] ?? 0
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
                <strong>{teamLabel(team)}</strong>
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
            {matchTeams.map((team) => <option value={team.id} key={team.id}>{teamLabel(team)}</option>)}
          </select>
          <select value={matchForm.team2_id} onChange={(event) => setMatchForm((current) => ({ ...current, team2_id: event.target.value }))}>
            <option value="">Team 2</option>
            {matchTeams.map((team) => <option value={team.id} key={team.id}>{teamLabel(team)}</option>)}
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

function TournamentScreen({ user, goTo, onLogout }) {
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
    (teamId, fallbackName) => fallbackName || teamLabel(findById(allTeams, teamId) || { id: teamId }),
    [allTeams],
  )
  const getPlayerName = useCallback(
    (playerId) => playerLabel(findById(visibleDetails.players, playerId) || { id: playerId }),
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

function HomeScreen({ user, goTo, onLogout }) {
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

function MatchesScreen({ user, goTo, onLogout }) {
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

function PlayersScreen({ user, goTo, onLogout }) {
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const manager = canManage(user)

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/players')
      setPlayers(Array.isArray(data) ? data : [])
      setShowCreate(false)
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
        const data = await apiRequest('/players')
        if (!active) return
        setPlayers(Array.isArray(data) ? data : [])
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

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const haystack = `${player.name} ${player.role} ${player.id}`.toLowerCase()
    const matchesQuery = haystack.includes(query.toLowerCase())
    const matchesRole = role === 'all' || String(player.role).toLowerCase() === role
    const matchesStatus = status === 'all' || String(Boolean(player.is_active)) === status
    return matchesQuery && matchesRole && matchesStatus
  }), [players, query, role, status])

  return (
    <main className="dashboard-shell">
      <DashboardHeader user={user} active="players" goTo={goTo} onLogout={onLogout} />
      <section className="directory-page">
        <div className="directory-title">
          <div>
            <h1>Players</h1>
            <p>Manage roster data and track individual performance metrics.</p>
          </div>
          {manager && <button type="button" onClick={() => setShowCreate((current) => !current)}>+ Add Player</button>}
        </div>

        <StatusMessage type="error">{error}</StatusMessage>
        {showCreate && manager && <PlayerForm mode="create" onSaved={loadPlayers} onCancel={() => setShowCreate(false)} />}

        <div className="directory-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player" />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">All Roles</option>
            <option value="batsman">Batsman</option>
            <option value="bowler">Bowler</option>
            <option value="all-rounder">All-rounder</option>
            <option value="wicket keeper">Wicket keeper</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button type="button" onClick={() => { setQuery(''); setRole('all'); setStatus('all') }}>Reset</button>
        </div>

        <div className="directory-table player-table">
          <div className="directory-head"><span>Player</span><span>Role</span><span>Age</span><span>Status</span><span>Runs</span><span>Avg</span><span>Wickets</span><span>Econ</span></div>
          {filteredPlayers.map((player) => (
            <div className="directory-row" key={player.id}>
              <strong>{playerLabel(player)}<small>ID {player.id}</small></strong>
              <span>{player.role || 'Player'}</span>
              <span>{player.dob ? new Date().getFullYear() - Number(player.dob) : '-'}</span>
              <span className={player.is_active ? 'positive' : 'negative'}>{player.is_active ? 'Active' : 'Inactive'}</span>
              <span>{statValue(player.runs_scored).toLocaleString()}</span>
              <span>{statValue(player.batting_average).toFixed?.(1) || 0}</span>
              <span>{statValue(player.wickets_taken)}</span>
              <span>{statValue(player.economy_rate).toFixed?.(2) || 0}</span>
            </div>
          ))}
          {loading && <p className="muted table-empty">Loading players...</p>}
          {!loading && filteredPlayers.length === 0 && <p className="muted table-empty">No players found.</p>}
        </div>
      </section>
    </main>
  )
}

function TeamsScreen({ user, goTo, onLogout }) {
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

function App() {
  const params = new URLSearchParams(window.location.search)
  const resetToken = params.get('token')

  const screenFromPath = useCallback(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    if (resetToken) return 'reset'
    if (path === '/matches') return 'matches'
    if (path === '/tournament' || path === '/tournaments') return 'tournaments'
    if (path === '/teams') return 'teams'
    if (path === '/players') return 'players'
    if (path === '/profile') return 'profile'
    if (path === '/signup') return 'signup'
    if (path === '/forgot') return 'forgot'
    return localStorage.getItem(TOKEN_KEY) && getStoredUser() ? 'home' : 'login'
  }, [resetToken])

  const [user, setUser] = useState(getStoredUser)
  const [screen, setScreen] = useState(screenFromPath)

  function goTo(nextScreen) {
    const paths = {
      home: '/',
      matches: '/matches',
      tournaments: '/tournament',
      teams: '/teams',
      players: '/players',
      profile: '/profile',
      signup: '/signup',
      forgot: '/forgot',
    }
    if (nextScreen !== 'reset') {
      window.history.pushState({}, '', paths[nextScreen] || '/')
    }
    setScreen(nextScreen)
  }

  function handleAuthed(nextUser) {
    setUser(nextUser)
    window.history.pushState({}, '', '/')
    setScreen('home')
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
    window.history.pushState({}, '', '/')
    setScreen('login')
  }

  useEffect(() => {
    function handlePopState() {
      setScreen(screenFromPath())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [screenFromPath])

  if (screen === 'home') return <HomeScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'matches') return <MatchesScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'tournaments') return <TournamentScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'teams') return <TeamsScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'players') return <PlayersScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'profile') return <ProfileScreen user={user} goTo={goTo} onLogout={handleLogout} />
  if (screen === 'signup') return <SignupScreen onAuthed={handleAuthed} goTo={goTo} />
  if (screen === 'forgot') return <ForgotPasswordScreen goTo={goTo} />
  if (screen === 'reset') return <ResetPasswordScreen token={resetToken} goTo={goTo} />
  return <LoginScreen onAuthed={handleAuthed} goTo={goTo} />
}

export default App
