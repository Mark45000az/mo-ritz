import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { REPORT_REASONS } from '../../config/communityConfig'
import { checkRateLimit } from '../../lib/contentFilter'
import '../../styles/ReportModal.css'

export default function ReportModal({ isOpen, onClose, target }) {
  const { currentUser, userProfile } = useAuth()
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !target) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return

    // Rate limit: รายงาน ≥ 30 วินาที ต่อ 1 ครั้ง
    const rl = checkRateLimit(`report_${currentUser.uid}`, 30000)
    if (!rl.allowed) {
      setError(`กรุณารอ ${rl.remainingSec} วินาทีก่อนส่งรายงานถัดไป`)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await addDoc(collection(firestore, 'community_reports'), {
        targetId: target.id,
        targetType: target.type, // 'post' or 'comment'
        targetAuthorId: target.authorId || null,
        targetAuthorName: target.authorName || 'ไม่ระบุ',
        targetContent: target.content || target.title || '',
        targetImage: target.imageUrl || null,
        reason: selectedReason,
        details: details.trim(),
        reportedBy: currentUser.uid,
        reporterName: userProfile?.displayName || 'สมาชิก',
        reporterEmail: currentUser.email || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setDetails('')
        onClose()
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('ส่งรายงานไม่สำเร็จ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="report-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="report-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        <div className="report-modal-header">
          <div className="report-modal-icon">🚩</div>
          <h3 className="report-modal-title">รายงานเนื้อหาไม่เหมาะสม</h3>
          <p className="report-modal-subtitle">
            รายงานนี้จะถูกส่งไปยังผู้ดูแลระบบเพื่อตรวจสอบ
          </p>
        </div>

        {success ? (
          <div className="report-success-state">
            <div className="report-success-check">✓</div>
            <p>ส่งรายงานเรียบร้อย ขอบคุณที่ช่วยตรวจสอบ</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal-form">
            {error && <div className="report-error-banner">{error}</div>}

            <div className="report-field">
              <label>เลือกเหตุผลในการรายงาน:</label>
              <div className="report-reasons-list">
                {REPORT_REASONS.map((reason) => (
                  <label key={reason} className={`report-reason-option ${selectedReason === reason ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="report-field">
              <label htmlFor="reportDetails">รายละเอียดเพิ่มเติม (ระบุหรือไม่ก็ได้):</label>
              <textarea
                id="reportDetails"
                rows={3}
                placeholder="อธิบายเหตุการณ์หรือข้อมูลเพิ่มเติม..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={300}
              />
            </div>

            <div className="report-modal-buttons">
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
                {submitting ? 'กำลังส่งรายงาน...' : 'ส่งรายงาน'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

