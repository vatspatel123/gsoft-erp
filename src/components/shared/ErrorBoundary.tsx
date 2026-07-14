import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fdf8ff',
          fontFamily: "'DM Sans', sans-serif",
          padding: '40px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1a0a2e',
            marginBottom: '8px',
            margin: '0 0 8px'
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '24px',
            textAlign: 'center',
            maxWidth: '360px'
          }}>
            Please restart the application. Your data is safe.
          </p>
          {this.state.error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '12px',
              color: '#ef4444',
              fontFamily: "'DM Mono', monospace",
              marginBottom: '24px',
              maxWidth: '480px',
              wordBreak: 'break-word'
            }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#9333ea',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Restart App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
