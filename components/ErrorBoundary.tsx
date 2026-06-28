'use client'

import React from 'react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#1a0a2e] px-4">
          <div className="max-w-md w-full rounded-2xl border border-yellow-600/30 bg-[#2a1a3e] p-8 text-center shadow-lg shadow-purple-900/20">
            {/* Error Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 border border-red-500/40">
              <svg
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h2 className="mb-2 text-xl font-bold text-yellow-400">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              An unexpected error occurred. You can try again or return to the
              home page.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mb-6 max-h-32 overflow-auto rounded-lg bg-[#1a0a2e] p-3 text-left text-xs text-red-300 border border-red-500/20">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-lg bg-yellow-600 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-yellow-500 cursor-pointer"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="rounded-lg border border-yellow-600/40 px-6 py-2.5 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-600/10"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
