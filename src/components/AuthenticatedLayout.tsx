import { Menu } from '@headlessui/react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { formatRelativeTime } from '../utils/dateUtils'
import { ChevronDownIcon } from './icons/ChevronDownIcon'

const HELP_WIKI_URL = import.meta.env.VITE_HELP_URL || 'https://github.com/mjaverto/yearbird/wiki'

interface AuthenticatedLayoutProps {
  onSignOut: () => void
  onRefresh: () => void
  isRefreshing: boolean
  lastUpdated: Date | null
  isFromCache: boolean
  error?: string | null
  toolbar?: ReactNode
  children: ReactNode
}

export function AuthenticatedLayout({
  onSignOut,
  onRefresh,
  isRefreshing,
  lastUpdated,
  isFromCache,
  error,
  toolbar,
  children,
}: AuthenticatedLayoutProps) {
  const menuItemClasses = (active: boolean, disabled = false) =>
    clsx(
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700',
      active && 'bg-zinc-50 text-zinc-900',
      disabled && 'opacity-60'
    )

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-zinc-950">
      <header className="relative z-30 flex flex-none items-center border-b border-zinc-200/60 bg-white/70 px-4 py-2 backdrop-blur">
        <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200/70 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-lg">🐦</span>
            <h1 className="text-base font-medium font-display text-zinc-900">Yearbird</h1>
            {error ? (
              <span
                className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-medium text-red-600"
                role="status"
                aria-live="polite"
              >
                {error}
              </span>
            ) : null}
          </div>

          <div className="h-5 w-px bg-zinc-200/80" aria-hidden="true" />

          {toolbar ? <div className="flex min-w-0 flex-1 items-center">{toolbar}</div> : null}

          <Menu as="div" className="relative z-30 shrink-0">
            <Menu.Button
              className="relative inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
              aria-label="Open settings menu"
            >
              <ChevronDownIcon className="h-4 w-4" />
              {error ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500"
                  aria-hidden="true"
                />
              ) : null}
            </Menu.Button>
            <Menu.Items className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg focus:outline-none">
              <div className="px-2 py-1 text-xs text-zinc-500">
                Settings ·{' '}
                {lastUpdated
                  ? `${isFromCache ? 'Cached' : 'Updated'}: ${formatRelativeTime(lastUpdated)}`
                  : 'No recent sync'}
              </div>
              <div className="my-2 border-t border-zinc-100" />
              <Menu.Item>
                {({ active }) => (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className={menuItemClasses(active, isRefreshing)}
                  >
                    <span className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true">
                      ↻
                    </span>
                    Refresh
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <a
                    href={HELP_WIKI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={menuItemClasses(active)}
                  >
                    Help
                  </a>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button type="button" onClick={onSignOut} className={menuItemClasses(active)}>
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      </header>

      <main className="relative z-0 flex-1 overflow-hidden bg-zinc-50/70">{children}</main>
    </div>
  )
}
