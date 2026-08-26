import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, Github, Layers, Home, FolderKanban, GitPullRequest, Compass, Settings } from 'lucide-react';
import { WalletButton } from './WalletButton';
import { ModeIndicator, NetworkIndicator } from './ModeIndicator';
import { useApp } from '../store/app-context';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/contributions', label: 'Contributions', icon: GitPullRequest },
  { to: '/explore', label: 'Explore', icon: Compass },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="h-7 w-7 rounded-lg bg-ink-900 flex items-center justify-center">
                <Layers className="h-4 w-4 text-brand-400" />
              </div>
              <span className="font-semibold text-ink-900 text-[15px] tracking-tight">BuildShare</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'text-ink-900 bg-ink-100' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-50'
                    }`
                  }
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <NetworkIndicator />
                <ModeIndicator compact />
              </div>
              <WalletButton />
              <button
                className="md:hidden p-2 rounded-lg text-ink-500 hover:bg-ink-100"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-ink-200 bg-white animate-fade-in">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive ? 'text-ink-900 bg-ink-100' : 'text-ink-600 hover:bg-ink-50'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <div className="flex items-center gap-2 px-3 py-2">
                <NetworkIndicator />
                <ModeIndicator compact />
              </div>
              <NavLink to="/settings" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-50">
                <Settings className="h-4 w-4" /> Settings
              </NavLink>
              <NavLink to="/settings/github" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-50">
                <Github className="h-4 w-4" /> GitHub
              </NavLink>
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-ink-900 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <span className="text-sm font-semibold text-ink-900">BuildShare</span>
              <span className="text-xs text-ink-400 ml-2">v0.1 · {mode === 'demo' ? 'Demo' : 'Live'}</span>
            </div>
            <p className="text-xs text-ink-400 max-w-xl">
              BuildShare is a technical prototype for contribution-based project ownership and governance. It does not constitute an offer of securities or investment advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
