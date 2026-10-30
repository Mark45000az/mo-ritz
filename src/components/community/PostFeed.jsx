import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import ConfirmModal from './ConfirmModal'
import LikersModal from './LikersModal'
import Toast from './Toast'
import '../../styles/PostFeed.css'

export default function PostFeed({ type, onOpenCreate, onOpenAuth, onSelectUser, onOpenReport }) {
  const { currentUser, isAdmin, isBanned } = useAuth()
  const [posts, setPosts] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [myPendingCount, setMyPendingCount] = useState(0)
  const [lightboxGallery, setLightboxGallery] = useState(null) // { images: [], activeIndex: 0 }
  const [lightboxVideo, setLightboxVideo] = useState(null)
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null)
  const [likersModalPost, setLikersModalPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [editPostTitle, setEditPostTitle] = useState('')
  const [editPostCaption, setEditPostCaption] = useState('')
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  const longPressTimerRef = useRef(null)
  const isLongPressRef = useRef(false)

  // Real-time listener for users directory (to keep all avatars and names in sync)
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const map = {}
      snapshot.docs.forEach((d) => {
        map[d.id] = { uid: d.id, ...d.data() }
      })
      setUsersMap(map)
    })
    return () => unsub()
  }, [])

  // Real-time listener for approved posts of this type (in-memory sort avoids composite index requirement)
  useEffect(() => {
    const q = query(
      collection(firestore, 'community_posts'),
      where('type', '==', type),
      where('status', '==', 'approved')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)
        return timeB - timeA
      })
      setPosts(docs)
    }, (err) => {
      console.error('Error fetching posts:', err)
      setToast({ show: true, message: 'โหลดผลงานไม่สำเร็จ: ' + err.message, type: 'error' })
    })

    return () => unsubscribe()
  }, [type])

  // Real-time listener for current user's pending posts (if logged in and not admin)
  useEffect(() => {
    if (!currentUser || isAdmin) {
      setMyPendingCount(0)
      return
    }

    const q = query(
      collection(firestore, 'community_posts'),
      where('type', '==', type),
      where('authorId', '==', currentUser.uid),
      where('status', '==', 'pending')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyPendingCount(snapshot.size)
    })

    return () => unsubscribe()
  }, [type, currentUser, isAdmin])

  const handleLike = async (post) => {
    if (!currentUser) {
      onOpenAuth()
      return
    }
    if (isBanned) return

    const postRef = doc(firestore, 'community_posts', post.id)
    const currentLikes = Array.isArray(post.likes) ? post.likes : []
    const isLiked = currentLikes.includes(currentUser.uid)

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p
        const nextLikes = isLiked
          ? currentLikes.filter((uid) => uid !== currentUser.uid)
          : [...currentLikes, currentUser.uid]
        return {
          ...p,
          likes: nextLikes,
          likeCount: nextLikes.length,
        }
      })
    )

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.uid),
          likeCount: Math.max(currentLikes.length - 1, 0),
        })
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.uid),
          likeCount: currentLikes.length + 1,
        })
      }
    } catch (err) {
      console.error('Error updating like:', err)
      setToast({ show: true, message: 'กดหัวใจไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  const handleTouchStart = (post) => {
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setLikersModalPost(post)
    }, 450)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
  }

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
  }

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

  const getLikersPreview = (likes = []) => {
    if (!likes || likes.length === 0) return ''
    const names = likes.map((uid) => usersMap[uid]?.displayName || 'สมาชิก')
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]}, ${names[1]}`
    return `${names[0]}, ${names[1]} +${names.length - 2}`
  }

  const handleDeletePost = (postId) => {
    setConfirmModal({
      isOpen: true,
      title: 'ลบโพสต์',
      message: 'คุณต้องการลบผลงานหรือมีมนี้ใช่หรือไม่?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firestore, 'community_posts', postId))
          setToast({ show: true, message: 'ลบผลงานเรียบร้อยแล้ว ✓', type: 'info' })
        } catch (err) {
          console.error('Error deleting post:', err)
          setToast({ show: true, message: 'ลบไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  const handleStartEditPost = (post) => {
    setEditingPost(post)
    setEditPostTitle(post.title || '')
    setEditPostCaption(post.caption || '')
  }

  const handleSavePostEdit = async (e) => {
    e.preventDefault()
    if (!editingPost || !editPostTitle.trim() || isSavingPost) return
    setIsSavingPost(true)
    try {
      const postRef = doc(firestore, 'community_posts', editingPost.id)
      await updateDoc(postRef, {
        title: editPostTitle.trim(),
        caption: editPostCaption.trim(),
        isEdited: true,
        editedAt: serverTimestamp(),
      })
      setToast({ show: true, message: 'แก้ไขข้อความโพสต์เรียบร้อยแล้ว ✓', type: 'success' })
      setEditingPost(null)
    } catch (err) {
      console.error('Error updating post:', err)
      setToast({ show: true, message: 'แก้ไขไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setIsSavingPost(false)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return 'เมื่อสักครู่'
    const date = timestamp.toDate()
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="post-feed-container">
      {/* Feed Header */}
      <div className="post-feed-header">
        <div>
          <h2 className="post-feed-title">
            {type === 'fanart' ? '🎨 ห้องแฟนอาร์ต' : '🎭 ห้องมีม'}
          </h2>
          <p className="post-feed-subtitle">
            {type === 'fanart'
              ? 'พื้นที่รวมผลงานภาพวาดและแฟนอาร์ต'
              : 'พื้นที่แชร์มีมทั่วไป'}
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm create-btn"
          onClick={() => {
            if (!currentUser) onOpenAuth()
            else onOpenCreate(type)
          }}
        >
          {type === 'fanart' ? 'ส่งแฟนอาร์ต' : 'โพสต์มีม'}
        </button>
      </div>

      {/* Pending Notice for regular users */}
      {myPendingCount > 0 && (
        <div className="pending-notice-banner">
          <span className="notice-icon">⏳</span>
          <span>คุณมี <strong>{myPendingCount}</strong> โพสต์ที่กำลังรอการอนุมัติจาก Big Boss</span>
        </div>
      )}

      {/* Posts List */}
      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-posts-state">
            <div className="empty-icon">{type === 'fanart' ? '🎨' : '🎭'}</div>
            <h3>ยังไม่มีโพสต์ในห้องนี้</h3>
            <p>สามารถส่งผลงานได้ที่ปุ่มด้านบน</p>
          </div>
        ) : (
          posts.map((post) => {
            const authorLive = usersMap[post.authorId]
            const isLiked = currentUser && post.likes?.includes(currentUser.uid)
            const canDelete = currentUser?.uid === post.authorId || isAdmin
            const isPostAdmin = Boolean(
              authorLive?.role === 'admin' ||
              post.authorRole === 'admin' ||
              authorLive?.email === 'moritz2541@gmail.com' ||
              post.authorName === 'Moritz' ||
              post.authorName === 'มอริทส์ ชทริคเกอร์' ||
              post.authorName === 'คิดถึงคนเก่า'
            )
            const isAuthorBanned = Boolean(authorLive?.isBanned)
            const rawAuthorPhoto = authorLive?.photoURL || post.authorPhoto
            const postAvatar = isAuthorBanned
              ? '/BandAccount.png'
              : ((rawAuthorPhoto && (rawAuthorPhoto !== '/profile.jpg' || isPostAdmin))
                  ? rawAuthorPhoto
                  : (isPostAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
            const postAuthorName = authorLive?.displayName || post.authorName || 'สมาชิก'

            return (
              <article key={post.id} className="post-card">
                {/* Author Info */}
                <div className="post-card-header">
                  <img
                    src={postAvatar}
                    alt={postAuthorName}
                    className="post-author-avatar"
                    onClick={() => onSelectUser(authorLive || {
                      uid: post.authorId,
                      displayName: postAuthorName,
                      photoURL: postAvatar,
                      role: isPostAdmin ? 'admin' : (post.authorRole || 'member'),
                    })}
                  />
                  <div className="post-author-details">
                    <span
                      className="post-author-name"
                      onClick={() => onSelectUser(authorLive || {
                        uid: post.authorId,
                        displayName: postAuthorName,
                        photoURL: postAvatar,
                        role: isPostAdmin ? 'admin' : (post.authorRole || 'member'),
                      })}
                    >
                      {postAuthorName}
                    </span>
                    <span className="post-timestamp">
                      {formatTime(post.createdAt)}
                      {post.isEdited && <span className="post-edited-tag">(แก้ไขข้อความแล้ว)</span>}
                    </span>
                  </div>

                  {/* Actions Dropdown / Delete / Report */}
                  <div className="post-header-actions">
                    {canDelete && (
                      <button
                        className="post-edit-btn"
                        onClick={() => handleStartEditPost(post)}
                        title="แก้ไขข้อความโพสต์"
                      >
                        ✏️ แก้ไข
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="post-delete-btn"
                        onClick={() => handleDeletePost(post.id)}
                        title="ลบโพสต์นี้"
                      >
                        🗑️ ลบ
                      </button>
                    )}
                    {currentUser && currentUser.uid !== post.authorId && (
                      <button
                        className="post-report-btn"
                        onClick={() => onOpenReport({
                          id: post.id,
                          type: 'post',
                          title: post.title,
                          content: post.caption,
                          imageUrl: post.imageUrl,
                          authorId: post.authorId,
                          authorName: post.authorName,
                        })}
                        title="รายงานโพสต์นี้"
                      >
                        🚩
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="post-card-content">
                  <h3 className="post-card-title">{post.title}</h3>
                  {post.caption && <p className="post-card-caption">{post.caption}</p>}
                </div>

                {/* Media: Video or Multi-Images or Single Image */}
                {post.videoUrl || post.mediaType === 'video' ? (
                  <div className="post-card-video-box">
                    <video
                      src={post.videoUrl || post.imageUrl}
                      controls
                      playsInline
                      className="post-card-video"
                    />
                    <button
                      type="button"
                      className="video-expand-btn"
                      onClick={() => setLightboxVideo(post.videoUrl || post.imageUrl)}
                      title="ดูวิดีโอแบบเต็มจอ"
                    >
                      ⛶ ขยายเต็มจอ
                    </button>
                  </div>
                ) : (post.imageUrls && post.imageUrls.length > 1) ? (
                  <div className={`post-card-gallery-grid count-${Math.min(post.imageUrls.length, 4)}`}>
                    {post.imageUrls.slice(0, 4).map((imgUrl, imgIdx) => {
                      const isFourth = imgIdx === 3 && post.imageUrls.length > 4
                      const remainingCount = post.imageUrls.length - 4
                      return (
                        <div
                          key={imgIdx}
                          className="gallery-item-wrapper"
                          onClick={() => setLightboxGallery({ images: post.imageUrls, activeIndex: imgIdx })}
                          title="คลิกเพื่อดูแกลเลอรีรูปภาพ"
                        >
                          <img src={imgUrl} alt={`${post.title} #${imgIdx + 1}`} loading="lazy" />
                          {isFourth && (
                            <div className="gallery-more-overlay">
                              <span>+{remainingCount + 1}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : post.imageUrl ? (
                  <div
                    className="post-card-image-box"
                    onClick={() => setLightboxGallery({ images: [post.imageUrl], activeIndex: 0 })}
                    title="คลิกเพื่อดูรูปขนาดเต็ม"
                  >
                    <img src={post.imageUrl} alt={post.title} loading="lazy" />
                  </div>
                ) : null}

                {/* Footer Buttons */}
                <div className="post-card-footer">
                  <div className="post-likes-group">
                    <button
                      className={`post-action-btn like-btn ${isLiked ? 'liked' : ''}`}
                      onClick={() => {
                        if (isLongPressRef.current) {
                          isLongPressRef.current = false
                          return
                        }
                        handleLike(post)
                      }}
                      onTouchStart={() => handleTouchStart(post)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchCancel}
                      title={isLiked ? 'ยกเลิกการกดหัวใจ (กดค้างหรือกด 👁️ เพื่อดูรายชื่อ)' : 'กดหัวใจ (กดค้างหรือกด 👁️ เพื่อดูรายชื่อ)'}
                    >
                      <span className="btn-icon">{isLiked ? '❤️' : '🤍'}</span>
                      <span>{post.likeCount || 0}</span>
                    </button>

                    {(post.likes && post.likes.length > 0) && (
                      <button
                        type="button"
                        className="post-likers-btn"
                        onClick={() => setLikersModalPost(post)}
                        title="ดูรายชื่อคนที่กดหัวใจ"
                        aria-label="ดูรายชื่อคนที่กดหัวใจ"
                      >
                        <span className="likers-eye-icon">👁️</span>
                        <span className="likers-preview-names">
                          {getLikersPreview(post.likes)}
                        </span>
                      </button>
                    )}
                  </div>

                  <button
                    className={`post-action-btn comment-btn ${activeCommentsPostId === post.id ? 'active' : ''}`}
                    onClick={() =>
                      setActiveCommentsPostId(activeCommentsPostId === post.id ? null : post.id)
                    }
                  >
                    <span className="btn-icon">💬</span>
                    <span>{post.commentCount || 0} ความคิดเห็น</span>
                  </button>
                </div>

                {/* Comments Section */}
                {activeCommentsPostId === post.id && (
                  <CommentsSection
                    postId={post.id}
                    usersMap={usersMap}
                    onOpenAuth={onOpenAuth}
                    onSelectUser={onSelectUser}
                    onOpenReport={onOpenReport}
                    onToast={(msg, type) => setToast({ show: true, message: msg, type })}
                    onConfirmModal={setConfirmModal}
                  />
                )}
              </article>
            )
          })
        )}
      </div>

      {/* Interactive Gallery Lightbox */}
      {lightboxGallery && lightboxGallery.images && lightboxGallery.images.length > 0 && (
        <div className="lightbox-overlay" onClick={() => setLightboxGallery(null)}>
          <div className="lightbox-content gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxGallery.images[lightboxGallery.activeIndex]}
              alt={`Photo ${lightboxGallery.activeIndex + 1}`}
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

      {/* Video Lightbox Modal */}
      {lightboxVideo && (
        <div className="lightbox-overlay" onClick={() => setLightboxVideo(null)}>
          <div className="lightbox-content video-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <video
              src={lightboxVideo}
              controls
              autoPlay
              playsInline
              className="lightbox-video-player"
            />
            <button className="lightbox-close" onClick={() => setLightboxVideo(null)} title="ปิด (Esc)">✕</button>
          </div>
        </div>
      )}

      {/* Likers Modal */}
      <LikersModal
        isOpen={Boolean(likersModalPost)}
        post={likersModalPost}
        usersMap={usersMap}
        onClose={() => setLikersModalPost(null)}
        onSelectUser={onSelectUser}
      />

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="edit-post-modal-overlay" onClick={() => setEditingPost(null)}>
          <div className="edit-post-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="edit-post-modal-header">
              <div className="edit-post-title-group">
                <span className="edit-post-icon">✏️</span>
                <h3>แก้ไขโพสต์</h3>
              </div>
              <button
                type="button"
                className="edit-post-close-btn"
                onClick={() => setEditingPost(null)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePostEdit} className="edit-post-form">
              <div className="edit-post-field">
                <label className="edit-post-label">หัวข้อ / ข้อความหลัก:</label>
                <input
                  type="text"
                  value={editPostTitle}
                  onChange={(e) => setEditPostTitle(e.target.value)}
                  maxLength={100}
                  required
                  className="edit-post-input"
                  placeholder="ใส่หัวข้อผลงาน..."
                />
              </div>

              <div className="edit-post-field">
                <label className="edit-post-label">คำอธิบายเพิ่มเติม (แคปชั่น):</label>
                <textarea
                  value={editPostCaption}
                  onChange={(e) => setEditPostCaption(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="edit-post-textarea"
                  placeholder="เขียนแคปชั่น เล่าเรื่องราว หรือคำอธิบาย..."
                />
              </div>

              <div className="edit-post-actions">
                <button
                  type="button"
                  className="edit-post-cancel-btn"
                  onClick={() => setEditingPost(null)}
                  disabled={isSavingPost}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="edit-post-save-btn"
                  disabled={!editPostTitle.trim() || isSavingPost}
                >
                  {isSavingPost ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animated Toast Feedback */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      {/* Reusable Confirm Modal */}
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

function CommentsSection({ postId, usersMap = {}, onOpenAuth, onSelectUser, onOpenReport, onToast, onConfirmModal }) {
  const { currentUser, userProfile, isAdmin, isBanned } = useAuth()
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentImage, setCommentImage] = useState(null)
  const [sending, setSending] = useState(false)

  // Reply & Edit state for comments
  const [replyingToComment, setReplyingToComment] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editCommentText, setEditCommentText] = useState('')

  useEffect(() => {
    const q = collection(firestore, 'community_posts', postId, 'comments')

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)
        return timeA - timeB
      })
      setComments(docs)
    })

    return () => unsubscribe()
  }, [postId])

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.75 })
      setCommentImage(compressed)
    } catch (err) {
      onToast?.(err.message, 'error')
    }
  }

  const handleStartReplyComment = (comment, authorName) => {
    setReplyingToComment({
      id: comment.id,
      authorName,
      textSnippet: comment.text?.slice(0, 50) || (comment.imageUrl ? '📷 รูปภาพ' : 'ข้อความ'),
    })
  }

  const handleJumpToComment = (targetCommentId) => {
    if (!targetCommentId) return
    const el = document.getElementById(`comment-${targetCommentId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-pulse')
      setTimeout(() => el.classList.remove('highlight-pulse'), 2200)
    } else {
      onToast?.('ความคิดเห็นต้นฉบับอาจถูกลบไปแล้ว', 'info')
    }
  }

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id)
    setEditCommentText(comment.text || '')
  }

  const handleSaveEditComment = async (commentId) => {
    if (!editCommentText.trim()) return
    try {
      const commentRef = doc(firestore, 'community_posts', postId, 'comments', commentId)
      await updateDoc(commentRef, {
        text: editCommentText.trim(),
        isEdited: true,
        editedAt: serverTimestamp(),
      })
      setEditingCommentId(null)
      setEditCommentText('')
      onToast?.('แก้ไขความคิดเห็นเรียบร้อยแล้ว ✓', 'success')
    } catch (err) {
      console.error('Error updating comment:', err)
      onToast?.('แก้ไขความคิดเห็นไม่สำเร็จ: ' + err.message, 'error')
    }
  }

  const handleSendComment = async (e) => {
    e.preventDefault()
    if (!currentUser || isBanned) return
    if (!commentText.trim() && !commentImage) return

    setSending(true)
    const text = commentText.trim()
    const img = commentImage
    const currentReplyTo = replyingToComment

    setCommentText('')
    setCommentImage(null)
    setReplyingToComment(null)

    const commentAuthorPhoto = userProfile?.photoURL || (isAdmin ? '/profile.jpg' : '/NewUserProfile.png')
    const commentAuthorRole = isAdmin ? 'admin' : (userProfile?.role || 'member')

    // Optimistic UI display
    const optimisticId = 'temp_' + Date.now()
    setComments((prev) => [
      ...prev,
      {
        id: optimisticId,
        text,
        imageUrl: img || null,
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || 'สมาชิก',
        authorPhoto: commentAuthorPhoto,
        authorRole: commentAuthorRole,
        replyTo: currentReplyTo,
        isEdited: false,
        createdAt: null,
      },
    ])

    try {
      await addDoc(collection(firestore, 'community_posts', postId, 'comments'), {
        text,
        imageUrl: img || null,
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || 'สมาชิก',
        authorPhoto: commentAuthorPhoto,
        authorRole: commentAuthorRole,
        replyTo: currentReplyTo ? {
          id: currentReplyTo.id,
          authorName: currentReplyTo.authorName,
          textSnippet: currentReplyTo.textSnippet || '',
        } : null,
        isEdited: false,
        createdAt: serverTimestamp(),
      })

      // Update comment count on post
      const postRef = doc(firestore, 'community_posts', postId)
      await updateDoc(postRef, {
        commentCount: comments.length + 1,
      })
      onToast?.('ส่งความคิดเห็นเรียบร้อยแล้ว ✓', 'success')
    } catch (err) {
      console.error('Error posting comment:', err)
      onToast?.('ส่งความคิดเห็นไม่สำเร็จ: ' + err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteComment = (commentId) => {
    onConfirmModal?.({
      isOpen: true,
      title: 'ลบความคิดเห็น',
      message: 'คุณต้องการลบความคิดเห็นนี้ใช่หรือไม่?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firestore, 'community_posts', postId, 'comments', commentId))
          const postRef = doc(firestore, 'community_posts', postId)
          await updateDoc(postRef, {
            commentCount: Math.max(comments.length - 1, 0),
          })
          onToast?.('ลบความคิดเห็นแล้ว', 'info')
        } catch (err) {
          console.error(err)
          onToast?.('ลบความคิดเห็นไม่สำเร็จ: ' + err.message, 'error')
        } finally {
          onConfirmModal?.({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  return (
    <div className="comments-section">
      <div className="comments-list">
        {comments.map((comment) => {
          const commentAuthorLive = usersMap[comment.authorId]
          const isOwn = currentUser?.uid === comment.authorId
          const canDelete = isOwn || isAdmin
          const isCommentAdmin = Boolean(
            commentAuthorLive?.role === 'admin' ||
            comment.authorRole === 'admin' ||
            commentAuthorLive?.email === 'moritz2541@gmail.com' ||
            comment.authorName === 'Moritz' ||
            comment.authorName === 'มอริทส์ ชทริคเกอร์' ||
            comment.authorName === 'คิดถึงคนเก่า'
          )
          const isCommentBanned = Boolean(commentAuthorLive?.isBanned)
          const rawCommentPhoto = commentAuthorLive?.photoURL || comment.authorPhoto
          const commentAvatar = isCommentBanned
            ? '/BandAccount.png'
            : ((rawCommentPhoto && (rawCommentPhoto !== '/profile.jpg' || isCommentAdmin))
                ? rawCommentPhoto
                : (isCommentAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
          const commentAuthorName = commentAuthorLive?.displayName || comment.authorName || 'สมาชิก'

          return (
            <div key={comment.id} id={`comment-${comment.id}`} className="comment-item">
              <img
                src={commentAvatar}
                alt={commentAuthorName}
                className="comment-avatar"
                onClick={() => onSelectUser(commentAuthorLive || {
                  uid: comment.authorId,
                  displayName: commentAuthorName,
                  photoURL: commentAvatar,
                  role: isCommentAdmin ? 'admin' : (comment.authorRole || 'member'),
                })}
              />
              <div className="comment-bubble">
                <div className="comment-header">
                  <span
                    className="comment-author"
                    onClick={() => onSelectUser(commentAuthorLive || {
                      uid: comment.authorId,
                      displayName: commentAuthorName,
                      photoURL: commentAvatar,
                      role: isCommentAdmin ? 'admin' : (comment.authorRole || 'member'),
                    })}
                  >
                    {commentAuthorName}
                  </span>
                  <div className="comment-actions-bar">
                    {currentUser && !isBanned && (
                      <button
                        type="button"
                        className="comment-action-btn reply-btn"
                        onClick={() => handleStartReplyComment(comment, commentAuthorName)}
                        title="ตอบกลับความคิดเห็นนี้"
                      >
                        ↩️
                      </button>
                    )}
                    {isOwn && editingCommentId !== comment.id && (
                      <button
                        type="button"
                        className="comment-action-btn edit-btn"
                        onClick={() => handleStartEditComment(comment)}
                        title="แก้ไขความคิดเห็น"
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="comment-delete-btn"
                        onClick={() => handleDeleteComment(comment.id)}
                        title="ลบคอมเมนต์"
                      >
                        ✕
                      </button>
                    )}
                    {currentUser && !isOwn && (
                      <button
                        type="button"
                        className="comment-report-btn"
                        onClick={() => onOpenReport({
                          id: comment.id,
                          type: 'comment',
                          content: comment.text,
                          imageUrl: comment.imageUrl,
                          authorId: comment.authorId,
                          authorName: comment.authorName,
                        })}
                        title="รายงานความคิดเห็น"
                      >
                        🚩
                      </button>
                    )}
                  </div>
                </div>

                {/* Reply Quote inside Comment */}
                {comment.replyTo && (
                  <div
                    className="comment-reply-quote clickable"
                    onClick={() => handleJumpToComment(comment.replyTo.id)}
                    title="คลิกเพื่อเลื่อนไปยังความคิดเห็นที่ตอบกลับ"
                  >
                    <span className="comment-reply-author">↳ ตอบกลับ @{comment.replyTo.authorName}:</span>
                    <span className="comment-reply-snippet">{comment.replyTo.textSnippet}</span>
                  </div>
                )}

                {/* Comment Text or Inline Edit */}
                {editingCommentId === comment.id ? (
                  <div className="comment-inline-edit-box">
                    <input
                      type="text"
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                      className="comment-inline-edit-input"
                      autoFocus
                      maxLength={300}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditComment(comment.id)
                        if (e.key === 'Escape') setEditingCommentId(null)
                      }}
                    />
                    <div className="comment-inline-edit-actions">
                      <button
                        type="button"
                        className="comment-edit-save-btn"
                        onClick={() => handleSaveEditComment(comment.id)}
                      >
                        บันทึก
                      </button>
                      <button
                        type="button"
                        className="comment-edit-cancel-btn"
                        onClick={() => setEditingCommentId(null)}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  comment.text && (
                    <p className="comment-text">
                      {comment.text}
                      {comment.isEdited && <span className="comment-edited-tag">(แก้ไขแล้ว)</span>}
                    </p>
                  )
                )}

                {comment.imageUrl && (
                  <div className="comment-image-wrapper">
                    <img src={comment.imageUrl} alt="Attached" className="comment-attached-img" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comment Input */}
      {currentUser ? (
        <form onSubmit={handleSendComment} className="comment-input-form">
          {/* Comment Reply Preview Banner */}
          {replyingToComment && (
            <div className="comment-reply-banner">
              <div className="comment-reply-banner-info">
                <span className="comment-reply-banner-label">↳ ตอบกลับ <strong>@{replyingToComment.authorName}</strong></span>
                <span className="comment-reply-banner-snippet">{replyingToComment.textSnippet}</span>
              </div>
              <button
                type="button"
                className="comment-reply-cancel-btn"
                onClick={() => setReplyingToComment(null)}
                title="ยกเลิกการตอบกลับ"
              >
                ✕
              </button>
            </div>
          )}

          {commentImage && (
            <div className="comment-preview-bar">
              <img src={commentImage} alt="Attachment" />
              <button type="button" onClick={() => setCommentImage(null)}>✕ ลบรูป</button>
            </div>
          )}
          <div className="comment-input-row">
            <label className="comment-attach-btn" title="แนบรูปภาพ">
              📷
              <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            </label>
            <input
              type="text"
              placeholder="เขียนความคิดเห็นของคุณ..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={300}
            />
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={(!commentText.trim() && !commentImage) || sending}
            >
              ส่ง
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-login-hint">
          <button onClick={onOpenAuth} className="auth-link-btn">
            เข้าสู่ระบบ
          </button>{' '}
          เพื่อร่วมแสดงความคิดเห็นและแนบรูปภาพ
        </div>
      )}
    </div>
  )
}

