import { useState, useEffect } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import '../../styles/UserProfileModal.css'

const COVER_PRESETS = [
  { id: 'indigo', name: 'อินดิโก้', gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)' },
  { id: 'sunset', name: 'ซันเซ็ต', gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 50%, #facc15 100%)' },
  { id: 'cyberpunk', name: 'ไซเบอร์', gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #d946ef 100%)' },
  { id: 'midnight', name: 'มิดไนท์', gradient: 'linear-gradient(135deg, #0f172a 0%, #312e81 50%, #1e1b4b 100%)' },
  { id: 'emerald', name: 'เอเมอรัลด์', gradient: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' },
  { id: 'rose', name: 'โรสการ์เดน', gradient: 'linear-gradient(135deg, #e11d48 0%, #be185d 50%, #831843 100%)' },
]

export default function UserProfileModal({ user, isOpen, onClose, onStartDM }) {
  const { currentUser, userProfile, updateUserProfile } = useAuth()
  const [liveUser, setLiveUser] = useState(user)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [newAvatar, setNewAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [coverGradient, setCoverGradient] = useState(COVER_PRESETS[0].gradient)
  const [coverImage, setCoverImage] = useState(null)
  const [statusMode, setStatusMode] = useState('online') // 'online' | 'offline'
  const [saving, setSaving] = useState(false)
  const [heartSaving, setHeartSaving] = useState(false)
  const [error, setError] = useState('')

  const targetUid = liveUser?.uid || liveUser?.id || user?.uid || user?.id
  const isOwnProfile = Boolean(currentUser?.uid && targetUid && currentUser.uid === targetUid)
  const isTargetAdmin = liveUser?.role === 'admin' || liveUser?.email === 'moritz2541@gmail.com'

  // Sync live user data from Firestore
  useEffect(() => {
    if (user) {
      setLiveUser(user)
      setCoverGradient(user.coverGradient || COVER_PRESETS[0].gradient)
      setCoverImage(user.coverImage || null)
      setStatusMode(user.statusMode || 'online')
    }
    if (!user?.uid && !user?.id) return
    const uid = user.uid || user.id
    const userRef = doc(firestore, 'users', uid)
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setLiveUser({ uid, ...data })
        if (data.coverGradient) setCoverGradient(data.coverGradient)
        if (data.coverImage !== undefined) setCoverImage(data.coverImage)
        if (data.statusMode) setStatusMode(data.statusMode)
      }
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (isOwnProfile && userProfile) {
      setDisplayName(userProfile.displayName || '')
      if (userProfile.coverGradient) setCoverGradient(userProfile.coverGradient)
      if (userProfile.coverImage !== undefined) setCoverImage(userProfile.coverImage)
      if (userProfile.statusMode) setStatusMode(userProfile.statusMode)
    }
  }, [isOwnProfile, userProfile])

  if (!isOpen || !user) return null

  const hearts = liveUser?.hearts || []
  const heartCount = hearts.length
  const hasHearted = currentUser && hearts.includes(currentUser.uid)
  const isVip = heartCount >= 5
  const isUserBanned = Boolean(liveUser?.isBanned)

  const displayedAvatar = isUserBanned
    ? '/BandAccount.png'
    : (avatarPreview ||
        (liveUser?.photoURL && (liveUser.photoURL !== '/profile.jpg' || isTargetAdmin)
          ? liveUser.photoURL
          : (isTargetAdmin ? '/profile.jpg' : '/NewUserProfile.png')))

  // Avatar upload handler (supports PNG, JPG, and animated GIF!)
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      if (file.type === 'image/gif') {
        if (file.size > 2.5 * 1024 * 1024) {
          setError('ขนาดไฟล์ GIF ต้องไม่เกิน 2.5MB')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          setNewAvatar(reader.result)
          setAvatarPreview(reader.result)
        }
        reader.readAsDataURL(file)
      } else {
        const compressed = await compressImage(file, { maxWidth: 280, maxHeight: 280, quality: 0.8 })
        setNewAvatar(compressed)
        setAvatarPreview(compressed)
      }
    } catch (err) {
      setError('อัปโหลดรูปไม่สำเร็จ: ' + err.message)
    }
  }

  // Cover image / GIF upload handler
  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (file.size > 3 * 1024 * 1024) {
      setError('ขนาดรูปหรือ GIF พื้นหลังต้องไม่เกิน 3MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCoverImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('ชื่อไม่สามารถเว้นว่างได้')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updates = {
        displayName: displayName.trim(),
        coverGradient,
        coverImage,
        statusMode,
      }
      if (newAvatar) {
        updates.photoURL = newAvatar
      }
      await updateUserProfile(updates)
      setLiveUser((prev) => ({ ...prev, ...updates }))
      setAvatarPreview(null)
      setNewAvatar(null)
      setEditing(false)
    } catch (err) {
      setError('บันทึกข้อมูลไม่สำเร็จ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleHeart = async () => {
    if (!currentUser || isOwnProfile || heartSaving) return
    setHeartSaving(true)
    try {
      const userRef = doc(firestore, 'users', targetUid)
      if (hasHearted) {
        await updateDoc(userRef, {
          hearts: arrayRemove(currentUser.uid),
        })
      } else {
        await updateDoc(userRef, {
          hearts: arrayUnion(currentUser.uid),
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setHeartSaving(false)
    }
  }

  // Cover style computation
  const activeCoverBg = coverImage
    ? `url(${coverImage}) center/cover no-repeat`
    : (liveUser?.coverGradient || coverGradient || COVER_PRESETS[0].gradient)

  const isOnline = liveUser?.statusMode !== 'offline'

  return (
    <div className="profile-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        {/* Customizable Cover Banner */}
        <div
          className="profile-modal-cover"
          style={{ background: activeCoverBg }}
        >
          {isOwnProfile && editing && (
            <div className="cover-edit-actions">
              <label className="cover-upload-btn" title="อัปโหลดรูปภาพหรือ GIF พื้นหลัง">
                🖼️ เปลี่ยนพื้นหลัง
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {coverImage && (
                <button
                  type="button"
                  className="cover-remove-btn"
                  onClick={() => setCoverImage(null)}
                  title="ใช้สี Gradient แทน"
                >
                  ✕ ลบรูป
                </button>
              )}
            </div>
          )}
        </div>

        <div className="profile-modal-body">
          {/* Avatar with GIF support and Banned Account badge */}
          <div className={`profile-modal-avatar-wrapper ${isUserBanned ? 'banned' : ''}`}>
            <img
              src={displayedAvatar}
              alt={liveUser?.displayName || 'User'}
              className="profile-modal-avatar"
            />
            {isOwnProfile && editing && !isUserBanned && (
              <label className="profile-avatar-upload-btn" title="เปลี่ยนรูปโปรไฟล์ (รองรับ GIF)">
                📷
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

          {error && <div className="profile-error-banner">{error}</div>}

          {!editing ? (
            <>
              <div className="profile-info-block">
                <div className="profile-name-row">
                  <h3 className="profile-display-name">{liveUser?.displayName || 'สมาชิก'}</h3>
                  {isTargetAdmin && (
                    <span className="profile-role-badge admin" title="ผู้ดูแลระบบ (Big Boss)">
                      👑 Big Boss
                    </span>
                  )}
                  {isVip && !isTargetAdmin && (
                    <span className="profile-role-badge vip" title="สมาชิกคนสำคัญ">
                      ⭐ คนสำคัญ ({heartCount})
                    </span>
                  )}
                  {isUserBanned && (
                    <span className="profile-role-badge banned">
                      🚫 {liveUser?.banType === 'mute' ? 'ถูกระงับการส่งข้อความ' : 'บัญชีถูกแบนถาวร'}
                    </span>
                  )}
                </div>

                {/* Online Status Pill */}
                <div className="profile-status-row">
                  <span className={`profile-status-pill ${isOnline ? 'online' : 'offline'}`}>
                    <span className="status-dot" />
                    {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
                  </span>

                  {/* Hearts Counter Pill */}
                  <div className="profile-hearts-badge">
                    <span>❤️ {heartCount} คนให้หัวใจ</span>
                  </div>
                </div>

                {liveUser?.email && isOwnProfile && (
                  <p className="profile-email-text">{liveUser.email}</p>
                )}
              </div>

              <div className="profile-modal-actions">
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setDisplayName(userProfile?.displayName || '')
                      setCoverGradient(userProfile?.coverGradient || COVER_PRESETS[0].gradient)
                      setCoverImage(userProfile?.coverImage || null)
                      setStatusMode(userProfile?.statusMode || 'online')
                      setEditing(true)
                    }}
                  >
                    ✏️ แก้ไขโปรไฟล์
                  </button>
                ) : (
                  <>
                    {currentUser && !liveUser?.isBanned && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          onClose()
                          onStartDM(liveUser)
                        }}
                      >
                        ✉️ ส่งข้อความส่วนตัว
                      </button>
                    )}
                    {currentUser && (
                      <button
                        type="button"
                        className={`btn-profile-heart ${hasHearted ? 'active' : ''}`}
                        onClick={handleToggleHeart}
                        disabled={heartSaving}
                        title={hasHearted ? 'ยกเลิกการให้หัวใจ' : 'ให้หัวใจโปรไฟล์นี้'}
                      >
                        {hasHearted ? '❤️ ให้หัวใจแล้ว' : '🤍 ให้หัวใจ'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSave} className="profile-edit-form">
              {/* Display Name */}
              <div className="profile-edit-field">
                <label htmlFor="editDisplayName">ชื่อเล่นที่ต้องการแสดง</label>
                <input
                  id="editDisplayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>

              {/* Cover Gradient Presets */}
              <div className="profile-edit-field">
                <label>เลือกสีพื้นหลังโปรไฟล์ (Cover Color):</label>
                <div className="cover-presets-row">
                  {COVER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`cover-preset-chip ${coverGradient === p.gradient && !coverImage ? 'active' : ''}`}
                      style={{ background: p.gradient }}
                      onClick={() => {
                        setCoverGradient(p.gradient)
                        setCoverImage(null)
                      }}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>

              {/* Online / Offline Status Toggle */}
              <div className="profile-edit-field">
                <label>สถานะการแสดงผล (ความเป็นส่วนตัว):</label>
                <div className="status-mode-options">
                  <button
                    type="button"
                    className={`status-mode-btn ${statusMode === 'online' ? 'active' : ''}`}
                    onClick={() => setStatusMode('online')}
                  >
                    <span className="status-indicator-dot online" />
                    <span>🟢 แสดงว่าออนไลน์</span>
                  </button>
                  <button
                    type="button"
                    className={`status-mode-btn ${statusMode === 'offline' ? 'active' : ''}`}
                    onClick={() => setStatusMode('offline')}
                  >
                    <span className="status-indicator-dot offline" />
                    <span>⚪ ซ่อนสถานะ (ออฟไลน์)</span>
                  </button>
                </div>
              </div>

              <div className="profile-edit-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditing(false)
                    setAvatarPreview(null)
                    setNewAvatar(null)
                    setError('')
                  }}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
