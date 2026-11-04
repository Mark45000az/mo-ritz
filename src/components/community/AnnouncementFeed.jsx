import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'
import '../../styles/AnnouncementFeed.css'

// Discord-style full emoji palette (grouped)
const EMOJI_GROUPS = [
  { label: 'ความรู้สึก', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯'] },
  { label: 'ปฏิกิริยา', icon: '👍', emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '🫡', '🤔'] },
  { label: 'หน้าตา / ตลก', icon: '😂', emojis: ['😂', '🤣', '🥹', '😮', '🥰', '😎', '🤩', '🥳', '😴'] },
  { label: 'เศร้า / ร้องไห้', icon: '😢', emojis: ['😢', '😭', '🥺', '💔', '🥀', '😿', '😞', '😥', '😔', '💧'] },
  { label: 'สัญลักษณ์ / ไฮป์', icon: '🔥', emojis: ['🔥', '⚡', '🎉', '🎊', '✨', '💥', '🌟', '🚀', '📌'] },
]
const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis)

export default function AnnouncementFeed({ onSelectUser, onOpenAuth }) {
  const { currentUser, userProfile, isAdmin } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  // Compose state (admin only)
  const [composing, setComposing] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [composeImagePreviews, setComposeImagePreviews] = useState([]) // array of base64
  const [composeSending, setComposeSending] = useState(false)

  // Edit announcement state (admin only)
  const [editingAnnId, setEditingAnnId] = useState(null)
  const [editingAnnText, setEditingAnnText] = useState('')
  const [editingAnnSending, setEditingAnnSending] = useState(false)

  // Lightbox
  const [lightbox, setLightbox] = useState(null) // { images: [], index: 0 }

  // Reaction picker
  const [pickerPostId, setPickerPostId] = useState(null)
  const [pickerTab, setPickerTab] = useState(0)
  const pickerRef = useRef(null)

  // Toast & Confirm
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerPostId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft' && lightbox) setLightbox((l) => l ? { ...l, index: (l.index - 1 + l.images.length) % l.images.length } : null)
      if (e.key === 'ArrowRight' && lightbox) setLightbox((l) => l ? { ...l, index: (l.index + 1) % l.images.length } : null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])

  // Real-time listener
  useEffect(() => {
    setLoading(true)
    const q = query(
      collection(firestore, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(60)
    )
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  // ── Image picker (supports multi-image, max 4) ──────────────
  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 4 - composeImagePreviews.length
    const batch = files.slice(0, remaining)
    const previews = []
    for (const file of batch) {
      try {
        if (file.type === 'image/gif') {
          const data = await new Promise((res, rej) => {
            const r = new FileReader()
            r.onload = () => res(r.result)
            r.onerror = rej
            r.readAsDataURL(file)
          })
          previews.push(data)
        } else {
          const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
          previews.push(compressed)
        }
      } catch {
        setToast({ show: true, message: 'อ่านไฟล์ไม่สำเร็จ', type: 'error' })
      }
    }
    setComposeImagePreviews((prev) => [...prev, ...previews].slice(0, 4))
    e.target.value = ''
  }

  // ── Post announcement (admin only) ──────────────────────────
  const handlePost = async (e) => {
    e.preventDefault()
    if (!isAdmin) return
    if (!composeText.trim() && composeImagePreviews.length === 0) return
    setComposeSending(true)
    try {
      await addDoc(collection(firestore, 'announcements'), {
        text: composeText.trim(),
        images: composeImagePreviews,
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || 'Moritz',
        authorPhoto: userProfile?.photoURL || '/profile.jpg',
        reactions: {}, // { emoji: [uid, uid, ...] }
        createdAt: serverTimestamp(),
      })
      setComposeText('')
      setComposeImagePreviews([])
      setComposing(false)
      setToast({ show: true, message: 'โพสต์ประกาศเรียบร้อยแล้ว ✓', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'โพสต์ไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setComposeSending(false)
    }
  }

  // ── Edit announcement (admin only) ────────────────────────
  const handleStartEdit = (ann) => {
    setEditingAnnId(ann.id)
    setEditingAnnText(ann.text || '')
  }

  const handleSaveEdit = async (e, id) => {
    e.preventDefault()
    if (!isAdmin || !editingAnnText.trim() || editingAnnSending) return
    setEditingAnnSending(true)
    try {
      await updateDoc(doc(firestore, 'announcements', id), {
        text: editingAnnText.trim(),
        isEdited: true,
        editedAt: serverTimestamp(),
      })
      setEditingAnnId(null)
      setEditingAnnText('')
      setToast({ show: true, message: 'แก้ไขประกาศเรียบร้อยแล้ว ✓', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'แก้ไขไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setEditingAnnSending(false)
    }
  }

  // ── Delete announcement (admin only) ───────────────────────
  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'ลบประกาศ',
      message: 'คุณต้องการลบประกาศนี้ใช่หรือไม่?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firestore, 'announcements', id))
          setToast({ show: true, message: 'ลบประกาศเรียบร้อยแล้ว', type: 'info' })
        } catch (err) {
          setToast({ show: true, message: 'ลบไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      },
    })
  }

  // ── Toggle emoji reaction ───────────────────────────────────
  const handleReact = async (announcement, emoji) => {
    if (!currentUser) { onOpenAuth(); return }
    const current = announcement.reactions || {}
    const users = current[emoji] || []
    const hasReacted = users.includes(currentUser.uid)
    const updated = {
      ...current,
      [emoji]: hasReacted
        ? users.filter((u) => u !== currentUser.uid)
        : [...users, currentUser.uid],
    }
    // Clean up empty arrays
    if (updated[emoji]?.length === 0) delete updated[emoji]
    try {
      await updateDoc(doc(firestore, 'announcements', announcement.id), { reactions: updated })
    } catch (err) {
      setToast({ show: true, message: 'กดอิโมจิไม่สำเร็จ: ' + err.message, type: 'error' })
    }
    setPickerPostId(null)
  }

  const formatTime = (ts) => {
    if (!ts?.toDate) return 'เมื่อสักครู่'
    return ts.toDate().toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="announce-feed">
      {/* ── Header ── */}
      <div className="announce-header">
        <div className="announce-header-left">
          <span className="announce-header-icon">📢</span>
          <div>
            <h2 className="announce-header-title">ประกาศจาก Moritz</h2>
            <p className="announce-header-sub">ข่าวสาร อัปเดต และประกาศต่างๆ — กดอิโมจิเพื่อตอบสนอง</p>
          </div>
        </div>
        {isAdmin && (
          <button
            className="announce-compose-btn"
            onClick={() => setComposing(true)}
          >
            ✏️ โพสต์ประกาศ
          </button>
        )}
      </div>

      {/* ── Admin Compose Box ── */}
      {isAdmin && composing && (
        <div className="announce-compose-card">
          <div className="announce-compose-header">
            <img src={userProfile?.photoURL || '/profile.jpg'} alt="admin" className="announce-compose-avatar" />
            <span className="announce-compose-label">สร้างประกาศใหม่</span>
            <button className="announce-compose-close" onClick={() => { setComposing(false); setComposeText(''); setComposeImagePreviews([]) }}>✕</button>
          </div>
          <form onSubmit={handlePost} className="announce-compose-form">
            <textarea
              className="announce-compose-textarea"
              placeholder="พิมพ์ประกาศที่นี่... รองรับ emoji 🎉"
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              maxLength={2000}
              rows={4}
            />
            {/* Image previews */}
            {composeImagePreviews.length > 0 && (
              <div className="announce-compose-previews">
                {composeImagePreviews.map((src, i) => (
                  <div key={i} className="announce-compose-preview-wrapper">
                    <img src={src} alt={`preview ${i + 1}`} className="announce-compose-preview-img" />
                    <button
                      type="button"
                      className="announce-compose-preview-remove"
                      onClick={() => setComposeImagePreviews((prev) => prev.filter((_, idx) => idx !== i))}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="announce-compose-actions">
              <label className="announce-add-image-btn" title={`เพิ่มรูปภาพ (สูงสุด 4 ใบ, เหลือ ${4 - composeImagePreviews.length})`}>
                🖼️ เพิ่มรูป ({4 - composeImagePreviews.length} ที่เหลือ)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                  disabled={composeImagePreviews.length >= 4}
                />
              </label>
              <div className="announce-compose-submit-row">
                <button
                  type="button"
                  className="announce-btn-cancel"
                  onClick={() => { setComposing(false); setComposeText(''); setComposeImagePreviews([]) }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={composeSending || (!composeText.trim() && composeImagePreviews.length === 0)}
                >
                  {composeSending ? 'กำลังโพสต์...' : '📢 โพสต์ประกาศ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Feed ── */}
      <div className="announce-list">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="announce-skeleton">
              <div className="announce-skeleton-row">
                <div className="sk-line sk-avatar" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="sk-line sk-name" />
                  <div className="sk-line sk-time" />
                </div>
              </div>
              <div className="sk-line sk-body" />
              <div className="sk-line sk-body short" />
            </div>
          ))
        ) : announcements.length === 0 ? (
          <div className="announce-empty">
            <div className="announce-empty-icon">📭</div>
            <h3>ยังไม่มีประกาศ</h3>
            <p>Moritz จะโพสต์ข่าวสารและอัปเดตที่นี่</p>
          </div>
        ) : (
          announcements.map((ann) => {
            const reactions = ann.reactions || {}
            const reactionEntries = Object.entries(reactions).filter(([, uids]) => uids?.length > 0)
            const hasImages = ann.images?.length > 0

            return (
              <article key={ann.id} className="announce-card">
                {/* Card Header */}
                <div className="announce-card-header">
                  <img
                    src={ann.authorPhoto || '/profile.jpg'}
                    alt={ann.authorName}
                    className="announce-author-avatar"
                    onClick={() => onSelectUser({ uid: ann.authorId, displayName: ann.authorName, photoURL: ann.authorPhoto, role: 'admin' })}
                  />
                  <div className="announce-author-info">
                    <div className="announce-author-name-row">
                      <span
                        className="announce-author-name"
                        onClick={() => onSelectUser({ uid: ann.authorId, displayName: ann.authorName, photoURL: ann.authorPhoto, role: 'admin' })}
                      >
                        {ann.authorName}
                      </span>
                      <span className="announce-admin-pill">👑 Big Boss</span>
                    </div>
                    <span className="announce-timestamp">
                      {formatTime(ann.createdAt)}
                      {ann.isEdited && <span className="announce-edited-tag">(แก้ไขแล้ว)</span>}
                    </span>
                  </div>
                  {/* Admin action buttons */}
                  {isAdmin && (
                    <div className="announce-admin-actions">
                      <button
                        className="announce-action-btn edit"
                        onClick={() => handleStartEdit(ann)}
                        title="แก้ไขประกาศนี้"
                      >
                        ✏️
                      </button>
                      <button
                        className="announce-action-btn delete"
                        onClick={() => handleDelete(ann.id)}
                        title="ลบประกาศนี้"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Text or Inline Edit Form */}
                {editingAnnId === ann.id ? (
                  <div className="announce-inline-edit-box">
                    <textarea
                      className="announce-edit-textarea"
                      value={editingAnnText}
                      onChange={(e) => setEditingAnnText(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="แก้ไขข้อความประกาศ..."
                      autoFocus
                    />
                    <div className="announce-edit-actions">
                      <button
                        type="button"
                        className="announce-btn-cancel"
                        onClick={() => setEditingAnnId(null)}
                        disabled={editingAnnSending}
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => handleSaveEdit(e, ann.id)}
                        disabled={editingAnnSending || !editingAnnText.trim()}
                      >
                        {editingAnnSending ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                      </button>
                    </div>
                  </div>
                ) : (
                  ann.text && (
                    <div className="announce-card-text">{ann.text}</div>
                  )
                )}

                {/* Images */}
                {hasImages && (
                  <div className={`announce-images-grid count-${Math.min(ann.images.length, 4)}`}>
                    {ann.images.slice(0, 4).map((src, idx) => (
                      <div key={idx} className="announce-image-wrapper" onClick={() => setLightbox({ images: ann.images, index: idx })}>
                        <img src={src} alt={`ประกาศ #${idx + 1}`} className="announce-image" loading="lazy" />
                        {idx === 3 && ann.images.length > 4 && (
                          <div className="announce-image-more">+{ann.images.length - 4}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reactions footer */}
                <div className="announce-card-footer">
                  {/* Existing reactions */}
                  <div className="announce-reactions-row">
                    {reactionEntries.map(([emoji, uids]) => {
                      const mine = currentUser && uids.includes(currentUser.uid)
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className={`announce-reaction-pill ${mine ? 'active' : ''}`}
                          onClick={() => handleReact(ann, emoji)}
                          title={`${uids.length} คนกด`}
                        >
                          <span>{emoji}</span>
                          <span className="announce-reaction-count">{uids.length}</span>
                        </button>
                      )
                    })}

                    {/* Add reaction button */}
                    <div className="announce-reaction-add-wrapper" ref={pickerPostId === ann.id ? pickerRef : null}>
                      <button
                        type="button"
                        className="announce-add-reaction-btn"
                        onClick={() => setPickerPostId(pickerPostId === ann.id ? null : ann.id)}
                        title="เพิ่มอิโมจิ"
                      >
                        😀 +
                      </button>

                      {/* Full emoji picker */}
                      {pickerPostId === ann.id && (
                        <div className="announce-emoji-picker">
                          <div className="emoji-picker-header">
                            <span className="emoji-picker-title">เลือกอิโมจิ</span>
                            <button
                              type="button"
                              className="emoji-picker-close-btn"
                              onClick={() => setPickerPostId(null)}
                              aria-label="ปิด"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="emoji-picker-tabs">
                            {EMOJI_GROUPS.map((g, ti) => (
                              <button
                                key={ti}
                                type="button"
                                className={`emoji-tab-btn ${pickerTab === ti ? 'active' : ''}`}
                                onClick={() => setPickerTab(ti)}
                                title={g.label}
                              >
                                {g.icon || g.emojis[0]}
                              </button>
                            ))}
                          </div>
                          <div className="emoji-picker-label">{EMOJI_GROUPS[pickerTab]?.label}</div>
                          <div className="emoji-picker-grid">
                            {EMOJI_GROUPS[pickerTab]?.emojis.map((emoji) => {
                              const mine = currentUser && (ann.reactions?.[emoji] || []).includes(currentUser.uid)
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={`emoji-picker-cell ${mine ? 'active' : ''}`}
                                  onClick={() => handleReact(ann, emoji)}
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Read-only label for non-admin */}
                  {!isAdmin && (
                    <span className="announce-readonly-label">🔒 อ่านได้อย่างเดียว</span>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>

      {/* ── Image Lightbox ── */}
      {lightbox && (
        <div className="announce-lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="announce-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox.images.length > 1 && (
            <button
              className="announce-lightbox-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index - 1 + l.images.length) % l.images.length })) }}
            >‹</button>
          )}
          <img
            src={lightbox.images[lightbox.index]}
            alt="ขยายรูป"
            className="announce-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.images.length > 1 && (
            <button
              className="announce-lightbox-nav next"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => ({ ...l, index: (l.index + 1) % l.images.length })) }}
            >›</button>
          )}
          <div className="announce-lightbox-counter">{lightbox.index + 1} / {lightbox.images.length}</div>
        </div>
      )}

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  )
}

