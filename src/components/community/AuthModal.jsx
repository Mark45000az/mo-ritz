import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/AuthModal.css'

export default function AuthModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/popup-closed-by-user') {
        setError('ยกเลิกการเข้าสู่ระบบ')
      } else {
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('กรุณากรอกชื่อที่ต้องการให้แสดง')
        }
        if (password.length < 6) {
          throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
        }
        await signupWithEmail(email, password, displayName.trim())
      } else {
        await loginWithEmail(email, password)
      }
      onClose()
    } catch (err) {
      console.error(err)
      let msg = err.message
      if (err.code === 'auth/email-already-in-use') {
        msg = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ'
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      } else if (err.code === 'auth/weak-password') {
        msg = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'รูปแบบอีเมลไม่ถูกต้อง'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        <div className="auth-modal-header">
          <div className="auth-modal-badge">Moritz Community</div>
          <h2 className="auth-modal-title">
            {isSignUp ? 'สร้างบัญชีสมาชิก' : 'เข้าสู่ระบบ'}
          </h2>
          <p className="auth-modal-subtitle">
            {isSignUp
              ? 'สมัครสมาชิกเพื่อส่งแฟนอาร์ต มีม แชทสด และพูดคุยกับเพื่อนๆ'
              : 'เข้าสู่ระบบเพื่อมีส่วนร่วมในคอมมูนิตี้'}
          </p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        {/* Google Login Button */}
        <button
          type="button"
          className="btn-google-login"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>

        <div className="auth-divider">
          <span>หรือใช้อีเมล</span>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailSubmit} className="auth-form">
          {isSignUp && (
            <div className="auth-field">
              <label htmlFor="displayName">ชื่อเล่น / Display Name</label>
              <input
                id="displayName"
                type="text"
                placeholder="เช่น คนรักมอริทส์"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={30}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">อีเมล</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              placeholder={isSignUp ? 'อย่างน้อย 6 ตัวอักษร' : 'กรอกรหัสผ่านของคุณ'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? 'กำลังดำเนินการ...' : isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="auth-footer-toggle">
          {isSignUp ? (
            <p>
              มีบัญชีอยู่แล้ว?{' '}
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => { setIsSignUp(false); setError('') }}
              >
                เข้าสู่ระบบที่นี่
              </button>
            </p>
          ) : (
            <p>
              ยังไม่มีบัญชี?{' '}
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => { setIsSignUp(true); setError('') }}
              >
                สมัครสมาชิกใหม่
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

