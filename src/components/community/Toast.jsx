import { useEffect } from 'react'
import '../../styles/Toast.css'

export default function Toast({ show, message, type = 'success', onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose?.()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  if (!show) return null

  return (
    <div className={`toast-notification ${type}`}>
      <div className="toast-icon">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
        {type === 'heart' && '❤️'}
      </div>
      <span className="toast-message">{message}</span>
    </div>
  )
}

