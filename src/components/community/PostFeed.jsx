import { useState, useEffect } from 'react'
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
import Toast from './Toast'
import '../../styles/PostFeed.css'

export default function PostFeed({ type, onOpenCreate, onOpenAuth, onSelectUser, onOpenReport }) {
  const { currentUser, isAdmin, isBanned } = useAuth()
  const [posts, setPosts] = useState([])
  const [myPendingCount, setMyPendingCount] = useState(0)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

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
            const isLiked = currentUser && post.likes?.includes(currentUser.uid)
            const canDelete = currentUser?.uid === post.authorId || isAdmin
            const isPostAdmin = post.authorRole === 'admin' ||
                                post.authorName === 'Moritz' ||
                                post.authorName === 'มอริทส์ ชทริคเกอร์' ||
                                post.authorName === 'คิดถึงคนเก่า'
            const postAvatar = (post.authorPhoto && (post.authorPhoto !== '/profile.jpg' || isPostAdmin))
              ? post.authorPhoto
              : (isPostAdmin ? '/profile.jpg' : '/NewUserProfile.png')

            return (
              <article key={post.id} className="post-card">
                {/* Author Info */}
                <div className="post-card-header">
                  <img
                    src={postAvatar}
                    alt={post.authorName}
                    className="post-author-avatar"
                    onClick={() => onSelectUser({
                      uid: post.authorId,
                      displayName: post.authorName,
                      photoURL: postAvatar,
                      role: isPostAdmin ? 'admin' : (post.authorRole || 'member'),
                    })}
                  />
                  <div className="post-author-details">
                    <span
                      className="post-author-name"
                      onClick={() => onSelectUser({
                        uid: post.authorId,
                        displayName: post.authorName,
                        photoURL: postAvatar,
                        role: isPostAdmin ? 'admin' : (post.authorRole || 'member'),
                      })}
                    >
                      {post.authorName}
                    </span>
                    <span className="post-timestamp">{formatTime(post.createdAt)}</span>
                  </div>

                  {/* Actions Dropdown / Delete / Report */}
                  <div className="post-header-actions">
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

                {/* Image */}
                {post.imageUrl && (
                  <div
                    className="post-card-image-box"
                    onClick={() => setLightboxImage(post.imageUrl)}
                    title="คลิกเพื่อดูรูปขนาดเต็ม"
                  >
                    <img src={post.imageUrl} alt={post.title} loading="lazy" />
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="post-card-footer">
                  <button
                    className={`post-action-btn like-btn ${isLiked ? 'liked' : ''}`}
                    onClick={() => handleLike(post)}
                  >
                    <span className="btn-icon">{isLiked ? '❤️' : '🤍'}</span>
                    <span>{post.likeCount || 0}</span>
                  </button>

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

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content">
            <img src={lightboxImage} alt="Enlarged" />
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
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

function CommentsSection({ postId, onOpenAuth, onSelectUser, onOpenReport, onToast, onConfirmModal }) {
  const { currentUser, userProfile, isAdmin, isBanned } = useAuth()
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentImage, setCommentImage] = useState(null)
  const [sending, setSending] = useState(false)

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

  const handleSendComment = async (e) => {
    e.preventDefault()
    if (!currentUser || isBanned) return
    if (!commentText.trim() && !commentImage) return

    setSending(true)
    const text = commentText.trim()
    const img = commentImage

    setCommentText('')
    setCommentImage(null)

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
          const isOwn = currentUser?.uid === comment.authorId
          const canDelete = isOwn || isAdmin
          const isCommentAdmin = comment.authorRole === 'admin' ||
                                 comment.authorName === 'Moritz' ||
                                 comment.authorName === 'มอริทส์ ชทริคเกอร์' ||
                                 comment.authorName === 'คิดถึงคนเก่า'
          const commentAvatar = (comment.authorPhoto && (comment.authorPhoto !== '/profile.jpg' || isCommentAdmin))
            ? comment.authorPhoto
            : (isCommentAdmin ? '/profile.jpg' : '/NewUserProfile.png')

          return (
            <div key={comment.id} className="comment-item">
              <img
                src={commentAvatar}
                alt={comment.authorName}
                className="comment-avatar"
                onClick={() => onSelectUser({
                  uid: comment.authorId,
                  displayName: comment.authorName,
                  photoURL: commentAvatar,
                  role: isCommentAdmin ? 'admin' : (comment.authorRole || 'member'),
                })}
              />
              <div className="comment-bubble">
                <div className="comment-header">
                  <span
                    className="comment-author"
                    onClick={() => onSelectUser({
                      uid: comment.authorId,
                      displayName: comment.authorName,
                      photoURL: commentAvatar,
                      role: isCommentAdmin ? 'admin' : (comment.authorRole || 'member'),
                    })}
                  >
                    {comment.authorName}
                  </span>
                  <div className="comment-actions-bar">
                    {canDelete && (
                      <button
                        className="comment-delete-btn"
                        onClick={() => handleDeleteComment(comment.id)}
                        title="ลบคอมเมนต์"
                      >
                        ✕
                      </button>
                    )}
                    {currentUser && !isOwn && (
                      <button
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

                {comment.text && <p className="comment-text">{comment.text}</p>}

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

