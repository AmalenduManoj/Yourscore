import { useState } from 'react'

export function Logo({ compact = false }) {
  return (
    <div className={compact ? 'brand brand-compact' : 'brand'}>
      <img className="brand-mark" src="/logo.png" alt="" aria-hidden="true" />
      <span>CricScore</span>
    </div>
  )
}

export function AuthLayout({ children, footer = true }) {
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

export function TextInput({
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

export function PasswordInput({ label, value, onChange, placeholder, autoComplete }) {
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

export function StatusMessage({ type, children }) {
  if (!children) return null
  return <p className={`status ${type}`}>{children}</p>
}

export function DashboardHeader({ user, active = 'home', goTo, onLogout }) {
  const navItems = [
    { key: 'home', label: 'Home', icon: '⌂' },
    { key: 'matches', label: 'Matches', icon: '⌁' },
    { key: 'players', label: 'Stats', icon: '▥' },
    { key: 'teams', label: 'More', icon: '☰' },
  ]
  const activeKey = active === 'score'
    ? 'matches'
    : active === 'player'
      ? 'players'
      : active === 'team' || active === 'tournaments'
        ? 'teams'
        : active

  return (
    <>
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => goTo('home')}>
          <Logo compact />
        </button>
        <nav>
          <button type="button" className={active === 'home' ? 'active' : ''} onClick={() => goTo('home')}>Home</button>
          <button type="button" className={active === 'matches' || active === 'score' ? 'active' : ''} onClick={() => goTo('matches')}>Matches</button>
          <button type="button" className={active === 'tournaments' ? 'active' : ''} onClick={() => goTo('tournaments')}>Tournaments</button>
          <button type="button" className={active === 'teams' || active === 'team' ? 'active' : ''} onClick={() => goTo('teams')}>Teams</button>
          <button type="button" className={active === 'players' || active === 'player' ? 'active' : ''} onClick={() => goTo('players')}>Players</button>
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
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            className={activeKey === item.key ? 'active' : ''}
            type="button"
            onClick={() => goTo(item.key)}
            key={item.key}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  )
}
