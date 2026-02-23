'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-textPrimary">
      <div className="max-w-md rounded-2xl border border-white/10 bg-surface p-6 text-center shadow-soft">
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="mt-2 text-sm text-textSecondary">Try again or refresh the page.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-[10px] border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-textPrimary transition hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
