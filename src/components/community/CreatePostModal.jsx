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
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState('image') // 'image' | 'video'
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [uploadMode, setUploadMode] = useState('file') // 'file' | 'link'
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [submittedNotice, setSubmittedNotice] = useState(false)

  if (!isOpen) return null

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    try {
      if (file.type.startsWith('video/')) {
        if (file.size > 20 * 1024 * 1024) {
          setError('ขนาดไฟล์วิดีโอต้องไม่เกิน 20MB หรือใช้การใส่ลิงก์วิดีโอแทน')
          return
        }
        setMediaType('video')
        const reader = new FileReader()
        reader.onload = () => {
          setMediaPreview(reader.result)
        }
        reader.readAsDataURL(file)
      } else if (file.type === 'image/gif') {
        if (file.size > 5 * 1024 * 1024) {
          setError('ขนาดไฟล์ GIF ต้องไม่เกิน 5MB')
          return
        }
        setMediaType('image')
        const reader = new FileReader()
        reader.onload = () => {
          setMediaPreview(reader.result)
        }
        reader.readAsDataURL(file)
      } else {
        setMediaType('image')
        const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
        setMediaPreview(compressed)
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message)
    }
  }

  const handleUseVideoLink = () => {
    if (!videoUrlInput.trim()) return
    const url = videoUrlInput.trim()
    setMediaType('video')
    setMediaPreview(url)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return
    if (!mediaPreview) {
      setError('กรุณาเลือกรูปภาพ วิดีโอ หรือระบุลิงก์ผลงานที่จะส่ง')
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
        imageUrl: mediaType === 'image' ? mediaPreview : null,
        videoUrl: mediaType === 'video' ? mediaPreview : null,
        mediaType,
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
    setMediaPreview(null)
    setMediaType('image')
    setVideoUrlInput('')
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
            {type === 'fanart' ? '🎨 ส่งแฟนอาร์ต (รูป/วิดีโอ)' : '🎭 ส่งมีม (รูป/วิดีโอ)'}
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

            {/* Upload mode tabs (File vs Video Link) */}
            <div className="media-mode-tabs">
              <button
                type="button"
                className={`media-tab-btn ${uploadMode === 'file' ? 'active' : ''}`}
                onClick={() => setUploadMode('file')}
              >
                📁 แนบไฟล์ (รูปภาพ / วิดีโอ)
              </button>
              <button
                type="button"
                className={`media-tab-btn ${uploadMode === 'link' ? 'active' : ''}`}
                onClick={() => setUploadMode('link')}
              >
                🔗 ลิงก์วิดีโอ (URL)
              </button>
            </div>

            {/* Media Upload Area */}
            {uploadMode === 'file' ? (
              <div className="create-post-image-box">
                {mediaPreview ? (
                  <div className="create-post-preview-wrapper">
                    {mediaType === 'video' ? (
                      <video
                        src={mediaPreview}
                        controls
                        className="create-post-preview-video"
                      />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="create-post-preview-img" />
                    )}
                    <button
                      type="button"
                      className="create-post-remove-img"
                      onClick={() => {
                        setMediaPreview(null)
                        setVideoUrlInput('')
                      }}
                      title="ลบและเลือกใหม่"
                    >
                      ลบสื่อ ✕
                    </button>
                  </div>
                ) : (
                  <label className="create-post-upload-label">
                    <div className="upload-placeholder-content">
                      <span className="upload-icon">🎬 / 📷</span>
                      <span className="upload-text">คลิกเพื่อเลือกรูปภาพหรือวิดีโอ</span>
                      <span className="upload-hint">รองรับ PNG, JPG, GIF, WebP, MP4, WebM (ไม่เกิน 20MB)</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="video-link-input-box">
                {mediaPreview ? (
                  <div className="create-post-preview-wrapper">
                    <video
                      src={mediaPreview}
                      controls
                      className="create-post-preview-video"
                    />
                    <button
                      type="button"
                      className="create-post-remove-img"
                      onClick={() => {
                        setMediaPreview(null)
                        setVideoUrlInput('')
                      }}
                    >
                      ลบลิงก์ ✕
                    </button>
                  </div>
                ) : (
                  <div className="link-input-row">
                    <input
                      type="url"
                      placeholder="ใส่ URL วิดีโอ เช่น https://example.com/video.mp4"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      className="video-url-field"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleUseVideoLink}
                      disabled={!videoUrlInput.trim()}
                    >
                      ใช้ลิงก์นี้
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div className="create-post-field">
              <label htmlFor="postTitle">ชื่อผลงาน / หัวข้อ *</label>
              <input
                id="postTitle"
                type="text"
                placeholder="เช่น ภาพวาดมอริทส์ หรือ วิดีโอมีมสุดปั่น"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
              />
            </div>

            {/* Caption */}
            <div className="create-post-field">
              <label htmlFor="postCaption">คำอธิบายเพิ่มเติม (ถ้ามี)</label>
              <textarea
                id="postCaption"
                placeholder="บอกเล่าเรื่องราวหรือที่มาของผลงานนี้..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>

            {/* Submit */}
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
                disabled={uploading || !mediaPreview || !title.trim()}
              >
                {uploading ? 'กำลังส่งผลงาน...' : 'ส่งผลงาน'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
