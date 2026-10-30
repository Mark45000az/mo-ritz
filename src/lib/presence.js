/**
 * Check if a user is currently online based on heartbeat timestamp and privacy settings
 */
export function isUserOnline(user) {
  if (!user) return false
  if (user.statusMode === 'offline') return false
  if (!user.lastActive) return false

  const lastActiveMs = user.lastActive?.toMillis?.() ||
    (user.lastActive?.seconds ? user.lastActive.seconds * 1000 : 0)

  if (!lastActiveMs) return false
  // Online if active within the last 4 minutes
  return Date.now() - lastActiveMs < 4 * 60 * 1000
}

/**
 * Get human-readable status text in Thai
 */
export function getUserStatusText(user) {
  if (!user) return '⚪ ออฟไลน์'
  if (user.statusMode === 'offline') return '⚪ ซ่อนสถานะ'
  if (!user.lastActive) return '⚪ ออฟไลน์'

  const lastActiveMs = user.lastActive?.toMillis?.() ||
    (user.lastActive?.seconds ? user.lastActive.seconds * 1000 : 0)

  if (!lastActiveMs) return '⚪ ออฟไลน์'

  const diffMs = Date.now() - lastActiveMs
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 4) {
    return '🟢 ออนไลน์'
  }
  if (diffMin < 60) {
    return `⚪ ใช้งานเมื่อ ${diffMin} นาทีก่อน`
  }
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) {
    return `⚪ ใช้งานเมื่อ ${diffHours} ชม. ก่อน`
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `⚪ ใช้งานเมื่อ ${diffDays} วันก่อน`
  }
  return '⚪ ออฟไลน์'
}

