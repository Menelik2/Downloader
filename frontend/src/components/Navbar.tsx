import { useEffect, useState } from 'react'
import { Link, Menu, X, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '#home', label: 'Home' },
  { href: '#platforms', label: 'Supported Platforms' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#faq', label: 'FAQ' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#home" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Link className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg">
            Link<span className="text-brand-600 dark:text-brand-400">Fetch</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            className="rounded-lg p-2 text-muted md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'border-t border-border md:hidden',
          open ? 'block' : 'hidden'
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Mobile">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
