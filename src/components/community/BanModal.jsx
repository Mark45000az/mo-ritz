import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import '../../styles/BanModal.css'

export default function BanModal({ isOpen, onClose, targetUser, onSuccess }) {
  const [banType, setBanType] = useState('mute') // 'mute' | 'ban'
  const [reason, setReason] = useState('ข้อความคุกคาม / หยาบคาย')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !targetUser) return null

  const handleConfirm = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const finalReason = reason === 'อื่นๆ' ? (customReason.trim() || 'ไม่ระบุเหตุผล') : reason

    try {
      const userRef = doc(firestore, 'users', targetUser.id || targetUser.uid)
      await updateDoc(userRef, {
        isBanned: true,
        banType,
        banReason: finalReason,
        bannedAt: serverTimestamp(),
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
            <img
              src={targetUser.photoURL || (targetUser.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png')}
              alt={targetUser.displayName}
            />
            <span>{targetUser.displayName || 'สมาชิก'}</span>
          </div>
        </div>

        {error && <div className="ban-modal-error">{error}</div>}

        <form onSubmit={handleConfirm} className="ban-modal-form">
          {/* Level Selector */}
          <div className="ban-field">
            <label>เลือกระดับบทลงโทษ:</label>
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
                  <div className="ban-type-desc">ตัดสิทธิ์การใช้งานบัญชีนี้ทั้งหมดทันที</div>
                </div>
              </label>
            </div>
          </div>

          {/* Reason Selector */}
          <div className="ban-field">
            <label htmlFor="banReason">เหตุผลในการระงับ:</label>
            <select
              id="banReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="ban-select"
            >
              <option value="ข้อความคุกคาม / หยาบคาย">ข้อความคุกคาม / หยาบคาย</option>
              <option value="สแปม / โฆษณา">สแปม / โฆษณา</option>
              <option value="เนื้อหาไม่เหมาะสม / 18+">เนื้อหาไม่เหมาะสม / 18+</option>
              <option value="ละเมิดกฎคอมมูนิตี้">ละเมิดกฎคอมมูนิตี้</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
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
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-danger btn-sm"
              disabled={submitting}
            >
              {submitting ? 'กำลังดำเนินการ...' : banType === 'ban' ? 'ยืนยันการแบนถาวร' : 'ยืนยันการระงับ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

