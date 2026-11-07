import { useState, useEffect } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage, uploadToStorage } from '../../lib/imageUpload'
import { getUserStatusText, isUserOnline } from '../../lib/presence'
import { isReservedName } from '../../lib/contentFilter'
import LikersModal from './LikersModal'
import '../../styles/UserProfileModal.css'

const COVER_PRESETS = [
  { id: 'indigo', name: 'อินดิโก้', gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)' },
  { id: 'sunset', name: 'ซันเซ็ต', gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 50%, #facc15 100%)' },
  { id: 'cyberpunk', name: 'ไซเบอร์', gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #d946ef 100%)' },
  { id: 'midnight', name: 'มิดไนท์', gradient: 'linear-gradient(135deg, #0f172a 0%, #312e81 50%, #1e1b4b 100%)' },
  { id: 'emerald', name: 'เอเมอรัลด์', gradient: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' },
  { id: 'rose', name: 'โรสการ์เดน', gradient: 'linear-gradient(135deg, #e11d48 0%, #be185d 50%, #831843 100%)' },
  { id: 'sakura', name: 'ดาร์กซากุระ', gradient: 'linear-gradient(135deg, #831843 0%, #db2777 50%, #f472b6 100%)' },
  { id: 'retrowave', name: 'เรโทรเวฟ', gradient: 'linear-gradient(135deg, #4c1d95 0%, #9333ea 50%, #06b6d4 100%)' },
  { id: 'goldensky', name: 'ประกายทอง', gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #fbbf24 100%)' },
  { id: 'deepocean', name: 'ดีฟโอเชียน', gradient: 'linear-gradient(135deg, #082f49 0%, #0284c7 50%, #38bdf8 100%)' },
]

const AVATAR_FRAMES = [
  { id: 'none', label: 'ธรรมดา', icon: '⚪' },
  { id: 'neon-purple', label: 'นีออนม่วง', icon: '💜' },
  { id: 'gold-flame', label: 'มงกุฎทอง', icon: '👑' },
  { id: 'cyber-cyan', label: 'ไซเบอร์ฟ้า', icon: '💎' },
  { id: 'sakura-pink', label: 'ซากุระชมพู', icon: '🌸' },
  { id: 'fire-red', label: 'ไฟร์เบลซ', icon: '🔥' },
]

const HOBBY_TAGS = [
  '🎮 ชอบเล่นเกม',
  '🎨 ชอบวาดรูป',
  '🎵 ชอบฟังเพลง',
  '🎬 สายดูคลิป',
  '☕ สายชิล',
  '🐾 คนรักสัตว์',
  '✨ ครีเอเตอร์',
  '📚 หนอนหนังสือ',
]

export default function UserProfileModal({ user, isOpen, onClose, onStartDM }) {
  const { currentUser, userProfile, updateUserProfile, isAdmin } = useAuth()
  const [liveUser, setLiveUser] = useState(user)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [bio, setBio] = useState(userProfile?.bio || '')
  const [hobbyTag, setHobbyTag] = useState(userProfile?.hobbyTag || '')
  const [avatarFrame, setAvatarFrame] = useState(userProfile?.avatarFrame || 'none')
  const [newAvatar, setNewAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [coverGradient, setCoverGradient] = useState(COVER_PRESETS[0].gradient)
  const [coverImage, setCoverImage] = useState(null)
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [statusMode, setStatusMode] = useState('online') // 'online' | 'offline'
  const [saving, setSaving] = useState(false)
  const [heartSaving, setHeartSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showLikersModal, setShowLikersModal] = useState(false)
  const [usersMap, setUsersMap] = useState({})

  const targetUid = liveUser?.uid || liveUser?.id || user?.uid || user?.id
  const isOwnProfile = Boolean(currentUser?.uid && targetUid && currentUser.uid === targetUid)
  const isTargetAdmin = liveUser?.role === 'admin' || liveUser?.email === 'moritz2541@gmail.com'

  // Fetch users directory for likers display
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'users'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => {
        map[d.id] = { uid: d.id, ...d.data() }
      })
      setUsersMap(map)
    })
    return () => unsub()
  }, [])

  // Sync live user data from Firestore
  useEffect(() => {
    if (user) {
      setLiveUser(user)
      setCoverGradient(user.coverGradient || COVER_PRESETS[0].gradient)
      setCoverImage(user.coverImage || null)
      setStatusMode(user.statusMode || 'online')
      setBio(user.bio || '')
      setHobbyTag(user.hobbyTag || '')
      setAvatarFrame(user.avatarFrame || 'none')
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
        if (data.bio !== undefined) setBio(data.bio)
        if (data.hobbyTag !== undefined) setHobbyTag(data.hobbyTag)
        if (data.avatarFrame) setAvatarFrame(data.avatarFrame)
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
      if (userProfile.bio !== undefined) setBio(userProfile.bio)
      if (userProfile.hobbyTag !== undefined) setHobbyTag(userProfile.hobbyTag)
      if (userProfile.avatarFrame) setAvatarFrame(userProfile.avatarFrame)
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

  // Cover image / GIF upload handler (with Firebase Storage auto-upload & size safety)
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setCoverUploading(true)
    try {
      // 1. ลองอัปโหลดขึ้น Firebase Storage ก่อน (ถ้าพร้อมใช้งาน)
      if (currentUser?.uid) {
        try {
          const ext = file.name ? file.name.split('.').pop() : (file.type === 'image/gif' ? 'gif' : 'png')
          const path = `covers/${currentUser.uid}_${Date.now()}.${ext}`
          const downloadUrl = await uploadToStorage(file, path)
          setCoverImage(downloadUrl)
          setCoverUrlInput('')
          setCoverUploading(false)
          return
        } catch (storageErr) {
          console.warn('[handleCoverUpload] Storage upload fallback to local data URL:', storageErr.message)
        }
      }

      // 2. ถ้า Storage ไม่ผ่าน (fallback) ให้เก็บเป็น Data URL
      if (file.type === 'image/gif') {
        // Firestore จำกัดขนาดเอกสารไว้ที่ 1MB (1,048,576 bytes)
        // เมื่อแปลงเป็น Base64 จะเพิ่มขึ้น 1.33 เท่า ดังนั้นขนาดไฟล์ GIF ไม่ควรเกิน ~800KB
        if (file.size > 800 * 1024) {
          setError(`ไฟล์ GIF นี้มีขนาด ${(file.size / (1024 * 1024)).toFixed(1)}MB ซึ่งเกินขีดจำกัดความจุ 800KB ของฐานข้อมูล แนะนำให้ใช้ไฟล์ GIF ขนาดไม่เกิน 800KB หรือคัดลอกลิงก์ GIF จากเว็บมาวางในช่องด้านล่างแทน`)
          setCoverUploading(false)
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          setCoverImage(reader.result)
          setCoverUrlInput('')
          setCoverUploading(false)
        }
        reader.readAsDataURL(file)
      } else {
        const compressed = await compressImage(file, { maxWidth: 960, maxHeight: 450, quality: 0.82 })
        setCoverImage(compressed)
        setCoverUrlInput('')
        setCoverUploading(false)
      }
    } catch (err) {
      setError('อัปโหลดรูปพื้นหลังไม่สำเร็จ: ' + err.message)
      setCoverUploading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('ชื่อไม่สามารถเว้นว่างได้')
      return
    }

    // ป้องกันการแอบอ้างเป็น admin (ยกเว้นตัว admin เอง)
    const targetIsAdmin = liveUser?.role === 'admin' || liveUser?.email === 'moritz2541@gmail.com'
    if (!targetIsAdmin && !isAdmin && isReservedName(displayName.trim())) {
      setError('ชื่อนี้ไม่สามารถใช้ได้ เนื่องจากเป็นชื่อสงวนของระบบหรือ admin')
      return
    }

    // ตรวจสอบขนาด Data URLs รวมไม่ให้เกินขีดจำกัด 1MB ของ Firestore
    let estimatedSize = 0
    if (coverImage && coverImage.startsWith('data:')) {
      estimatedSize += coverImage.length
    }
    if (newAvatar && newAvatar.startsWith('data:')) {
      estimatedSize += newAvatar.length
    }
    if (estimatedSize > 950 * 1024) {
      setError('รูปภาพที่เลือกมีขนาดรวมใหญ่เกินไปสำหรับฐานข้อมูล (เกิน 1MB) กรุณาใช้ไฟล์รูปที่ขนาดเล็กลง หรือใช้วิธีวางลิงก์ URL แทน')
      return
    }

    setSaving(true)
    setError('')
    try {
      const updates = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        hobbyTag,
        avatarFrame,
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
      setSuccessMsg('บันทึกการแก้ไขโปรไฟล์เรียบร้อยแล้ว ✓')
      setTimeout(() => setSuccessMsg(''), 3500)
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

  // Cover computation (supports live animated GIF)
  const currentCoverImage = isOwnProfile && editing
    ? coverImage
    : (liveUser?.coverImage || null)
  const currentCoverGradient = isOwnProfile && editing
    ? coverGradient
    : (liveUser?.coverGradient || coverGradient || COVER_PRESETS[0].gradient)

  // Real-time Presence Computation
  const statusDisplay = getUserStatusText(liveUser)
  const isOnline = isUserOnline(liveUser)

  const currentFrame = isOwnProfile && editing
    ? avatarFrame
    : (liveUser?.avatarFrame || 'none')

  return (
    <div className="profile-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>

        {/* Customizable Cover Banner (Uses <img> for guaranteed animated GIF playback) */}
        <div
          className="profile-modal-cover"
          style={{ background: !currentCoverImage ? currentCoverGradient : '#0a0a10' }}
        >
          {currentCoverImage && (
            <img
              src={currentCoverImage}
              alt="Profile Cover"
              className="profile-modal-cover-img"
            />
          )}
          {isOwnProfile && editing && (
            <div className="cover-edit-actions">
              <label className="cover-upload-btn" title="อัปโหลดรูปภาพหรือ GIF พื้นหลัง">
                {coverUploading ? '⏳ กำลังอัปโหลด...' : '🖼️ เปลี่ยนพื้นหลัง'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                  disabled={coverUploading}
                />
              </label>
              {coverImage && (
                <button
                  type="button"
                  className="cover-remove-btn"
                  onClick={() => {
                    setCoverImage(null)
                    setCoverUrlInput('')
                  }}
                  title="ใช้สี Gradient แทน"
                >
                  ✕ ลบรูป
                </button>
              )}
            </div>
          )}
        </div>

        <div className="profile-modal-body">
          {/* Avatar with Custom Frame, GIF support and Banned Account badge */}
          <div className={`profile-modal-avatar-wrapper frame-${currentFrame} ${isUserBanned ? 'banned' : ''}`}>
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
          {successMsg && <div className="profile-success-banner">{successMsg}</div>}

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

                {/* Bio / About text if present */}
                {liveUser?.bio && (
                  <p className="profile-bio-text">{liveUser.bio}</p>
                )}

                {/* Status and Hobby row */}
                <div className="profile-status-row">
                  <span className={`profile-status-pill ${isOnline ? 'online' : 'offline'}`}>
                    <span className="status-dot" />
                    {statusDisplay}
                  </span>

                  {liveUser?.hobbyTag && (
                    <span className="profile-hobby-pill">
                      {liveUser.hobbyTag}
                    </span>
                  )}

                  {/* Hearts Counter Pill (Only owner can click to view likers list) */}
                  {isOwnProfile ? (
                    <button
                      type="button"
                      className="profile-hearts-badge clickable"
                      onClick={() => setShowLikersModal(true)}
                      title="คลิกเพื่อดูรายชื่อคนที่ให้หัวใจโปรไฟล์คุณ"
                    >
                      <span>❤️ {heartCount} คนให้หัวใจ</span>
                      <span className="profile-hearts-view-hint">👁️ ดูรายชื่อ</span>
                    </button>
                  ) : (
                    <div className="profile-hearts-badge" title={`มีคนให้หัวใจโปรไฟล์นี้ ${heartCount} คน`}>
                      <span>❤️ {heartCount} คนให้หัวใจ</span>
                    </div>
                  )}
                </div>

                {liveUser?.email && isOwnProfile && (
                  <p className="profile-email-text">{liveUser.email}</p>
                )}
              </div>

              <div className="profile-modal-actions">
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="btn-edit-profile-trigger"
                    onClick={() => {
                      setDisplayName(userProfile?.displayName || '')
                      setBio(userProfile?.bio || '')
                      setHobbyTag(userProfile?.hobbyTag || '')
                      setAvatarFrame(userProfile?.avatarFrame || 'none')
                      setCoverGradient(userProfile?.coverGradient || COVER_PRESETS[0].gradient)
                      setCoverImage(userProfile?.coverImage || null)
                      setCoverUrlInput(userProfile?.coverImage && (userProfile.coverImage.startsWith('http://') || userProfile.coverImage.startsWith('https://')) ? userProfile.coverImage : '')
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

              {/* Bio / Status Message */}
              <div className="profile-edit-field">
                <label htmlFor="editBio">คำอธิบายตัวเอง / ข้อความประจำตัว (Bio):</label>
                <input
                  id="editBio"
                  type="text"
                  placeholder="เช่น สตรีมเมอร์สายฮา / ยินดีที่ได้รู้จักทุกคน ✨"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={120}
                />
              </div>

              {/* Avatar Frame / Aura */}
              <div className="profile-edit-field">
                <label>กรอบรูปโปรไฟล์ & แสงออร่า (Avatar Frame):</label>
                <div className="avatar-frames-grid">
                  {AVATAR_FRAMES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`avatar-frame-btn ${avatarFrame === f.id ? 'active' : ''}`}
                      onClick={() => setAvatarFrame(f.id)}
                    >
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hobby Tag */}
              <div className="profile-edit-field">
                <label>สิ่งที่ชอบ / สไตล์ของคุณ (Tag):</label>
                <div className="hobby-tags-row">
                  {HOBBY_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`hobby-tag-btn ${hobbyTag === tag ? 'active' : ''}`}
                      onClick={() => setHobbyTag(hobbyTag === tag ? '' : tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Gradient Presets */}
              <div className="profile-edit-field">
                <label>เลือกสีพื้นหลังโปรไฟล์ (10 โทนสี หรือกดปุ่มเปลี่ยนพื้นหลังด้านบน):</label>
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
                        setCoverUrlInput('')
                      }}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>

              {/* Cover Image / GIF via URL (No size limit!) */}
              <div className="profile-edit-field">
                <label htmlFor="coverUrlInput">หรือใส่ลิงก์รูปภาพ / GIF พื้นหลัง (URL จากเว็บ):</label>
                <div className="cover-url-input-row">
                  <input
                    id="coverUrlInput"
                    type="url"
                    placeholder="https://... วางลิงก์รูปภาพ หรือ GIF จากเว็บ"
                    value={coverUrlInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setCoverUrlInput(val)
                      if (val.trim()) {
                        setCoverImage(val.trim())
                      }
                    }}
                    className="cover-url-input"
                  />
                  {coverImage && (
                    <button
                      type="button"
                      className="cover-url-clear-btn"
                      onClick={() => {
                        setCoverUrlInput('')
                        setCoverImage(null)
                      }}
                      title="ลบรูปพื้นหลัง"
                    >
                      ✕ ลบ
                    </button>
                  )}
                </div>
                <span className="profile-field-hint">
                  💡 แนะนำ: สามารถคลิกขวาที่ภาพ GIF บนเว็บ แล้วเลือก "คัดลอกที่อยู่รูปภาพ" (Copy image address) มาวางได้ ไม่จำกัดขนาดไฟล์!
                </span>
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

      {/* Profile Likers Modal (Owner only) */}
      {isOwnProfile && (
        <LikersModal
          isOpen={showLikersModal}
          likes={hearts}
          title={`คนที่ให้หัวใจโปรไฟล์ของคุณ (${heartCount} คน)`}
          usersMap={usersMap}
          onClose={() => setShowLikersModal(false)}
          onSelectUser={(u) => {
            setShowLikersModal(false)
            setLiveUser(u)
          }}
        />
      )}
    </div>
  )
}
