import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useState, useEffect } from 'react'

export default function Layout({ children }) {
  const { profile, isManager, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navItems = [
    { to: '/home', label: 'Home' },
    { to: '/my-entries', label: 'My Entries' },
  ]

  if (isManager) {
    navItems.push({ to: '/admin', label: 'Admin' })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'U'

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border-subtle)',
          boxShadow: '0 8px 32px rgba(0,201,255,0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20 relative">
            {/* Gradient logo */}
            <Link to="/home" className="flex items-center">
              <img src="/logo.png" alt="xTimeBox" className="h-10" />
            </Link>

            {/* Nav - centred (desktop) */}
            <nav
              className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 rounded-full px-1.5 py-1.5"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--input-border)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {navItems.map((item) => {
                const isActive = location.pathname === item.to ||
                  (item.to !== '/home' && location.pathname.startsWith(item.to))
                const icon = item.to === '/home' ? 'home' : item.to === '/my-entries' ? 'description' : 'admin_panel_settings'
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)]'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, rgba(0,201,255,0.2) 0%, rgba(123,47,219,0.2) 100%)',
                      border: '1px solid rgba(0,201,255,0.25)',
                      boxShadow: '0 2px 12px rgba(0,201,255,0.15)',
                    } : {}}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)] transition-all duration-300"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              <button className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)] transition-all duration-300">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>notifications</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold text-white transition-all overflow-hidden hover:ring-2 hover:ring-white/20"
                  style={profile?.avatar_url ? {} : { background: 'linear-gradient(135deg, #00C9FF, #7B2FDB)' }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)}></div>
                    <div
                      className="absolute right-0 mt-2 w-52 rounded-xl z-30 py-1"
                      style={{
                        background: 'var(--color-surface-container)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid var(--glass-border)',
                        boxShadow: 'var(--card-shadow)',
                      }}
                    >
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--divider)' }}>
                        <p className="text-sm font-medium text-on-surface">{profile?.full_name}</p>
                        <p className="text-xs text-on-surface-variant">{profile?.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="block w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)] transition-colors"
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={() => { setUserMenuOpen(false); handleSignOut() }}
                        className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:text-error hover:bg-[var(--white-alpha-5)] transition-colors rounded-b-xl"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)] transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div
            className="md:hidden"
            style={{
              background: 'var(--header-bg)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid var(--divider)',
            }}
          >
            <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to ||
                  (item.to !== '/home' && location.pathname.startsWith(item.to))
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                      isActive
                        ? 'text-on-surface'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)]'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, rgba(0,201,255,0.12) 0%, rgba(123,47,219,0.12) 100%)',
                      border: '1px solid rgba(0,201,255,0.2)',
                    } : {}}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {item.to === '/home' ? 'home' : item.to === '/my-entries' ? 'description' : item.to === '/admin' ? 'admin_panel_settings' : 'circle'}
                    </span>
                    {item.label}
                  </Link>
                )
              })}

              {/* Quick actions in mobile nav */}
              <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
                <Link
                  to="/timesheet"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,201,255,0.15) 0%, rgba(123,47,219,0.15) 100%)',
                    border: '1px solid rgba(0,201,255,0.25)',
                  }}
                >
                  <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>add</span>
                  </div>
                  Log Time
                </Link>
              </div>

              <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:text-on-surface hover:bg-[var(--white-alpha-5)] transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
                  My Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:text-error hover:bg-[var(--white-alpha-5)] transition-all w-full text-left"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 relative z-[1]">
        {children}
      </main>
    </div>
  )
}
