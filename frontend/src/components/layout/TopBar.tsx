export interface TopBarProps {
  onNavigateToProfile: () => void
}

export function TopBar({ onNavigateToProfile }: TopBarProps) {
  return (
    <header className="flex items-center justify-end gap-4 border-b border-outline-variant bg-surface px-8 py-4">
      <button
        type="button"
        aria-label="Profile"
        onClick={onNavigateToProfile}
        className="rounded p-2 text-on-surface-variant hover:bg-surface-container"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Notifications"
        className="rounded p-2 text-on-surface-variant hover:bg-surface-container"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2a6 6 0 0 0-6 6v3.5L4 15v1h16v-1l-2-3.5V8a6 6 0 0 0-6-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Search"
        className="rounded p-2 text-on-surface-variant hover:bg-surface-container"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container"
      >
        Deploy Pipeline
      </button>
    </header>
  )
}
