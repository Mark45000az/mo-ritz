import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { CHANNELS } from '../../config/communityConfig'
import GeneralChat from './GeneralChat'
import PostFeed from './PostFeed'
import DirectMessages from './DirectMessages'
import AdminPanel from './AdminPanel'
import AuthModal from './AuthModal'
import UserProfileModal from './UserProfileModal'
import CreatePostModal from './CreatePostModal'
import ReportModal from './ReportModal'
import Toast from './Toast'
import '../../styles/CommunityLayout.css'

export default function CommunityLayout({ onBackToHome }) {
  const { currentUser, userProfile, isAdmin, logout } = useAuth()
  const [activeChannel, setActiveChannel] = useState('general')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalUser, setProfileModalUser] = useState(null)
  const [createPostType, setCreatePostType] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [dmTargetUser, setDmTargetUser] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Admin notification badge counter
  const [adminBadgeCount, setAdminBadgeCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return

    let pendingPostsCount = 0
    let pendingReportsCount = 0

    const unsubPosts = onSnapshot(
      query(collection(firestore, 'community_posts'), where('status', '==', 'pending')),
      (snap) => {
        pendingPostsCount = snap.size
        setAdminBadgeCount(pendingPostsCount + pendingReportsCount)
      },
      (err) => console.warn('[CommunityLayout] pending posts error:', err)
    )

    const unsubReports = onSnapshot(
      query(collection(firestore, 'community_reports'), where('status', '==', 'pending')),
      (snap) => {
        pendingReportsCount = snap.size
        setAdminBadgeCount(pendingPostsCount + pendingReportsCount)
      },
      (err) => console.warn('[CommunityLayout] pending reports error:', err)
    )

    return () => {
      unsubPosts()
      unsubReports()
    }
  }, [isAdmin])

  const handleStartDM = (user) => {
    setDmTargetUser(user)
    setActiveChannel('dms')
    setMobileSidebarOpen(false)
  }

  const handleSelectChannel = (id) => {
    setActiveChannel(id)
    setMobileSidebarOpen(false)
  }

  return (
    <div className="community-wrapper">
      {/* Sidebar */}
      <aside className={`community-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        {/* Server Header */}
        <div className="community-server-header">
          <div className="server-avatar-circle">M</div>
          <div className="server-info">
            <h1 className="server-name">Moritz Community</h1>
            <span className="server-status-pill">
              <span className="status-dot-pulse" />
              ออนไลน์
            </span>
          </div>
          <button
            className="btn-back-home"
            onClick={onBackToHome}
            title="กลับสู่หน้าโปรไฟล์หลัก"
          >
            🏠
          </button>
        </div>

        {/* Channels List */}
        <div className="community-channels-list">
          <div className="channel-category-label">📢 ห้องพูดคุย</div>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              className={`channel-btn ${activeChannel === ch.id ? 'active' : ''}`}
              onClick={() => handleSelectChannel(ch.id)}
            >
              <span className="channel-icon">{ch.icon}</span>
              <span className="channel-name">{ch.name}</span>
            </button>
          ))}

          {/* Admin Channel */}
          {isAdmin && (
            <>
              <div className="channel-category-label admin-label">👑 Big Boss</div>
              <button
                className={`channel-btn admin-channel-btn ${activeChannel === 'admin' ? 'active' : ''}`}
                onClick={() => handleSelectChannel('admin')}
              >
                <span className="channel-icon">⚙️</span>
                <span className="channel-name">จัดการหลังบ้าน</span>
                {adminBadgeCount > 0 && (
                  <span className="admin-notification-badge" title={`${adminBadgeCount} รายการรอการตรวจสอบ`}>
                    {adminBadgeCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* User Footer in Sidebar */}
        <div className="community-user-footer">
          {currentUser ? (
            <div className="current-user-info-bar">
              <img
                src={
                  isBanned
                    ? '/BandAccount.png'
                    : (userProfile?.photoURL || (isAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
                }
                alt={userProfile?.displayName}
                className="current-user-avatar"
                onClick={() => setProfileModalUser(userProfile || { uid: currentUser.uid, ...currentUser })}
              />
              <div
                className="current-user-text"
                onClick={() => setProfileModalUser(userProfile || { uid: currentUser.uid, ...currentUser })}
              >
                <div className="current-user-name">
                  {userProfile?.displayName || 'สมาชิก'}
                  {isAdmin && <span className="admin-tiny-star">★</span>}
                </div>
                <div className={`current-user-status ${userProfile?.statusMode === 'offline' ? 'offline' : ''}`}>
                  {userProfile?.statusMode === 'offline' ? 'ออฟไลน์ (ซ่อนสถานะ)' : 'ออนไลน์'}
                </div>
              </div>
              <button
                className="btn-user-settings"
                onClick={() => setProfileModalUser(userProfile || { uid: currentUser.uid, ...currentUser })}
                title="ตั้งค่าโปรไฟล์"
              >
                ⚙️
              </button>
              <button
                className="btn-user-logout"
                onClick={logout}
                title="ออกจากระบบ"
              >
                🚪
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm login-prompt-btn"
              onClick={() => setAuthModalOpen(true)}
            >
              🔑 เข้าสู่ระบบ / สมัครสมาชิก
            </button>
          )}
        </div>
      </aside>

      {/* Main Channel Content View */}
      <main className="community-main">
        {/* Mobile Top Bar */}
        <div className="community-mobile-bar">
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            ☰
          </button>
          <span className="mobile-active-channel-title">
            {activeChannel === 'general' && '💬 # แชททั่วไป'}
            {activeChannel === 'fanart' && '🎨 # แฟนอาร์ต'}
            {activeChannel === 'meme' && '🎭 # มีมฮาๆ'}
            {activeChannel === 'dms' && '✉️ # ข้อความส่วนตัว'}
            {activeChannel === 'admin' && '👑 # จัดการหลังบ้าน (Big Boss)'}
          </span>
          <button className="mobile-back-home" onClick={onBackToHome}>
            หน้าหลัก 🏠
          </button>
        </div>

        {/* Channel Router */}
        <div className="channel-view-viewport">
          {activeChannel === 'general' && (
            <GeneralChat
              onOpenAuth={() => setAuthModalOpen(true)}
              onSelectUser={(u) => setProfileModalUser(u)}
            />
          )}

          {(activeChannel === 'fanart' || activeChannel === 'meme') && (
            <PostFeed
              key={activeChannel}
              type={activeChannel}
              onOpenCreate={(t) => setCreatePostType(t)}
              onOpenAuth={() => setAuthModalOpen(true)}
              onSelectUser={(u) => setProfileModalUser(u)}
              onOpenReport={(t) => setReportTarget(t)}
            />
          )}

          {activeChannel === 'dms' && (
            <DirectMessages
              activeUser={dmTargetUser}
              onSelectUser={(u) => setProfileModalUser(u)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activeChannel === 'admin' && (
            <AdminPanel onSelectUser={(u) => setProfileModalUser(u)} />
          )}
        </div>
      </main>

      {/* Backdrop for mobile sidebar */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <UserProfileModal
        user={profileModalUser}
        isOpen={Boolean(profileModalUser)}
        onClose={() => setProfileModalUser(null)}
        onStartDM={handleStartDM}
      />

      <CreatePostModal
        isOpen={Boolean(createPostType)}
        defaultType={createPostType || 'fanart'}
        onClose={() => setCreatePostType(null)}
        onSuccess={(msg) => setToast({ show: true, message: msg, type: 'success' })}
      />

      <ReportModal
        isOpen={Boolean(reportTarget)}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />

      {/* Global Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
    </div>
  )
}

