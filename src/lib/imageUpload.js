/**
 * imageUpload.js — Utility to compress and prepare images for upload.
 * Compresses images client-side into lightweight WebP/JPEG data URLs
 * or uploads to free hosting, keeping Firestore documents small (< 300KB).
 */

export async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'))
    reader.onload = (event) => {
      const img = new Image()
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'))
      img.onload = () => {
        let { width, height } = img

        // Calculate aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('ไม่สามารถสร้าง canvas สำหรับบีบอัดรูปภาพได้'))
          return
        }

        // Smooth rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Try WebP first, fallback to JPEG
        let dataUrl = ''
        try {
          dataUrl = canvas.toDataURL('image/webp', quality)
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        resolve(dataUrl)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  })
}

