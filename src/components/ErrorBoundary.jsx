import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-red-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <p className="text-gray-300 text-sm">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-pokered text-white px-4 py-2 rounded-xl text-sm"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
