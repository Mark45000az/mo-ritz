import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
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
  const [sending, setSending] = useState(false)
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

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!currentUser || !selectedPartner || isBanned || isBlocked || !inputText.trim() || sending) return

    const text = inputText.trim()
    setInputText('')
    setSending(true)

    const chatId = getChatId(currentUser.uid, selectedPartner.uid)

    try {
      const chatDocRef = doc(firestore, 'community_chats', chatId)
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
        lastMessage: text,
        lastUpdatedAt: serverTimestamp(),
      }, { merge: true })

      await addDoc(collection(firestore, 'community_chats', chatId, 'messages'), {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'สมาชิก',
        senderPhoto: userProfile?.photoURL || (userProfile?.role === 'admin' ? '/profile.jpg' : '/NewUserProfile.png'),
        text,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error sending DM:', err)
      setToast({ show: true, message: 'ส่งข้อความไม่สำเร็จ: ' + err.message, type: 'error' })
    } finally {
      setSending(false)
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
        message: newBlocked ? `บล็อก ${selectedPartner.displayName} เรียบร้อยแล้ว` : `ปลดบล็อก ${selectedPartner.displayName} แล้ว`,
        type: newBlocked ? 'info' : 'success'
      })
    } catch (err) {
      setToast({ show: true, message: 'ดำเนินการไม่สำเร็จ: ' + err.message, type: 'error' })
    }
  }

  // Delete conversation
  const handleDeleteChat = () => {
    if (!currentUser || !selectedPartner) return
    setConfirmModal({
      isOpen: true,
      title: 'ลบบทสนทนา',
      message: `คุณต้องการลบบทสนทนากับ ${selectedPartner.displayName} ใช่หรือไม่?`,
      onConfirm: async () => {
        const chatId = getChatId(currentUser.uid, selectedPartner.uid)
        try {
          await deleteDoc(doc(firestore, 'community_chats', chatId))
          setSelectedPartner(null)
          setToast({ show: true, message: 'ลบบทสนทนาเรียบร้อยแล้ว', type: 'info' })
        } catch (err) {
          setToast({ show: true, message: 'ลบบทสนทนาไม่สำเร็จ: ' + err.message, type: 'error' })
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return ''
    const d = timestamp.toDate()
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  if (!currentUser) {
    return (
      <div className="dm-empty-auth">
        <div className="dm-empty-icon">✉️</div>
        <h3>เข้าสู่ระบบเพื่อใช้งานแชทส่วนตัว</h3>
        <p>ส่งข้อความพูดคุยแบบส่วนตัว 1-on-1</p>
        <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
          เข้าสู่ระบบ
        </button>
      </div>
    )
  }

  return (
    <div className="dm-layout">
      {/* Conversations List */}
      <div className={`dm-sidebar ${selectedPartner ? 'has-partner' : ''}`}>
        <div className="dm-sidebar-header">
          <h3>ข้อความส่วนตัว</h3>
        </div>
        <div className="dm-conversations-list">
          {conversations.length === 0 && !selectedPartner ? (
            <div className="dm-no-chats">
              <p>ยังไม่มีบทสนทนา</p>
              <small>คลิกที่โปรไฟล์ของสมาชิกในห้องเพื่อเริ่มการสนทนา</small>
            </div>
          ) : (
            conversations.map((chat) => {
              const otherUid = chat.participants.find((id) => id !== currentUser.uid)
              const otherUserLive = usersMap[otherUid]
              const otherUser = otherUserLive || chat.participantDetails?.[otherUid] || { displayName: 'สมาชิก' }
              const isOtherAdmin = otherUser.role === 'admin' || otherUser.email === 'moritz2541@gmail.com'
              const rawOtherPhoto = otherUser.photoURL
              const otherAvatar = (rawOtherPhoto && (rawOtherPhoto !== '/profile.jpg' || isOtherAdmin))
                ? rawOtherPhoto
                : (isOtherAdmin ? '/profile.jpg' : '/NewUserProfile.png')
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
              const rawPartnerPhoto = livePartner.photoURL
              const partnerAvatar = (rawPartnerPhoto && (rawPartnerPhoto !== '/profile.jpg' || isPartnerAdmin))
                ? rawPartnerPhoto
                : (isPartnerAdmin ? '/profile.jpg' : '/NewUserProfile.png')

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
                      {isBlocked ? '🚫 คุณบล็อกผู้ใช้นี้อยู่' : 'คุยแบบส่วนตัว 1-on-1'}
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

            <div className="dm-messages-feed">
              {messages.length === 0 && (
                <div className="dm-start-hint">
                  <p>เริ่มพิมพ์ข้อความเพื่อพูดคุยกับ {selectedPartner.displayName} ได้เลย</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMine = msg.senderId === currentUser.uid
                return (
                  <div key={msg.id} className={`dm-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    <div className="dm-msg-bubble">
                      <p className="dm-msg-text">{msg.text}</p>
                      <span className="dm-msg-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {isBlocked ? (
              <div className="dm-blocked-bar">
                <span>คุณได้บล็อกผู้ใช้งานนี้ ไม่สามารถส่งข้อความได้</span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="dm-input-form">
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
                  disabled={!inputText.trim() || sending || isBanned}
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
