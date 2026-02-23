'use client'

import type { ReactNode } from 'react'
import { Component } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('UI error boundary caught an error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-textPrimary">
          <div className="max-w-md rounded-2xl border border-white/10 bg-surface p-6 text-center shadow-soft">
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="mt-2 text-sm text-textSecondary">Refresh the page or try again in a moment.</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
