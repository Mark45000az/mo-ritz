import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'
import '../../styles/GeneralChat.css'

const QUICK_EMOJIS = ['❤️', '😂', '👍', '🔥', '🎉', '😮', '😢']

export default function GeneralChat({ onOpenAuth, onSelectUser }) {
  const { currentUser, userProfile, isAdmin, isBanned } = useAuth()
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [allMembers, setAllMembers] = useState([])

  // Reply & Edit state
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editInputText, setEditInputText] = useState('')
  const [activeReactionMenuId, setActiveReactionMenuId] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  // Mention Autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(-1)

  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)

  // Real-time listener for users directory (for live profiles and mention autocomplete)
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const map = {}
      const list = []
      snapshot.docs.forEach((d) => {
        const u = { uid: d.id, ...d.data() }
        map[d.id] = u
        list.push(u)
      })
      setUsersMap(map)
      setAllMembers(list)
    })
    return () => unsub()
  }, [])

  // Real-time listener for general chat messages
  useEffect(() => {
    const q = query(
      collection(firestore, 'community_messages'),
      orderBy('createdAt', 'asc'),
      limit(120)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      setMessages(msgs)
    }, (err) => {
      console.error('Error fetching chat messages:', err)
    })

    return () => unsubscribe()
  }, [])

  // Real-time listener for typing indicator
  useEffect(() => {
    const q = collection(firestore, 'community_typing')

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now()
      const activeTyping = []

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data()
        if (
          data.channel === 'general' &&
          data.uid !== currentUser?.uid &&
          now - (data.timestamp || 0) < 4000
        ) {
          activeTyping.push(data.displayName || 'สมาชิก')
        }
      })

      setTypingUsers(activeTyping)
    })

    return () => {
      unsubscribe()
      if (currentUser) {
        deleteDoc(doc(firestore, 'community_typing', `general_${currentUser.uid}`)).catch(() => {})
      }
    }
  }, [currentUser])

  // Handle typing input change & mention query detection
  const handleInputChange = (e) => {
    const val = e.target.value
    const cursorPos = e.target.selectionStart || val.length
    setInputText(val)

    // Check if user is typing @something
    const textBeforeCursor = val.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9ก-๙_]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionIndex(atMatch.index)
    } else {
      setMentionQuery(null)
      setMentionIndex(-1)
    }

    if (!currentUser || isBanned) return

    setDoc(doc(firestore, 'community_typing', `general_${currentUser.uid}`), {
      channel: 'general',
      uid: currentUser.uid,
      displayName: userProfile?.displayName || 'สมาชิก',
      timestamp: Date.now(),
    }).catch(() => {})

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      deleteDoc(doc(firestore, 'community_typing', `general_${currentUser.uid}`)).catch(() => {})
    }, 2500)
  }

  // Jump to message
  const handleJumpToMessage = (targetMsgId) => {
    if (!targetMsgId) return
    const el = document.getElementById(`chat-msg-${targetMsgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-pulse')
      setTimeout(() => el.classList.remove('highlight-pulse'), 2200)
    } else {
      setToast({ show: true, message: 'ข้อความต้นฉบับอาจถูกลบหรืออยู่นอกช่วงที่แสดง', type: 'info' })
    }
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSend = async (e) => {
    e.preventDefault()
    if (!currentUser || isBanned || !inputText.trim() || sending) return

    const text = inputText.trim()
    setInputText('')
    setSending(false)

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    deleteDoc(doc(firestore, 'community_typing', `general_${currentUser.uid}`)).catch(() => {})

    const replyData = replyingTo ? {
      id: replyingTo.id,
      authorName: replyingTo.authorName,
      textSnippet: replyingTo.text?.slice(0, 60) || '',
    } : null

    setReplyingTo(null)

    try {
      await addDoc(collection(firestore, 'community_messages'), {
        text,
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || 'สมาชิก',
        authorPhoto: userProfile?.photoURL || (isAdmin ? '/profile.jpg' : '/NewUserProfile.png'),
        authorRole: userProfile?.role || 'member',
        replyTo: replyData,
        reactions: {},
        isEdited: false,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Failed to send message:', err)
      setToast({ show: true, message: 'ส่งข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Delete message
  const handleDelete = (msgId) => {
    setConfirmModal({
      isOpen: true,
      title: 'ลบข้อความ',
      message: 'คุณต้องการลบข้อความนี้ใช่หรือไม่?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firestore, 'community_messages', msgId))
          setToast({ show: true, message: 'ลบข้อความเรียบร้อยแล้ว', type: 'info' })
        } catch (err) {
          console.error('Failed to delete message:', err)
          setToast({ show: true, message: 'ลบข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  // Start Edit (Strict author permission check)
  const handleStartEdit = (msg) => {
    if (!currentUser || !msg.authorId || currentUser.uid !== msg.authorId) {
      setToast({ show: true, message: 'คุณสามารถแก้ไขได้เฉพาะข้อความของตนเองเท่านั้น', type: 'error' })
      return
    }
    setEditingMsgId(msg.id)
    setEditInputText(msg.text)
  }

  // Save Edit (Strict author permission check)
  const handleSaveEdit = async (msgId) => {
    if (!editInputText.trim()) return
    const targetMsg = messages.find((m) => m.id === msgId)
    if (!currentUser || !targetMsg?.authorId || currentUser.uid !== targetMsg.authorId) {
      setToast({ show: true, message: 'คุณสามารถแก้ไขได้เฉพาะข้อความของตนเองเท่านั้น', type: 'error' })
      setEditingMsgId(null)
      return
    }
    try {
      await updateDoc(doc(firestore, 'community_messages', msgId), {
        text: editInputText.trim(),
        isEdited: true,
        editedAt: serverTimestamp(),
      })
      setEditingMsgId(null)
      setEditInputText('')
      setToast({ show: true, message: 'แก้ไขข้อความเรียบร้อยแล้ว ✓', type: 'success' })
    } catch (err) {
      setToast({ show: true, message: 'แก้ไขข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Autocomplete mention selection
  const handleSelectMention = (name) => {
    if (mentionIndex === -1) {
      setInputText((prev) => `${prev}@${name} `)
    } else {
      const before = inputText.slice(0, mentionIndex)
      const after = inputText.slice(mentionIndex + (mentionQuery?.length || 0) + 1)
      setInputText(`${before}@${name} ${after}`)
    }
    setMentionQuery(null)
    setMentionIndex(-1)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  // Toggle Reaction
  const handleToggleReaction = async (msg, emoji) => {
    if (!currentUser) {
      onOpenAuth()
      return
    }
    if (isBanned) return

    const currentReactions = msg.reactions || {}
    const usersForEmoji = currentReactions[emoji] || []
    const hasReacted = usersForEmoji.includes(currentUser.uid)

    let updatedUsers
    if (hasReacted) {
      updatedUsers = usersForEmoji.filter((id) => id !== currentUser.uid)
    } else {
      updatedUsers = [...usersForEmoji, currentUser.uid]
    }

    const newReactions = { ...currentReactions }
    if (updatedUsers.length > 0) {
      newReactions[emoji] = updatedUsers
    } else {
      delete newReactions[emoji]
    }

    setActiveReactionMenuId(null)

    try {
      await updateDoc(doc(firestore, 'community_messages', msg.id), {
        reactions: newReactions,
      })
    } catch (err) {
      console.error('Failed to react:', err)
    }
  }

  // Mention insertion
  const handleInsertMention = (name) => {
    setInputText((prev) => `${prev}@${name} `)
    inputRef.current?.focus()
  }

  // Time format
  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return 'เมื่อสักครู่'
    const date = timestamp.toDate()
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  // Render message text with mentions highlight
  const renderMessageContent = (text) => {
    if (!text) return ''
    const parts = text.split(/(@\S+)/g)

    return parts.map((part, index) => {
      if (part === '@ทุกคน' || part === '@everyone') {
        return (
          <span key={index} className="mention-pill everyone">
            {part}
          </span>
        )
      }
      if (part.startsWith('@')) {
        return (
          <span key={index} className="mention-pill user">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const getTypingText = () => {
    if (typingUsers.length === 0) return null
    if (typingUsers.length === 1) return `${typingUsers[0]} กำลังพิมพ์...`
    if (typingUsers.length === 2) return `${typingUsers[0]} และ ${typingUsers[1]} กำลังพิมพ์...`
    return 'มีหลายคนกำลังพิมพ์...'
  }

  return (
    <div className="chat-container">
      {/* Messages Feed */}
      <div className="chat-messages-area">
        <div className="chat-welcome-banner">
          <div className="chat-welcome-icon">💬</div>
          <h3>ห้องแชททั่วไป</h3>
          <p>พื้นที่พูดคุยและแลกเปลี่ยนเรื่องราวกับทุกคน</p>
        </div>

        {messages.map((msg) => {
          const isOwn = Boolean(currentUser?.uid && msg.authorId && currentUser.uid === msg.authorId)
          const canDelete = isOwn || isAdmin
          const isMsgAdmin = msg.authorRole === 'admin' ||
                             usersMap[msg.authorId]?.role === 'admin' ||
                             msg.authorName === 'Moritz' ||
                             msg.authorName === 'มอริทส์ ชทริคเกอร์' ||
                             msg.authorEmail === 'moritz2541@gmail.com'
          const isEditing = editingMsgId === msg.id

          const rawPhoto = (currentUser?.uid === msg.authorId && userProfile?.photoURL)
            ? userProfile.photoURL
            : (usersMap[msg.authorId]?.photoURL || msg.authorPhoto)

          const isMsgBanned = Boolean(usersMap[msg.authorId]?.isBanned)
          const dynamicPhoto = isMsgBanned
            ? '/BandAccount.png'
            : ((rawPhoto && (rawPhoto !== '/profile.jpg' || isMsgAdmin))
                ? rawPhoto
                : (isMsgAdmin ? '/profile.jpg' : '/NewUserProfile.png'))

          const dynamicName = (currentUser?.uid === msg.authorId && userProfile?.displayName)
            ? userProfile.displayName
            : (usersMap[msg.authorId]?.displayName || msg.authorName || 'สมาชิก')

          return (
            <div key={msg.id} id={`chat-msg-${msg.id}`} className="chat-message-item">
              <img
                src={dynamicPhoto}
                alt={dynamicName}
                className="chat-message-avatar"
                onClick={() => onSelectUser({
                  uid: msg.authorId,
                  displayName: dynamicName,
                  photoURL: dynamicPhoto,
                  role: isMsgAdmin ? 'admin' : (usersMap[msg.authorId]?.role || msg.authorRole || 'member'),
                })}
              />

              <div className="chat-message-body">
                {/* Reply quote banner if message is a reply */}
                {msg.replyTo && (
                  <div
                    className="chat-reply-quote clickable"
                    onClick={() => handleJumpToMessage(msg.replyTo.id)}
                    title="คลิกเพื่อเลื่อนไปยังข้อความที่ตอบกลับ"
                  >
                    <span className="reply-arrow">↳</span>
                    <span className="reply-to-user">@{msg.replyTo.authorName}</span>:
                    <span className="reply-snippet">"{msg.replyTo.textSnippet}"</span>
                  </div>
                )}

                <div className="chat-message-header">
                  <span
                    className="chat-author-name"
                    onClick={() => onSelectUser({
                      uid: msg.authorId,
                      displayName: dynamicName,
                      photoURL: dynamicPhoto,
                      role: isMsgAdmin ? 'admin' : (usersMap[msg.authorId]?.role || msg.authorRole || 'member'),
                    })}
                  >
                    {dynamicName}
                  </span>
                  {isMsgAdmin && <span className="chat-admin-pill">👑 Big Boss</span>}
                  <span className="chat-timestamp">{formatTime(msg.createdAt)}</span>
                  {msg.isEdited && <span className="chat-edited-label">(แก้ไขแล้ว)</span>}

                  {/* Actions Bar on Message */}
                  <div className="chat-item-actions">
                    <button
                      className="chat-action-btn"
                      onClick={() => setReplyingTo(msg)}
                      title="ตอบกลับ"
                    >
                      ↩️
                    </button>
                    <button
                      className="chat-action-btn"
                      onClick={() =>
                        setActiveReactionMenuId(activeReactionMenuId === msg.id ? null : msg.id)
                      }
                      title="เพิ่มอิโมจิ"
                    >
                      😀+
                    </button>
                    {isOwn && (
                      <button
                        className="chat-action-btn"
                        onClick={() => handleStartEdit(msg)}
                        title="แก้ไขข้อความ"
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="chat-action-btn delete"
                        onClick={() => handleDelete(msg.id)}
                        title="ลบข้อความ"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Reaction Picker Popup */}
                {activeReactionMenuId === msg.id && (
                  <div className="quick-emoji-picker">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="quick-emoji-btn"
                        onClick={() => handleToggleReaction(msg, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Content or Edit Form */}
                {isEditing ? (
                  <div className="chat-edit-inline-form">
                    <input
                      type="text"
                      value={editInputText}
                      onChange={(e) => setEditInputText(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="chat-edit-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setEditingMsgId(null)}
                      >
                        ยกเลิก
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSaveEdit(msg.id)}
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="chat-message-text">
                    {renderMessageContent(msg.text)}
                  </div>
                )}

                {/* Reactions list below message */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="chat-reactions-row">
                    {Object.entries(msg.reactions).map(([emoji, uids]) => {
                      if (!uids || uids.length === 0) return null
                      const hasReacted = currentUser && uids.includes(currentUser.uid)
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className={`reaction-pill ${hasReacted ? 'active' : ''}`}
                          onClick={() => handleToggleReaction(msg, emoji)}
                          title={`${uids.length} คนกด`}
                        >
                          <span>{emoji}</span>
                          <span className="reaction-count">{uids.length}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="chat-replying-banner">
            <div className="replying-text">
              <span className="replying-label">กำลังตอบกลับ:</span>
              <strong>@{replyingTo.authorName}</strong>
              <span className="replying-snippet">"{replyingTo.text?.slice(0, 45)}"</span>
            </div>
            <button
              type="button"
              className="replying-cancel-btn"
              onClick={() => setReplyingTo(null)}
            >
              ✕ ยกเลิก
            </button>
          </div>
        )}

        {/* Typing indicator */}
        <div className={`chat-typing-status ${typingUsers.length > 0 ? 'visible' : ''}`}>
          {typingUsers.length > 0 && (
            <div className="typing-pill">
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
              <span>{getTypingText()}</span>
            </div>
          )}
        </div>

        {!currentUser ? (
          <div className="chat-locked-bar">
            <span>เข้าสู่ระบบเพื่อเริ่มพูดคุย</span>
            <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
              เข้าสู่ระบบ
            </button>
          </div>
        ) : isBanned ? (
          <div className="chat-locked-bar banned">
            <span>บัญชีของคุณถูกระงับการส่งข้อความ</span>
          </div>
        ) : (
          <div className="chat-form-wrapper">
            {/* Mention Autocomplete Dropdown */}
            {mentionQuery !== null && (
              <div className="mention-autocomplete-card">
                <div className="mention-autocomplete-header">แท็กสมาชิก</div>
                {(!mentionQuery || 'ทุกคน'.includes((mentionQuery || '').toLowerCase()) || 'everyone'.includes((mentionQuery || '').toLowerCase())) && (
                  <button
                    type="button"
                    className="mention-suggestion-item highlight"
                    onClick={() => handleSelectMention('ทุกคน')}
                  >
                    <span className="mention-item-icon">📢</span>
                    <span className="mention-item-name">@ทุกคน</span>
                    <span className="mention-item-hint">(สมาชิกทุกคน)</span>
                  </button>
                )}
                {allMembers
                  .filter((m) => {
                    if (!mentionQuery) return true
                    const name = (m.displayName || '').toLowerCase()
                    const q = (mentionQuery || '').toLowerCase()
                    return name.includes(q)
                  })
                  .slice(0, 6)
                  .map((m) => (
                    <button
                      key={m.uid}
                      type="button"
                      className="mention-suggestion-item"
                      onClick={() => handleSelectMention(m.displayName || 'สมาชิก')}
                    >
                      <img
                        src={m.isBanned ? '/BandAccount.png' : (m.photoURL || (m.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'))}
                        alt={m.displayName}
                        className="mention-item-avatar"
                      />
                      <span className="mention-item-name">{m.displayName || 'สมาชิก'}</span>
                      {m.role === 'admin' && <span className="mention-item-badge">👑 Big Boss</span>}
                    </button>
                  ))}
              </div>
            )}

            {isAdmin && (
              <div className="chat-admin-tag-toolbar">
                <button
                  type="button"
                  className="admin-tag-btn"
                  onClick={() => handleInsertMention('ทุกคน')}
                  title="แท็กทุกคนในคอมมูนิตี้"
                >
                  📢 แท็ก @ทุกคน
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="chat-input-form">
              <input
                ref={inputRef}
                type="text"
                placeholder={replyingTo ? `ตอบกลับ @${replyingTo.authorName}...` : 'พิมพ์ข้อความที่นี่... (พิมพ์ @ เพื่อแท็ก)'}
                value={inputText}
                onChange={handleInputChange}
                maxLength={500}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!inputText.trim() || sending}
                aria-label="ส่งข้อความ"
              >
                ➤
              </button>
            </form>
          </div>
        )}
      </div>

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
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  )
}
