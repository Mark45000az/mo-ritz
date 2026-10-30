import { useState, useEffect } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import '../../styles/UserProfileModal.css'

export default function UserProfileModal({ user, isOpen, onClose, onStartDM }) {
  const { currentUser, userProfile, updateUserProfile } = useAuth()
  const [liveUser, setLiveUser] = useState(user)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [newAvatar, setNewAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [heartSaving, setHeartSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync live user data from Firestore
  useEffect(() => {
    if (user) {
      setLiveUser(user)
    }
    if (!user?.uid && !user?.id) return
    const uid = user.uid || user.id
    const userRef = doc(firestore, 'users', uid)
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setLiveUser({ uid, ...snap.data() })
      }
    })
    return () => unsub()
  }, [user])

  const targetUid = liveUser?.uid || liveUser?.id || user?.uid || user?.id
  const isOwnProfile = Boolean(currentUser?.uid && targetUid && currentUser.uid === targetUid)
  const isTargetAdmin = liveUser?.role === 'admin' || liveUser?.email === 'moritz2541@gmail.com'

  useEffect(() => {
    if (isOwnProfile && userProfile) {
      setDisplayName(userProfile.displayName || '')
    }
  }, [isOwnProfile, userProfile])

  if (!isOpen || !user) return null

  const hearts = liveUser?.hearts || []
  const heartCount = hearts.length
  const hasHearted = currentUser && hearts.includes(currentUser.uid)
  const isVip = heartCount >= 5

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError('')
      const compressed = await compressImage(file, { maxWidth: 240, maxHeight: 240, quality: 0.75 })
      setNewAvatar(compressed)
      setAvatarPreview(compressed)
    } catch (err) {
      setError(err.message)
    }
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
      const updates = { displayName: displayName.trim() }
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

  return (
    <div className="profile-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        <div className="profile-modal-cover" />

        <div className="profile-modal-body">
          {/* Avatar */}
          <div className="profile-modal-avatar-wrapper">
            <img
              src={avatarPreview || liveUser?.photoURL || '/profile.jpg'}
              alt={liveUser?.displayName || 'User'}
              className="profile-modal-avatar"
            />
            {isOwnProfile && editing && (
              <label className="profile-avatar-upload-btn" title="เปลี่ยนรูปโปรไฟล์">
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
                  {isVip && (
                    <span className="profile-role-badge vip" title="สมาชิกคนสำคัญ (ได้รับหัวใจมากกว่า 5 ครั้ง)">
                      ⭐ คนสำคัญ ({heartCount})
                    </span>
                  )}
                  {liveUser?.isBanned && (
                    <span className="profile-role-badge banned">
                      🚫 {liveUser?.banType === 'mute' ? 'ถูกระงับการส่งข้อความ' : 'ถูกแบนถาวร'}
                    </span>
                  )}
                </div>

                {/* Hearts Counter Pill */}
                <div className="profile-hearts-badge">
                  <span>❤️ {heartCount} คนให้หัวใจ</span>
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
