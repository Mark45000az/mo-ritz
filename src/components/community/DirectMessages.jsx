import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { compressImage } from '../../lib/imageUpload'
import { getUserStatusText } from '../../lib/presence'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'
import '../../styles/DirectMessages.css'

// Get deterministic chat ID between two users
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_')
}

export default function DirectMessages({ activeUser, onSelectUser, onOpenAuth }) {
  const { currentUser, userProfile, isBanned } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedPartner, setSelectedPartner] = useState(activeUser || null)
  const [usersMap, setUsersMap] = useState({})
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null) // 'image' | 'video'
  const [sending, setSending] = useState(false)

  // Edit message state
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editText, setEditText] = useState('')

  // Reply message state
  const [replyingTo, setReplyingTo] = useState(null)

  // Delete / Unsend modal state
  const [deleteModalMsg, setDeleteModalMsg] = useState(null)

  // Lightbox for image preview
  const [lightboxImage, setLightboxImage] = useState(null)

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const messagesEndRef = useRef(null)

  // Real-time listener for users directory
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

  // Block status
  const blockedUsers = userProfile?.blockedUsers || []
  const isBlocked = selectedPartner && blockedUsers.includes(selectedPartner.uid)

  // Update selected partner when prop changes
  useEffect(() => {
    if (activeUser) {
      setSelectedPartner(activeUser)
    }
  }, [activeUser])

  // Fetch recent conversations for current user
  useEffect(() => {
    if (!currentUser) return

    const q = query(
      collection(firestore, 'community_chats'),
      where('participants', 'array-contains', currentUser.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      list.sort((a, b) => {
        const timeA = a.lastUpdatedAt?.toMillis?.() || 0
        const timeB = b.lastUpdatedAt?.toMillis?.() || 0
        return timeB - timeA
      })
      setConversations(list)
    })

    return () => unsubscribe()
  }, [currentUser])

  // Real-time listener for messages with selected partner
  useEffect(() => {
    if (!currentUser || !selectedPartner) {
      setMessages([])
      return
    }

    const chatId = getChatId(currentUser.uid, selectedPartner.uid)
    const q = query(
      collection(firestore, 'community_chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      setMessages(msgs)
    })

    return () => unsubscribe()
  }, [currentUser, selectedPartner])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle Media Attachment Select (Image / Video / GIF)
  const handleMediaSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (file.type.startsWith('video/')) {
        if (file.size > 20 * 1024 * 1024) {
          setToast({ show: true, message: 'ขนาดไฟล์วิดีโอต้องไม่เกิน 20MB', type: 'error' })
          return
        }
        setMediaType('video')
        const reader = new FileReader()
        reader.onload = () => setMediaPreview(reader.result)
        reader.readAsDataURL(file)
      } else if (file.type === 'image/gif') {
        if (file.size > 5 * 1024 * 1024) {
          setToast({ show: true, message: 'ขนาดไฟล์ GIF ต้องไม่เกิน 5MB', type: 'error' })
          return
        }
        setMediaType('image')
        const reader = new FileReader()
        reader.onload = () => setMediaPreview(reader.result)
        reader.readAsDataURL(file)
      } else {
        setMediaType('image')
        const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.8 })
        setMediaPreview(compressed)
      }
    } catch (err) {
      setToast({ show: true, message: 'อ่านไฟล์ไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Send Message (Text and/or Media)
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!currentUser || !selectedPartner || isBanned || isBlocked || sending) return
    if (!inputText.trim() && !mediaPreview) return

    const text = inputText.trim()
    const currentMedia = mediaPreview
    const currentMediaType = mediaType
    const currentReplyTo = replyingTo

    setInputText('')
    setMediaPreview(null)
    setMediaType(null)
    setReplyingTo(null)
    setSending(true)

    const chatId = getChatId(currentUser.uid, selectedPartner.uid)

    try {
      const chatDocRef = doc(firestore, 'community_chats', chatId)
      const lastSnippet = text || (currentMediaType === 'video' ? '🎬 ส่งวิดีโอ' : '📷 ส่งรูปภาพ')

      await setDoc(chatDocRef, {
        participants: [currentUser.uid, selectedPartner.uid],
        participantDetails: {
          [currentUser.uid]: {
            displayName: userProfile?.displayName || 'สมาชิก',
            photoURL: userProfile?.photoURL || (userProfile?.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'),
          },
          [selectedPartner.uid]: {
            displayName: selectedPartner.displayName || 'สมาชิก',
            photoURL: selectedPartner.photoURL || (selectedPartner.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'),
          },
        },
        lastMessage: lastSnippet,
        lastUpdatedAt: serverTimestamp(),
      }, { merge: true })

      await addDoc(collection(firestore, 'community_chats', chatId, 'messages'), {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'สมาชิก',
        senderPhoto: userProfile?.photoURL || (userProfile?.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'),
        text,
        imageUrl: currentMediaType === 'image' ? currentMedia : null,
        videoUrl: currentMediaType === 'video' ? currentMedia : null,
        mediaType: currentMediaType || null,
        replyTo: currentReplyTo ? {
          id: currentReplyTo.id,
          senderName: currentReplyTo.senderName,
          textSnippet: currentReplyTo.textSnippet || '',
        } : null,
        isEdited: false,
        isUnsent: false,
        deletedFor: [],
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error sending DM:', err)
      setToast({ show: true, message: 'ส่งข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setSending(false)
    }
  }

  // Reply Message Handler
  const handleStartReply = (msg) => {
    setReplyingTo({
      id: msg.id,
      senderName: msg.senderName || 'สมาชิก',
      textSnippet: msg.text?.slice(0, 60) || (msg.imageUrl ? '📷 รูปภาพ' : msg.videoUrl ? '🎬 วิดีโอ' : 'ข้อความ'),
    })
  }

  // Edit Message Handlers
  const handleStartEdit = (msg) => {
    setEditingMsgId(msg.id)
    setEditText(msg.text || '')
  }

  const handleSaveEdit = async (msgId) => {
    if (!editText.trim()) return
    const chatId = getChatId(currentUser.uid, selectedPartner.uid)
    try {
      const msgRef = doc(firestore, 'community_chats', chatId, 'messages', msgId)
      await updateDoc(msgRef, {
        text: editText.trim(),
        isEdited: true,
      })
      setEditingMsgId(null)
      setToast({ show: true, message: 'แก้ไขข้อความเรียบร้อยแล้ว ✓', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'แก้ไขข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Unsend Message (for everyone)
  const handleUnsend = async (msg) => {
    const chatId = getChatId(currentUser.uid, selectedPartner.uid)
    try {
      const msgRef = doc(firestore, 'community_chats', chatId, 'messages', msg.id)
      await updateDoc(msgRef, {
        isUnsent: true,
        text: 'ยกเลิกข้อความแล้ว',
        imageUrl: null,
        videoUrl: null,
      })
      setDeleteModalMsg(null)
      setToast({ show: true, message: 'ยกเลิกข้อความสำหรับทุกคนแล้ว', type: 'info' })
    } catch (err) {
      setToast({ show: true, message: 'ยกเลิกข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Delete for me
  const handleDeleteForMe = async (msg) => {
    const chatId = getChatId(currentUser.uid, selectedPartner.uid)
    try {
      const msgRef = doc(firestore, 'community_chats', chatId, 'messages', msg.id)
      await updateDoc(msgRef, {
        deletedFor: arrayUnion(currentUser.uid),
      })
      setDeleteModalMsg(null)
      setToast({ show: true, message: 'ลบข้อความเฉพาะฝั่งคุณแล้ว', type: 'info' })
    } catch (err) {
      setToast({ show: true, message: 'ลบข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Toggle Block User
  const handleToggleBlock = async () => {
    if (!currentUser || !selectedPartner) return
    const partnerId = selectedPartner.uid
    const newBlocked = !isBlocked

    try {
      const userRef = doc(firestore, 'users', currentUser.uid)
      await updateDoc(userRef, {
        blockedUsers: newBlocked ? arrayUnion(partnerId) : arrayRemove(partnerId),
      })
      setToast({
        show: true,
        message: newBlocked ? `บล็อก ${selectedPartner.displayName} แล้ว` : `ปลดบล็อก ${selectedPartner.displayName} แล้ว`,
        type: newBlocked ? 'warn' : 'success',
      })
    } catch (err) {
      setToast({ show: true, message: 'ดำเนินการไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Delete whole chat conversation
  const handleDeleteChat = () => {
    if (!currentUser || !selectedPartner) return

    setConfirmModal({
      isOpen: true,
      title: 'ลบบทสนทนา',
      message: `คุณต้องการลบแชททั้งหมดกับ "${selectedPartner.displayName}" ใช่หรือไม่?`,
      confirmVariant: 'danger',
      onConfirm: async () => {
        const chatId = getChatId(currentUser.uid, selectedPartner.uid)
        try {
          await deleteDoc(doc(firestore, 'community_chats', chatId))
          setSelectedPartner(null)
          setMessages([])
          setToast({ show: true, message: 'ลบบทสนทนาเรียบร้อยแล้ว', type: 'info' })
        } catch (err) {
          setToast({ show: true, message: 'ลบบทสนทนาไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      },
    })
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  if (!currentUser) {
    return (
      <div className="dm-empty-auth">
        <div className="dm-empty-icon">✉️</div>
        <h3>เข้าสู่ระบบเพื่อใช้งานแชทส่วนตัว</h3>
        <p>ส่งข้อความแบบ 1-on-1 แลกเปลี่ยนผลงานและพูดคุยกับเพื่อนในคอมมูนิตี้</p>
        <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
          เข้าสู่ระบบ
        </button>
      </div>
    )
  }

  return (
    <div className="dm-layout">
      {/* Sidebar: Conversations List */}
      <div className={`dm-sidebar ${selectedPartner ? 'has-partner' : ''}`}>
        <div className="dm-sidebar-header">
          <h3>ข้อความส่วนตัว</h3>
        </div>

        <div className="dm-conversations-list">
          {conversations.length === 0 ? (
            <div className="dm-no-chats">
              <p>ยังไม่มีข้อความส่วนตัว</p>
              <small>กดที่ชื่อหรือรูปของสมาชิกในห้องใดก็ได้เพื่อเริ่มส่งข้อความ</small>
            </div>
          ) : (
            conversations.map((chat) => {
              const otherUid = chat.participants.find((id) => id !== currentUser.uid)
              const otherUserLive = usersMap[otherUid]
              const otherUser = otherUserLive || chat.participantDetails?.[otherUid] || { displayName: 'สมาชิก' }
              const isOtherAdmin = otherUser.role === 'admin' || otherUser.email === 'moritz2541@gmail.com'
              const isOtherBanned = Boolean(otherUser.isBanned)
              const rawOtherPhoto = otherUser.photoURL
              const otherAvatar = isOtherBanned
                ? '/BandAccount.png'
                : ((rawOtherPhoto && (rawOtherPhoto !== '/profile.jpg' || isOtherAdmin))
                    ? rawOtherPhoto
                    : (isOtherAdmin ? '/profile.jpg' : '/NewUserProfile.png'))
              const isSelected = selectedPartner?.uid === otherUid

              return (
                <div
                  key={chat.id}
                  className={`dm-conv-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedPartner({ uid: otherUid, ...otherUser })}
                >
                  <img
                    src={otherAvatar}
                    alt={otherUser.displayName}
                    className="dm-conv-avatar"
                  />
                  <div className="dm-conv-info">
                    <span className="dm-conv-name">{otherUser.displayName}</span>
                    <span className="dm-conv-last-msg">{chat.lastMessage || 'เริ่มการสนทนา'}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Active Chat Window */}
      <div className={`dm-chat-window ${selectedPartner ? 'has-partner' : ''}`}>
        {selectedPartner ? (
          <>
            {(() => {
              const livePartner = (selectedPartner?.uid && usersMap[selectedPartner.uid]) || selectedPartner
              const isPartnerAdmin = livePartner.role === 'admin' || livePartner.email === 'moritz2541@gmail.com'
              const isPartnerBanned = Boolean(livePartner.isBanned)
              const rawPartnerPhoto = livePartner.photoURL
              const partnerAvatar = isPartnerBanned
                ? '/BandAccount.png'
                : ((rawPartnerPhoto && (rawPartnerPhoto !== '/profile.jpg' || isPartnerAdmin))
                    ? rawPartnerPhoto
                    : (isPartnerAdmin ? '/profile.jpg' : '/NewUserProfile.png'))

              return (
                <div className="dm-chat-header">
                  <button
                    type="button"
                    className="dm-mobile-back-btn"
                    onClick={() => setSelectedPartner(null)}
                    title="กลับไปหน้ารายชื่อ"
                  >
                    ←
                  </button>
                  <img
                    src={partnerAvatar}
                    alt={livePartner.displayName}
                    className="dm-partner-avatar"
                    onClick={() => onSelectUser(livePartner)}
                  />
                  <div className="dm-partner-info">
                    <span
                      className="dm-partner-name"
                      onClick={() => onSelectUser(livePartner)}
                    >
                      {livePartner.displayName}
                    </span>
                    <span className="dm-partner-status">
                      {isBlocked
                        ? '🚫 คุณบล็อกผู้ใช้นี้อยู่'
                        : getUserStatusText(livePartner)}
                    </span>
                  </div>

                  {/* Chat action controls */}
                  <div className="dm-header-actions">
                    <button
                      type="button"
                      className={`dm-control-btn ${isBlocked ? 'unblock' : 'block'}`}
                      onClick={handleToggleBlock}
                      title={isBlocked ? 'ปลดบล็อก' : 'บล็อกผู้ใช้'}
                    >
                      {isBlocked ? 'ปลดบล็อก' : '🚫 บล็อก'}
                    </button>
                    <button
                      type="button"
                      className="dm-control-btn delete"
                      onClick={handleDeleteChat}
                      title="ลบบทสนทนานี้"
                    >
                      🗑️ ลบแชท
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Messages Feed */}
            <div className="dm-messages-feed">
              {messages.length === 0 && (
                <div className="dm-start-hint">
                  <p>เริ่มพิมพ์ข้อความหรือส่งรูปภาพ/วิดีโอเพื่อพูดคุยกับ {selectedPartner.displayName} ได้เลย</p>
                </div>
              )}

              {messages
                .filter((msg) => !msg.deletedFor?.includes(currentUser.uid))
                .map((msg) => {
                  const isMine = msg.senderId === currentUser.uid
                  const isEditing = editingMsgId === msg.id

                  return (
                    <div key={msg.id} className={`dm-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                      <div className="dm-msg-bubble-group">
                        <div className={`dm-msg-bubble ${msg.isUnsent ? 'unsent' : ''}`}>
                          {msg.isUnsent ? (
                            <p className="dm-msg-unsent-text">🚫 ข้อความนี้ถูกยกเลิกแล้ว</p>
                          ) : (
                            <>
                              {/* Reply Quote */}
                              {msg.replyTo && (
                                <div className="dm-reply-quote">
                                  <span className="dm-reply-quote-sender">↳ ตอบกลับ @{msg.replyTo.senderName}:</span>
                                  <span className="dm-reply-quote-text">{msg.replyTo.textSnippet}</span>
                                </div>
                              )}

                              {/* Attached Image */}
                              {msg.imageUrl && (
                                <div className="dm-msg-media-box">
                                  <img
                                    src={msg.imageUrl}
                                    alt="รูปภาพแนบ"
                                    className="dm-msg-media-img"
                                    onClick={() => setLightboxImage(msg.imageUrl)}
                                    title="คลิกเพื่อดูรูปขนาดเต็ม"
                                  />
                                </div>
                              )}

                              {/* Attached Video */}
                              {msg.videoUrl && (
                                <div className="dm-msg-media-box">
                                  <video
                                    src={msg.videoUrl}
                                    controls
                                    playsInline
                                    className="dm-msg-media-video"
                                  />
                                </div>
                              )}

                              {/* Text or Inline Edit Field */}
                              {isEditing ? (
                                <div className="dm-inline-edit-box">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="dm-inline-edit-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(msg.id)
                                      if (e.key === 'Escape') setEditingMsgId(null)
                                    }}
                                  />
                                  <div className="dm-inline-edit-actions">
                                    <button
                                      type="button"
                                      className="dm-edit-save-btn"
                                      onClick={() => handleSaveEdit(msg.id)}
                                    >
                                      บันทึก
                                    </button>
                                    <button
                                      type="button"
                                      className="dm-edit-cancel-btn"
                                      onClick={() => setEditingMsgId(null)}
                                    >
                                      ยกเลิก
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                msg.text && <p className="dm-msg-text">{msg.text}</p>
                              )}

                              <div className="dm-msg-meta">
                                {msg.isEdited && <span className="dm-msg-edited-tag">(แก้ไขแล้ว)</span>}
                                <span className="dm-msg-time">{formatTime(msg.createdAt)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Action buttons (Reply, Edit & Delete/Unsend) */}
                        {!msg.isUnsent && (
                          <div className="dm-msg-actions-bar">
                            <button
                              type="button"
                              className="dm-msg-action-btn"
                              onClick={() => handleStartReply(msg)}
                              title="ตอบกลับข้อความนี้"
                            >
                              ↩️
                            </button>
                            {isMine && !isEditing && (
                              <button
                                type="button"
                                className="dm-msg-action-btn"
                                onClick={() => handleStartEdit(msg)}
                                title="แก้ไขข้อความ"
                              >
                                ✏️
                              </button>
                            )}
                            <button
                              type="button"
                              className="dm-msg-action-btn"
                              onClick={() => setDeleteModalMsg(msg)}
                              title={isMine ? 'ลบหรือยกเลิกข้อความ' : 'ลบสำหรับฉัน'}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview Bar */}
            {replyingTo && (
              <div className="dm-reply-preview-bar">
                <div className="dm-reply-preview-info">
                  <span className="dm-reply-preview-label">↳ กำลังตอบกลับ <strong>@{replyingTo.senderName}</strong></span>
                  <span className="dm-reply-preview-snippet">{replyingTo.textSnippet}</span>
                </div>
                <button
                  type="button"
                  className="dm-reply-cancel-btn"
                  onClick={() => setReplyingTo(null)}
                  title="ยกเลิกการตอบกลับ"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Media Attachment Preview Bar */}
            {mediaPreview && (
              <div className="dm-attachment-preview-bar">
                <div className="dm-attachment-thumb">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} className="dm-thumb-video" />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="dm-thumb-img" />
                  )}
                  <button
                    type="button"
                    className="dm-remove-attachment-btn"
                    onClick={() => {
                      setMediaPreview(null)
                      setMediaType(null)
                    }}
                    title="ลบสื่อที่แนบ"
                  >
                    ✕
                  </button>
                </div>
                <span className="dm-attachment-name">
                  {mediaType === 'video' ? '🎬 แนบวิดีโอแล้ว' : '📷 แนบรูปภาพแล้ว'}
                </span>
              </div>
            )}

            {isBlocked ? (
              <div className="dm-blocked-bar">
                <span>คุณได้บล็อกผู้ใช้งานนี้ ไม่สามารถส่งข้อความได้</span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="dm-input-form">
                {/* Media Attachment Button */}
                <label className="dm-attach-btn" title="แนบรูปภาพหรือวิดีโอ">
                  📎
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    style={{ display: 'none' }}
                    disabled={isBanned}
                  />
                </label>

                <input
                  type="text"
                  placeholder={`ส่งข้อความหา ${selectedPartner.displayName}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  maxLength={400}
                  disabled={isBanned}
                />
                <button
                  type="submit"
                  className="dm-send-btn"
                  disabled={(!inputText.trim() && !mediaPreview) || sending || isBanned}
                >
                  ส่ง
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="dm-placeholder-state">
            <div className="dm-placeholder-icon">💬</div>
            <h3>เลือกบทสนทนา</h3>
            <p>เลือกบทสนทนาจากแถบด้านซ้าย หรือกดที่โปรไฟล์สมาชิกเพื่อเริ่มคุย</p>
          </div>
        )}
      </div>

      {/* Delete / Unsend Choice Modal */}
      {deleteModalMsg && (
        <div className="dm-choice-modal-overlay" onClick={() => setDeleteModalMsg(null)}>
          <div className="dm-choice-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dm-choice-modal-icon">🗑️</div>
            <h3 className="dm-choice-modal-title">จัดการข้อความ</h3>
            <p className="dm-choice-modal-desc">
              {deleteModalMsg.senderId === currentUser.uid
                ? 'คุณต้องการยกเลิกข้อความสำหรับทุกคน หรือลบเฉพาะหน้าต่างของคุณ?'
                : 'ลบข้อความนี้ออกจากหน้าต่างของคุณ?'}
            </p>

            <div className="dm-choice-modal-buttons">
              {deleteModalMsg.senderId === currentUser.uid && (
                <button
                  type="button"
                  className="dm-choice-btn unsend"
                  onClick={() => handleUnsend(deleteModalMsg)}
                >
                  🚫 ยกเลิกข้อความ (ลบสำหรับทุกคน)
                </button>
              )}
              <button
                type="button"
                className="dm-choice-btn delete-me"
                onClick={() => handleDeleteForMe(deleteModalMsg)}
              >
                🗑️ ลบสำหรับฉัน (เฉพาะฝั่งฉัน)
              </button>
              <button
                type="button"
                className="dm-choice-btn cancel"
                onClick={() => setDeleteModalMsg(null)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content">
            <img src={lightboxImage} alt="Enlarged" />
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  )
}
