import '../../styles/LikersModal.css'

export default function LikersModal({ isOpen, post, usersMap = {}, onClose, onSelectUser }) {
  if (!isOpen || !post) return null

  const likes = Array.isArray(post.likes) ? post.likes : []

  return (
    <div className="likers-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="likers-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="likers-modal-header">
          <div className="likers-modal-title-group">
            <span className="likers-modal-icon">❤️</span>
            <h3 className="likers-modal-title">คนที่กดหัวใจ ({likes.length} คน)</h3>
          </div>
          <button className="likers-modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="likers-modal-list">
          {likes.length === 0 ? (
            <div className="likers-empty">ยังไม่มีคนกดหัวใจในโพสต์นี้</div>
          ) : (
            likes.map((uid) => {
              const u = usersMap[uid] || { uid, displayName: 'สมาชิก' }
              const isUserAdmin = Boolean(
                u.role === 'admin' ||
                u.email === 'moritz2541@gmail.com' ||
                u.displayName === 'Moritz' ||
                u.displayName === 'คิดถึงคนเก่า' ||
                u.displayName === 'มอริทส์ ชทริคเกอร์'
              )
              const rawPhoto = u.photoURL
              const avatar = (rawPhoto && (rawPhoto !== '/profile.jpg' || isUserAdmin))
                ? rawPhoto
                : (isUserAdmin ? '/profile.jpg' : '/NewUserProfile.png')
              const heartCount = u.hearts?.length || 0
              const isVip = heartCount >= 5

              return (
                <div
                  key={uid}
                  className="liker-item"
                  onClick={() => {
                    onSelectUser({
                      uid,
                      displayName: u.displayName || 'สมาชิก',
                      photoURL: avatar,
                      role: isUserAdmin ? 'admin' : (u.role || 'member'),
                      hearts: u.hearts || [],
                    })
                    onClose()
                  }}
                  title="คลิกเพื่อดูโปรไฟล์หรือส่งข้อความ"
                >
                  <img
                    src={avatar}
                    alt={u.displayName || 'สมาชิก'}
                    className="liker-avatar"
                  />
                  <div className="liker-info">
                    <span className="liker-name">{u.displayName || 'สมาชิก'}</span>
                    {isUserAdmin && <span className="liker-badge admin">👑 Big Boss</span>}
                    {isVip && !isUserAdmin && (
                      <span className="liker-badge vip">⭐ คนสำคัญ ({heartCount})</span>
                    )}
                  </div>
                  <span className="liker-view-arrow">›</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
