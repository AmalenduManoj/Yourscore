import { useState } from 'react'
import { AuthLayout, PasswordInput, StatusMessage, TextInput } from '../components/ui.jsx'
import { apiRequest } from '../lib/api.js'
import { TOKEN_KEY, USER_KEY } from '../lib/constants.js'

export function LoginScreen({ onAuthed, goTo }) {
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

export function SignupScreen({ onAuthed, goTo }) {
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

export function ForgotPasswordScreen({ goTo }) {
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

export function ResetPasswordScreen({ token, goTo }) {
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
