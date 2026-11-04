import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import BanModal from './BanModal'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'
import '../../styles/AdminPanel.css'

export default function AdminPanel({ onSelectUser }) {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'reports' | 'users'
  const [pendingPosts, setPendingPosts] = useState([])
  const [reports, setReports] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [processingId, setProcessingId] = useState(null)

  // Custom modals & toast state (No browser alerts!)
  const [banningUser, setBanningUser] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  // Lightbox preview state for admin inspection
  const [lightboxGallery, setLightboxGallery] = useState(null) // { images: string[], activeIndex: number }
  const [lightboxVideo, setLightboxVideo] = useState(null)

  const handlePrevImage = (e) => {
    e?.stopPropagation()
    if (!lightboxGallery || !lightboxGallery.images?.length) return
    setLightboxGallery((prev) => ({
      ...prev,
      activeIndex: (prev.activeIndex - 1 + prev.images.length) % prev.images.length,
    }))
  }

  const handleNextImage = (e) => {
    e?.stopPropagation()
    if (!lightboxGallery || !lightboxGallery.images?.length) return
    setLightboxGallery((prev) => ({
      ...prev,
      activeIndex: (prev.activeIndex + 1) % prev.images.length,
    }))
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxGallery && lightboxGallery.images?.length > 1) {
        if (e.key === 'ArrowLeft') {
          setLightboxGallery((prev) => prev ? ({
            ...prev,
            activeIndex: (prev.activeIndex - 1 + prev.images.length) % prev.images.length,
          }) : null)
        }
        if (e.key === 'ArrowRight') {
          setLightboxGallery((prev) => prev ? ({
            ...prev,
            activeIndex: (prev.activeIndex + 1) % prev.images.length,
          }) : null)
        }
      }
      if (e.key === 'Escape') {
        setLightboxGallery(null)
        setLightboxVideo(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxGallery])

  // Real-time listener for pending posts
  useEffect(() => {
    if (!isAdmin) return
    const q = query(
      collection(firestore, 'community_posts'),
      where('status', '==', 'pending')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
      setPendingPosts(docs)
    }, (err) => console.error(err))

    return () => unsubscribe()
  }, [isAdmin])

  // Real-time listener for reports
  useEffect(() => {
    if (!isAdmin) return
    const q = query(
      collection(firestore, 'community_reports'),
      where('status', '==', 'pending')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
      setReports(docs)
    }, (err) => console.error(err))

    return () => unsubscribe()
  }, [isAdmin])

  // Real-time listener for all users directory
  useEffect(() => {
    if (!isAdmin) return
    const unsub = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const map = {}
      const list = []
      snapshot.docs.forEach((d) => {
        const u = { id: d.id, uid: d.id, ...d.data() }
        map[d.id] = u
        list.push(u)
      })
      setUsersMap(map)
      setAllUsers(list)
    })
    return () => unsub()
  }, [isAdmin])

  // Actions for Pending Posts
  const handleChangePendingType = async (postId, newType) => {
    try {
      await updateDoc(doc(firestore, 'community_posts', postId), { type: newType })
      const roomNames = { fanart: '🎨 แฟนอาร์ต', meme: '🎭 มีม', showoff: '✨ อวดอะไรก็ได้' }
      setToast({ show: true, message: `เปลี่ยนประเภทเป็น ${roomNames[newType] || newType} เรียบร้อยแล้ว ✓`, type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'เปลี่ยนหมวดหมู่ไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  const handleApprovePost = async (postId) => {
    setProcessingId(postId)
    try {
      await updateDoc(doc(firestore, 'community_posts', postId), {
        status: 'approved',
      })
      setToast({ show: true, message: 'อนุมัติผลงานเรียบร้อยแล้ว ✓', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'อนุมัติไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectPost = (postId) => {
    setConfirmModal({
      isOpen: true,
      title: 'ปฏิเสธและลบผลงาน',
      message: 'คุณต้องการปฏิเสธและลบผลงานนี้ออกจากระบบใช่หรือไม่?',
      onConfirm: async () => {
        setProcessingId(postId)
        try {
          await deleteDoc(doc(firestore, 'community_posts', postId))
          setToast({ show: true, message: 'ลบผลงานเรียบร้อยแล้ว', type: 'info' })
        } catch (err) {
          setToast({ show: true, message: 'ลบไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setProcessingId(null)
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  // Actions for Reports
  const handleDismissReport = async (reportId) => {
    try {
      await updateDoc(doc(firestore, 'community_reports', reportId), {
        status: 'dismissed',
      })
      setToast({ show: true, message: 'ปิดเคสรายงานแล้ว', type: 'info' })
    } catch (err) {
      setToast({ show: true, message: 'ดำเนินการไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  const handleDeleteReportedContent = (report) => {
    setConfirmModal({
      isOpen: true,
      title: 'ลบเนื้อหาที่ถูกรายงาน',
      message: 'คุณต้องการลบเนื้อหาที่ถูกรายงานนี้ออกจากระบบใช่หรือไม่?',
      onConfirm: async () => {
        try {
          if (report.targetType === 'post') {
            await deleteDoc(doc(firestore, 'community_posts', report.targetId))
          }
          await updateDoc(doc(firestore, 'community_reports', report.id), {
            status: 'resolved',
          })
          setToast({ show: true, message: 'ลบเนื้อหาและปิดเคสเรียบร้อยแล้ว ✓', type: 'success' })
        } catch (err) {
          setToast({ show: true, message: 'เกิดข้อผิดพลาด: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  // Unban user
  const handleUnban = async (user) => {
    try {
      await updateDoc(doc(firestore, 'users', user.id || user.uid), {
        isBanned: false,
        banType: null,
      })
      setAllUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isBanned: false, banType: null } : u))
      )
      setToast({ show: true, message: `ปลดระงับผู้ใช้ ${user.displayName} เรียบร้อยแล้ว ✓`, type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'ดำเนินการไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <h2>🔒 สำหรับ Admin เท่านั้น</h2>
        <p>หน้านี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น</p>
      </div>
    )
  }

  const filteredUsers = allUsers.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="admin-panel-container">
      {/* Toast popup */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      {/* Admin Header */}
      <div className="admin-panel-header">
        <div>
          <h2 className="admin-panel-title">👑 แผงควบคุมผู้ดูแลระบบ</h2>
          <p className="admin-panel-subtitle">
            จัดการการอนุมัติผลงาน ตรวจสอบรายงาน และดูแลความเรียบร้อย
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            🟡 รออนุมัติ ({pendingPosts.length})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            🚨 รายงาน ({reports.length})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 สมาชิกทั้งหมด
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="admin-panel-content">
        {/* Tab 1: Pending Posts */}
        {activeTab === 'pending' && (
          <div className="admin-pending-section">
            {pendingPosts.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">✅</div>
                <h3>ไม่มีผลงานที่รอการอนุมัติ</h3>
                <p>ผลงานทั้งหมดได้รับการตรวจสอบเรียบร้อยแล้ว</p>
              </div>
            ) : (
              <div className="admin-pending-grid">
                {pendingPosts.map((post) => (
                  <div key={post.id} className="admin-pending-card">
                    <div className="admin-pending-type-row">
                      <select
                        className="admin-pending-type-select"
                        value={post.type}
                        onChange={(e) => handleChangePendingType(post.id, e.target.value)}
                        title="คลิกเพื่อเปลี่ยนห้อง/หมวดหมู่หากส่งมาผิด"
                      >
                        <option value="fanart">🎨 แฟนอาร์ต</option>
                        <option value="meme">🎭 มีม</option>
                        <option value="showoff">✨ อวดอะไรก็ได้</option>
                      </select>
                      <span className="admin-pending-type-hint">✎ สลับห้องได้</span>
                    </div>

                    {(() => {
                      const postImages = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
                        ? post.imageUrls
                        : post.imageUrl
                          ? [post.imageUrl]
                          : []
                      const isVideo = Boolean(post.videoUrl || post.mediaType === 'video')
                      const videoSrc = post.videoUrl || post.imageUrl

                      if (isVideo) {
                        return (
                          <div className="admin-pending-video-box">
                            <video
                              src={videoSrc}
                              controls
                              playsInline
                              className="admin-pending-video"
                            />
                            <button
                              type="button"
                              className="admin-media-expand-btn"
                              onClick={() => setLightboxVideo(videoSrc)}
                              title="ขยายวิดีโอเต็มจอ"
                            >
                              ⛶ ขยายเต็มจอ
                            </button>
                          </div>
                        )
                      }

                      if (postImages.length > 1) {
                        return (
                          <div className="admin-pending-gallery-box">
                            <div className="admin-pending-gallery-header">
                              <span className="admin-pending-gallery-badge">
                                📷 {postImages.length} รูปภาพ (คลิกเพื่อดูชัดๆ)
                              </span>
                            </div>
                            <div className={`admin-pending-gallery-grid count-${Math.min(postImages.length, 4)}`}>
                              {postImages.slice(0, 4).map((imgUrl, imgIdx) => {
                                const isFourth = imgIdx === 3 && postImages.length > 4
                                const remainingCount = postImages.length - 4
                                return (
                                  <div
                                    key={imgIdx}
                                    className="admin-gallery-item-wrapper"
                                    onClick={() => setLightboxGallery({ images: postImages, activeIndex: imgIdx })}
                                    title={`คลิกเพื่อดูรูปภาพที่ ${imgIdx + 1} ขนาดเต็ม`}
                                  >
                                    <img src={imgUrl} alt={`${post.title || 'รูปภาพ'} #${imgIdx + 1}`} loading="lazy" />
                                    <div className="admin-gallery-hover-overlay">
                                      <span>🔍 คลิกขยาย</span>
                                    </div>
                                    {isFourth && (
                                      <div className="admin-gallery-more-overlay">
                                        <span>+{remainingCount + 1}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }

                      if (postImages.length === 1) {
                        return (
                          <div
                            className="admin-pending-img-box clickable"
                            onClick={() => setLightboxGallery({ images: postImages, activeIndex: 0 })}
                            title="คลิกเพื่อขยายดูรูปขนาดเต็ม"
                          >
                            <img src={postImages[0]} alt={post.title} loading="lazy" />
                            <div className="admin-img-hover-hint">
                              <span>🔍 คลิกเพื่อขยายดูรูปขนาดเต็ม</span>
                            </div>
                          </div>
                        )
                      }

                      return null
                    })()}

                    <div className="admin-pending-info">
                      <h4 className="admin-pending-title">{post.title}</h4>
                      {post.caption && (
                        <p className="admin-pending-caption">{post.caption}</p>
                      )}

                      {(() => {
                        const authorLive = usersMap[post.authorId]
                        const isPostAdmin = authorLive?.role === 'admin' || post.authorRole === 'admin'
                        const rawPhoto = authorLive?.photoURL || post.authorPhoto
                        const isAuthorBanned = Boolean(authorLive?.isBanned)
                        const authorPhoto = isAuthorBanned
                          ? '/BandAccount.png'
                          : ((rawPhoto && (rawPhoto !== '/profile.jpg' || isPostAdmin))
                              ? rawPhoto
                              : (isPostAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
                        const authorName = authorLive?.displayName || post.authorName || 'สมาชิก'

                        return (
                          <div
                            className="admin-pending-author"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelectUser(authorLive || { uid: post.authorId, displayName: authorName, photoURL: authorPhoto })}
                            title="คลิกเพื่อดูโปรไฟล์ผู้ส่ง"
                          >
                            <img src={authorPhoto} alt={authorName} />
                            <span>ส่งโดย: <strong>{authorName}</strong></span>
                          </div>
                        )
                      })()}

                      <div className="admin-pending-actions">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprovePost(post.id)}
                          disabled={processingId === post.id}
                        >
                          {processingId === post.id ? 'กำลังอนุมัติ...' : '✅ อนุมัติทันที'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRejectPost(post.id)}
                          disabled={processingId === post.id}
                        >
                          ❌ ปฏิเสธ / ลบ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Reports */}
        {activeTab === 'reports' && (
          <div className="admin-reports-section">
            {reports.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">🛡️</div>
                <h3>ไม่มีรายงานที่ค้างอยู่</h3>
                <p>ไม่มีรายงานร้องเรียนในขณะนี้</p>
              </div>
            ) : (
              <div className="admin-reports-list">
                {reports.map((report) => (
                  <div key={report.id} className="admin-report-card">
                    <div className="admin-report-header">
                      <span className="admin-report-tag">
                        🚩 รายงาน: {report.targetType === 'post' ? 'โพสต์' : 'ความคิดเห็น'}
                      </span>
                      <span className="admin-report-reason">{report.reason}</span>
                    </div>

                    <div className="admin-report-body">
                      {report.targetContent && (
                        <p className="admin-report-content">
                          <strong>เนื้อหา:</strong> "{report.targetContent}"
                        </p>
                      )}
                      {report.details && (
                        <p className="admin-report-details">
                          <strong>รายละเอียดเพิ่มเติมจากผู้รายงาน:</strong> {report.details}
                        </p>
                      )}
                      <p className="admin-report-meta">
                        ผู้รายงาน: <strong>{report.reporterName}</strong> | ผู้ถูกรายงาน: <strong>{report.targetAuthorName}</strong>
                      </p>
                    </div>

                    <div className="admin-report-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteReportedContent(report)}
                      >
                        🗑️ ลบเนื้อหานี้
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismissReport(report.id)}
                      >
                        เพิกเฉย / ปิดเคส
                      </button>
                      {report.targetAuthorId && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setBanningUser({ id: report.targetAuthorId, displayName: report.targetAuthorName })}
                        >
                          ⚖️ จัดการระงับผู้ใช้
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Users */}
        {activeTab === 'users' && (
          <div className="admin-users-section">
            <div className="admin-users-search-bar">
              <input
                type="text"
                placeholder="ค้นหาชื่อสมาชิก หรืออีเมล..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="admin-users-table-wrapper">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>สมาชิก</th>
                    <th>อีเมล</th>
                    <th>บทบาท</th>
                    <th>สถานะ</th>
                    <th>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isUserAdmin = u.role === 'admin' || u.email === 'moritz2541@gmail.com'
                    return (
                      <tr key={u.id}>
                        <td
                          className="user-cell"
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSelectUser(u)}
                          title="คลิกเพื่อดูโปรไฟล์หรือส่งข้อความ"
                        >
                          <img
                            src={
                              u.isBanned
                                ? '/BandAccount.png'
                                : ((u.photoURL && (u.photoURL !== '/profile.jpg' || isUserAdmin))
                                    ? u.photoURL
                                    : (isUserAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
                            }
                            alt={u.displayName}
                            className="user-table-avatar"
                          />
                          <span>{u.displayName || 'สมาชิก'}</span>
                        </td>
                        <td>{u.email || '-'}</td>
                        <td>
                          {isUserAdmin ? (
                            <span className="role-pill admin">👑 Big Boss</span>
                          ) : (
                            <span className="role-pill member">สมาชิก</span>
                          )}
                        </td>
                        <td>
                          {u.isBanned ? (
                            <span className="status-pill banned">
                              {u.banType === 'mute' ? 'ถูกระงับข้อความ' : 'ถูกแบนถาวร'}
                            </span>
                          ) : (
                            <span className="status-pill active">ปกติ</span>
                          )}
                        </td>
                        <td>
                          {!isUserAdmin && (
                            u.isBanned ? (
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleUnban(u)}
                              >
                                ✅ ปลดระงับ
                              </button>
                            ) : (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => setBanningUser(u)}
                              >
                                ⚖️ ระงับ / แบน
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ban User Modal */}
      <BanModal
        isOpen={Boolean(banningUser)}
        targetUser={banningUser}
        onClose={() => setBanningUser(null)}
        onSuccess={(msg) => {
          setToast({ show: true, message: msg + ' ✓', type: 'success' })
          // Update local state in table
          if (banningUser) {
            setAllUsers((prev) =>
              prev.map((u) => (u.id === banningUser.id ? { ...u, isBanned: true } : u))
            )
          }
        }}
      />

      {/* Custom Confirmation Modal (No browser alert!) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
      />

      {/* Interactive Gallery Lightbox for Admin Inspection */}
      {lightboxGallery && lightboxGallery.images && lightboxGallery.images.length > 0 && (
        <div className="lightbox-overlay" onClick={() => setLightboxGallery(null)}>
          <div className="lightbox-content gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxGallery.images[lightboxGallery.activeIndex]}
              alt={`รูปภาพที่ ${lightboxGallery.activeIndex + 1}`}
              className="lightbox-main-img"
            />

            {lightboxGallery.images.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav-btn prev"
                  onClick={handlePrevImage}
                  title="รูปก่อนหน้า (←)"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox-nav-btn next"
                  onClick={handleNextImage}
                  title="รูปถัดไป (→)"
                >
                  ›
                </button>
                <div className="lightbox-counter-badge">
                  {lightboxGallery.activeIndex + 1} / {lightboxGallery.images.length}
                </div>
              </>
            )}

            <button className="lightbox-close" onClick={() => setLightboxGallery(null)} title="ปิด (Esc)">✕</button>
          </div>
        </div>
      )}

      {/* Video Lightbox Modal for Admin */}
      {lightboxVideo && (
        <div className="lightbox-overlay" onClick={() => setLightboxVideo(null)}>
          <div className="lightbox-content video-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <video
              src={lightboxVideo}
              controls
              autoPlay
              playsInline
              className="lightbox-main-video"
            />
            <button className="lightbox-close" onClick={() => setLightboxVideo(null)} title="ปิด (Esc)">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
