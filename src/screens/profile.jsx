import { useCallback, useEffect, useState } from 'react'
import { DashboardHeader, StatusMessage } from '../components/ui.jsx'
import { apiRequest, authHeaders, uploadToCloudinary } from '../lib/api.js'
import { statValue, toDateInputValue, toPlayerPayload } from '../lib/helpers.js'

export function PlayerForm({ mode, initialPlayer, onSaved, onCancel }) {
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

export function ProfileStats({ player, onEdit, onBack }) {
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

export function ProfileScreen({ user, goTo, onLogout }) {
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
