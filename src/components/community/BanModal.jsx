import { useState } from 'react'
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import '../../styles/BanModal.css'

const BAN_REASONS = [
  { id: 'harassment', label: 'ข้อความคุกคาม / หยาบคาย', icon: '🤬' },
  { id: 'spam', label: 'สแปม / โฆษณา', icon: '📢' },
  { id: 'nsfw', label: 'เนื้อหาไม่เหมาะสม / 18+', icon: '🔞' },
  { id: 'rules', label: 'ละเมิดกฎคอมมูนิตี้', icon: '⚖️' },
  { id: 'other', label: 'อื่นๆ', icon: '📝' },
]

const MUTE_DURATIONS = [
  { id: '1h', label: '1 ชั่วโมง', hours: 1 },
  { id: '24h', label: '24 ชั่วโมง (1 วัน)', hours: 24 },
  { id: '3d', label: '3 วัน', hours: 72 },
  { id: '7d', label: '7 วัน', hours: 168 },
  { id: '30d', label: '30 วัน', hours: 720 },
  { id: 'indefinite', label: 'จนกว่าจะปลดแบน', hours: null },
]

export default function BanModal({ isOpen, onClose, targetUser, onSuccess }) {
  const [banType, setBanType] = useState('mute') // 'mute' | 'ban'
  const [reason, setReason] = useState('ข้อความคุกคาม / หยาบคาย')
  const [customReason, setCustomReason] = useState('')
  const [duration, setDuration] = useState('24h')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !targetUser) return null

  const targetAvatar = targetUser.isBanned
    ? '/BandAccount.png'
    : (targetUser.photoURL || (targetUser.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'))

  const handleConfirm = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const finalReason = reason === 'อื่นๆ' ? (customReason.trim() || 'ไม่ระบุเหตุผล') : reason

    // Calculate duration timestamp
    let bannedUntil = null
    if (banType === 'mute') {
      const selectedDur = MUTE_DURATIONS.find((d) => d.id === duration)
      if (selectedDur && selectedDur.hours) {
        const ms = Date.now() + selectedDur.hours * 60 * 60 * 1000
        bannedUntil = Timestamp.fromMillis(ms)
      }
    }

    try {
      const userRef = doc(firestore, 'users', targetUser.id || targetUser.uid)
      await updateDoc(userRef, {
        isBanned: true,
        banType,
        banReason: finalReason,
        bannedAt: serverTimestamp(),
        bannedUntil,
        banDuration: banType === 'mute' ? duration : 'permanent',
      })

      onSuccess?.(banType === 'ban' ? 'แบนสมาชิกถาวรเรียบร้อยแล้ว' : 'ระงับการใช้งานชั่วคราวเรียบร้อยแล้ว')
      onClose()
    } catch (err) {
      console.error(err)
      setError('ดำเนินการไม่สำเร็จ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ban-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ban-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="ban-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        <div className="ban-modal-header">
          <div className="ban-modal-icon">⚖️</div>
          <h3 className="ban-modal-title">จัดการระงับผู้ใช้งาน</h3>
          <div className="ban-target-user-pill">
            <img src={targetAvatar} alt={targetUser.displayName} />
            <span>{targetUser.displayName || 'สมาชิก'}</span>
            {targetUser.email && <span className="ban-user-email">({targetUser.email})</span>}
          </div>
        </div>

        {error && <div className="ban-modal-error">{error}</div>}

        <form onSubmit={handleConfirm} className="ban-modal-form">
          {/* Level Selector */}
          <div className="ban-field">
            <label className="ban-field-label">เลือกระดับบทลงโทษ:</label>
            <div className="ban-type-options">
              <label className={`ban-type-card ${banType === 'mute' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="banType"
                  value="mute"
                  checked={banType === 'mute'}
                  onChange={() => setBanType('mute')}
                />
                <div className="ban-type-text">
                  <div className="ban-type-title">⚠️ ระงับการใช้งานชั่วคราว (Mute)</div>
                  <div className="ban-type-desc">ยังสามารถเข้าดูเนื้อหาได้ แต่ไม่สามารถพิมพ์แชท ส่งแฟนอาร์ต หรือคอมเมนต์ได้</div>
                </div>
              </label>

              <label className={`ban-type-card danger ${banType === 'ban' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="banType"
                  value="ban"
                  checked={banType === 'ban'}
                  onChange={() => setBanType('ban')}
                />
                <div className="ban-type-text">
                  <div className="ban-type-title">🚫 แบนถาวร (Permanent Ban)</div>
                  <div className="ban-type-desc">ตัดสิทธิ์การใช้งานบัญชีนี้ทั้งหมดทันที และรูปโปรไฟล์จะเปลี่ยนเป็นไอคอนแบน</div>
                </div>
              </label>
            </div>
          </div>

          {/* Duration Selector for Mute */}
          {banType === 'mute' && (
            <div className="ban-field">
              <label className="ban-field-label">ระยะเวลาการระงับ:</label>
              <div className="ban-durations-grid">
                {MUTE_DURATIONS.map((dur) => (
                  <button
                    key={dur.id}
                    type="button"
                    className={`ban-duration-chip ${duration === dur.id ? 'active' : ''}`}
                    onClick={() => setDuration(dur.id)}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason Selector - Stylish Custom List instead of unstyled browser select */}
          <div className="ban-field">
            <label className="ban-field-label">เหตุผลในการระงับ:</label>
            <div className="ban-reasons-list">
              {BAN_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`ban-reason-btn ${reason === r.label ? 'active' : ''}`}
                  onClick={() => setReason(r.label)}
                >
                  <span className="ban-reason-icon">{r.icon}</span>
                  <span className="ban-reason-text">{r.label}</span>
                  {reason === r.label && <span className="ban-reason-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {reason === 'อื่นๆ' && (
            <div className="ban-field">
              <input
                type="text"
                placeholder="ระบุเหตุผลเพิ่มเติม..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={100}
                required
                className="ban-input"
              />
            </div>
          )}

          <div className="ban-modal-actions">
            <button
              type="button"
              className="ban-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className={`ban-btn-submit ${banType === 'ban' ? 'danger' : 'warn'}`}
              disabled={submitting}
            >
              {submitting ? 'กำลังดำเนินการ...' : banType === 'ban' ? '🚫 ยืนยันการแบนถาวร' : '⚠️ ยืนยันการระงับ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
