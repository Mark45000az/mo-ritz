import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { CHANNELS } from '../../config/communityConfig'
import { isUserOnline } from '../../lib/presence'
import GeneralChat from './GeneralChat'
import PostFeed from './PostFeed'
import DirectMessages from './DirectMessages'
import AdminPanel from './AdminPanel'
import AnnouncementFeed from './AnnouncementFeed'
import AuthModal from './AuthModal'
import UserProfileModal from './UserProfileModal'
import CreatePostModal from './CreatePostModal'
import ReportModal from './ReportModal'
import Toast from './Toast'
import '../../styles/CommunityLayout.css'

export default function CommunityLayout({ onBackToHome }) {
  const { currentUser, userProfile, isAdmin, isBanned, logout } = useAuth()
  const [activeChannel, setActiveChannel] = useState('general')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [membersPanelOpen, setMembersPanelOpen] = useState(false)
  const [allUsers, setAllUsers] = useState([])

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalUser, setProfileModalUser] = useState(null)
  const [createPostType, setCreatePostType] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [dmTargetUser, setDmTargetUser] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Admin notification badge counter
  const [adminBadgeCount, setAdminBadgeCount] = useState(0)

  // Real-time unread DM notifications counter (Messenger-style)
  const [unreadDmCount, setUnreadDmCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.uid) {
      setUnreadDmCount(0)
      return
    }

    const q = query(
      collection(firestore, 'community_chats'),
      where('participants', 'array-contains', currentUser.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0
      snapshot.docs.forEach((d) => {
        const data = d.data()
        const unread = Number(data[`unread_${currentUser.uid}`] || 0)
        if (unread > 0) {
          count += unread
        }
      })
      setUnreadDmCount(count)
    }, (err) => {
      console.warn('[CommunityLayout] unread DMs listener error:', err)
    })

    return () => unsubscribe()
  }, [currentUser?.uid])

  // Heartbeat to update lastActive in Firestore
  useEffect(() => {
    if (!currentUser?.uid) return
    const userRef = doc(firestore, 'users', currentUser.uid)
    const sendHeartbeat = () => {
      updateDoc(userRef, { lastActive: serverTimestamp() }).catch(() => {})
    }
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 90000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }
    window.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('visibilitychange', onVisible)
    }
  }, [currentUser?.uid])

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

  // Subscribe to all registered community members
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
      }))
      setAllUsers(list)
    })
    return () => unsub()
  }, [])

  const onlineMembers = allUsers.filter((u) => isUserOnline(u) && u.statusMode !== 'offline')
  const offlineMembers = allUsers.filter((u) => !isUserOnline(u) || u.statusMode === 'offline')

  const sortMembers = (list) => {
    return [...list].sort((a, b) => {
      const aAdmin = a.role === 'admin' || a.email === 'moritz2541@gmail.com' ? 1 : 0
      const bAdmin = b.role === 'admin' || b.email === 'moritz2541@gmail.com' ? 1 : 0
      if (bAdmin !== aAdmin) return bAdmin - aAdmin
      const aHearts = a.hearts?.length || 0
      const bHearts = b.hearts?.length || 0
      if (bHearts !== aHearts) return bHearts - aHearts
      return (a.displayName || 'สมาชิก').localeCompare(b.displayName || 'สมาชิก')
    })
  }

  const sortedOnline = sortMembers(onlineMembers)
  const sortedOffline = sortMembers(offlineMembers)

  const renderMemberItem = (u, isOnline) => {
    const isUserAdmin = Boolean(
      u.role === 'admin' ||
      u.email === 'moritz2541@gmail.com' ||
      u.displayName === 'Moritz' ||
      u.displayName === 'คิดถึงคนเก่า' ||
      u.displayName === 'มอริทส์ ชทริคเกอร์'
    )
    const isBannedUser = Boolean(u.isBanned)
    const rawPhoto = u.photoURL
    const avatar = isBannedUser
      ? '/BandAccount.png'
      : ((rawPhoto && (rawPhoto !== '/profile.jpg' || isUserAdmin))
          ? rawPhoto
          : (isUserAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
    const heartCount = u.hearts?.length || 0
    const isVip = heartCount >= 5
    const frame = u.avatarFrame || 'none'

    return (
      <div
        key={u.uid}
        className={`member-list-item ${isOnline ? 'online' : 'offline'}`}
        onClick={() => {
          setProfileModalUser(u)
          if (window.innerWidth <= 1024) setMembersPanelOpen(false)
        }}
        title="คลิกเพื่อดูโปรไฟล์"
      >
        <div className={`member-avatar-wrapper frame-${frame} ${isBannedUser ? 'banned' : ''}`}>
          <img src={avatar} alt={u.displayName || 'สมาชิก'} className="member-avatar-img" />
          <span className={`member-status-dot ${isOnline ? 'online' : 'offline'}`} />
        </div>
        <div className="member-details">
          <div className="member-name-row">
            <span className={`member-name nametag-style-${u.nametagStyle || 'default'}`}>{u.displayName || 'สมาชิก'}</span>
            {u.nametagBadge && (
              <span className={`member-nametag-badge nametag-style-${u.nametagStyle || 'default'}`}>
                {u.nametagBadge}
              </span>
            )}
            {isUserAdmin && <span className="member-badge admin">👑 Big Boss</span>}
            {isVip && !isUserAdmin && <span className="member-badge vip">⭐</span>}
          </div>
          {u.bio ? (
            <span className="member-status-text">{u.bio}</span>
          ) : u.hobbyTag ? (
            <span className="member-status-text">{u.hobbyTag}</span>
          ) : null}
        </div>
      </div>
    )
  }

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
              title={ch.description || ch.name}
            >
              <span className="channel-icon">{ch.icon}</span>
              <span className="channel-name">{ch.name}</span>
              {ch.id === 'dms' && unreadDmCount > 0 && (
                <span className="channel-unread-badge" title={`${unreadDmCount} ข้อความใหม่ที่ยังไม่ได้อ่าน`}>
                  {unreadDmCount > 99 ? '99+' : unreadDmCount}
                </span>
              )}
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
                  <span className={`nametag-style-${userProfile?.nametagStyle || 'default'}`}>
                    {userProfile?.displayName || 'สมาชิก'}
                  </span>
                  {userProfile?.nametagBadge && (
                    <span className={`footer-nametag-badge nametag-style-${userProfile?.nametagStyle || 'default'}`}>
                      {userProfile.nametagBadge}
                    </span>
                  )}
                  {isAdmin && <span className="admin-tiny-star">★</span>}
                </div>
                <div className={`current-user-status ${userProfile?.statusMode === 'offline' ? 'offline' : ''}`}>
                  {userProfile?.statusMode === 'offline' ? '⚪ ซ่อนสถานะ (ออฟไลน์)' : '🟢 กำลังออนไลน์'}
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
            {unreadDmCount > 0 && (
              <span className="mobile-unread-badge" title={`${unreadDmCount} ข้อความใหม่`}>
                {unreadDmCount > 9 ? '9+' : unreadDmCount}
              </span>
            )}
          </button>
          <span className="mobile-active-channel-title">
            {activeChannel === 'announcements' && '📢 # ประกาศจาก Moritz'}
            {activeChannel === 'general' && '💬 # แชททั่วไป'}
            {activeChannel === 'fanart' && '🎨 # แฟนอาร์ต'}
            {activeChannel === 'meme' && '🎭 # มีมฮาๆ'}
            {activeChannel === 'showoff' && '✨ # อวดอะไรก็ได้'}
            {activeChannel === 'dms' && '✉️ # ข้อความส่วนตัว'}
            {activeChannel === 'admin' && '👑 # จัดการหลังบ้าน (Big Boss)'}
          </span>
          <div className="mobile-bar-actions">
            <button
              type="button"
              className={`mobile-members-toggle ${membersPanelOpen ? 'active' : ''}`}
              onClick={() => setMembersPanelOpen(!membersPanelOpen)}
              title="ดูสมาชิกทั้งหมด"
            >
              👥 {allUsers.length}
            </button>
            <button className="mobile-back-home" onClick={onBackToHome} title="กลับหน้าแรก">
              🏠
            </button>
          </div>
        </div>

        {/* Desktop Top Header Bar */}
        <div className="community-desktop-bar">
          <div className="desktop-channel-info">
            <span className="desktop-channel-name">
              {activeChannel === 'announcements' && '📢 ประกาศจาก Moritz'}
              {activeChannel === 'general' && '💬 แชททั่วไป'}
              {activeChannel === 'fanart' && '🎨 ห้องแฟนอาร์ต'}
              {activeChannel === 'meme' && '🎭 ห้องมีมฮาๆ'}
              {activeChannel === 'showoff' && '✨ ห้องอวดอะไรก็ได้'}
              {activeChannel === 'dms' && '✉️ ข้อความส่วนตัว'}
              {activeChannel === 'admin' && '👑 จัดการหลังบ้าน (Big Boss)'}
            </span>
          </div>
          <div className="desktop-bar-actions">
            <button
              type="button"
              className={`btn-toggle-members ${membersPanelOpen ? 'active' : ''}`}
              onClick={() => setMembersPanelOpen(!membersPanelOpen)}
              title="ดูรายชื่อสมาชิกทั้งหมด"
            >
              👥 สมาชิก ({allUsers.length})
            </button>
            <button className="desktop-back-home" onClick={onBackToHome} title="กลับสู่หน้าโปรไฟล์หลัก">
              🏠 หน้าแรก
            </button>
          </div>
        </div>

        {/* Channel Router */}
        <div className="channel-view-viewport">
          {activeChannel === 'announcements' && (
            <AnnouncementFeed
              onSelectUser={(u) => setProfileModalUser(u)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activeChannel === 'general' && (
            <GeneralChat
              onOpenAuth={() => setAuthModalOpen(true)}
              onSelectUser={(u) => setProfileModalUser(u)}
            />
          )}

          {(activeChannel === 'fanart' || activeChannel === 'meme' || activeChannel === 'showoff') && (
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

      {/* Discord-style Members Right Sidebar / Drawer */}
      <aside className={`community-members-sidebar ${membersPanelOpen ? 'open' : ''}`}>
        <div className="members-sidebar-header">
          <div className="members-header-title">
            <span className="members-icon">👥</span>
            <span>สมาชิก ({allUsers.length})</span>
          </div>
          <button
            type="button"
            className="members-sidebar-close"
            onClick={() => setMembersPanelOpen(false)}
            title="ปิดแถบสมาชิก"
          >
            ✕
          </button>
        </div>

        <div className="members-sidebar-scroll">
          {/* Online Section */}
          <div className="members-group-section">
            <div className="members-group-title">
              🟢 ออนไลน์ — {sortedOnline.length}
            </div>
            {sortedOnline.length === 0 ? (
              <div className="members-empty-note">ไม่มีสมาชิกออนไลน์ขณะนี้</div>
            ) : (
              sortedOnline.map((u) => renderMemberItem(u, true))
            )}
          </div>

          {/* Offline Section */}
          <div className="members-group-section">
            <div className="members-group-title">
              ⚪ ออฟไลน์ — {sortedOffline.length}
            </div>
            {sortedOffline.length === 0 ? (
              <div className="members-empty-note">ไม่มีสมาชิกออฟไลน์</div>
            ) : (
              sortedOffline.map((u) => renderMemberItem(u, false))
            )}
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile members drawer */}
      {membersPanelOpen && (
        <div
          className="mobile-members-backdrop"
          onClick={() => setMembersPanelOpen(false)}
        />
      )}

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
        key={createPostType || 'default'}
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

