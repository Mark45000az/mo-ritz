import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#fff',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
            เกิดข้อผิดพลาดในการโหลดคอมมูนิตี้
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#a1a1aa',
              maxWidth: '440px',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}
          >
            {this.state.error?.message || 'ระบบกำลังรีสตาร์ทข้อมูล'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.hash = ''
                window.location.reload()
              }}
              style={{
                padding: '10px 22px',
                background: '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
              }}
            >
              🔄 รีโหลดหน้าเว็บ
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.hash = ''
              }}
              style={{
                padding: '10px 22px',
                background: '#27272a',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
              }}
            >
              🏠 กลับหน้าแรก
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

