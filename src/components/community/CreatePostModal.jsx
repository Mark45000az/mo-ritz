import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import '../../styles/CreatePostModal.css'

export default function CreatePostModal({ isOpen, onClose, defaultType = 'fanart', onSuccess }) {
  const { currentUser, userProfile, isAdmin } = useAuth()
  const [type, setType] = useState(defaultType)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [submittedNotice, setSubmittedNotice] = useState(false)

  if (!isOpen) return null

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
      setImagePreview(compressed)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return
    if (!imagePreview) {
      setError('กรุณาเลือกรูปภาพผลงานหรือมีมที่จะส่ง')
      return
    }
    if (!title.trim()) {
      setError('กรุณาใส่ชื่อผลงาน')
      return
    }

    setUploading(true)
    setError('')

    try {
      const isAutoApprove = isAdmin
      const status = isAutoApprove ? 'approved' : 'pending'

      await addDoc(collection(firestore, 'community_posts'), {
        type,
        title: title.trim(),
        caption: caption.trim(),
        imageUrl: imagePreview,
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || 'สมาชิก',
        authorPhoto: userProfile?.photoURL || (isAdmin ? '/profile.jpg' : '/NewUserProfile.png'),
        authorRole: isAdmin ? 'admin' : (userProfile?.role || 'member'),
        status,
        likes: [],
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
      })

      if (!isAutoApprove) {
        setSubmittedNotice(true)
        setTimeout(() => {
          setSubmittedNotice(false)
          resetForm()
          onSuccess?.('ส่งผลงานเรียบร้อยแล้ว รอการตรวจสอบ')
          onClose()
        }, 1800)
      } else {
        resetForm()
        onSuccess?.('โพสต์ผลงานเรียบร้อยแล้ว ✓')
        onClose()
      }
    } catch (err) {
      console.error(err)
      setError('ส่งผลงานไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setCaption('')
    setImagePreview(null)
    setError('')
  }

  return (
    <div className="create-post-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="create-post-card" onClick={(e) => e.stopPropagation()}>
        <button className="create-post-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        <div className="create-post-header">
          <h3 className="create-post-title">
            {type === 'fanart' ? '🎨 ส่งแฟนอาร์ต' : '🎭 ส่งมีม'}
          </h3>
          <p className="create-post-subtitle">
            {!isAdmin
              ? 'ผลงานจะแสดงในห้องหลังจากผ่านการตรวจสอบและอนุมัติ'
              : 'โพสต์ในฐานะ Big Boss จะแสดงผลทันที'}
          </p>
        </div>

        {submittedNotice ? (
          <div className="create-post-success-notice">
            <div className="success-icon">✓</div>
            <h4>ส่งผลงานเรียบร้อย</h4>
            <p>ผลงานของคุณจะขึ้นแสดงหลังจากได้รับการตรวจสอบและอนุมัติ</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-post-form">
            {error && <div className="create-post-error">{error}</div>}

            {/* Type selector */}
            <div className="create-post-type-selector">
              <button
                type="button"
                className={`type-btn ${type === 'fanart' ? 'active' : ''}`}
                onClick={() => setType('fanart')}
              >
                🎨 แฟนอาร์ต
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'meme' ? 'active' : ''}`}
                onClick={() => setType('meme')}
              >
                🎭 มีม
              </button>
            </div>

            {/* Image upload area */}
            <div className="create-post-image-box">
              {imagePreview ? (
                <div className="create-post-preview-wrapper">
                  <img src={imagePreview} alt="Preview" className="create-post-preview-img" />
                  <button
                    type="button"
                    className="create-post-remove-img"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                    title="ลบรูปและเลือกใหม่"
                  >
                    ลบรูป ✕
                  </button>
                </div>
              ) : (
                <label className="create-post-upload-label">
                  <div className="upload-placeholder-content">
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">คลิกเพื่อเลือกรูปภาพผลงานหรือมีม</span>
                    <span className="upload-hint">รองรับ PNG, JPG, WebP</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {/* Title */}
            <div className="create-post-field">
              <label htmlFor="postTitle">ชื่อผลงาน / หัวข้อ *</label>
              <input
                id="postTitle"
                type="text"
                placeholder="เช่น ภาพวาดมอริทส์สุดเท่"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
              />
            </div>

            {/* Caption */}
            <div className="create-post-field">
              <label htmlFor="postCaption">คำอธิบายหรือความในใจ (ระบุหรือไม่ก็ได้)</label>
              <textarea
                id="postCaption"
                rows={3}
                placeholder="เขียนข้อความหรือช่องทางติดตามผลงาน..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={400}
              />
            </div>

            <div className="create-post-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={uploading}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={uploading}
              >
                {uploading ? 'กำลังประมวลผล...' : 'ส่งผลงาน'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

