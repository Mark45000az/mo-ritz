/**
 * ========================================================
 *  siteConfig.js — ไฟล์ตั้งค่ากลางของเว็บไซต์
 * ========================================================
 *  แก้ไขข้อมูลในไฟล์นี้เพื่ออัปเดตเว็บไซต์ทั้งหมด
 *  ไม่ต้องแก้ไขไฟล์อื่น ๆ สำหรับข้อมูลพื้นฐาน
 * ========================================================
 */

export const siteConfig = {
  // ─── ข้อมูลพื้นฐาน ────────────────────────────────────
  creatorName: "Moritz",
  creatorHandle: "@MoRitz-z9g",
  tagline: "คนอีสานอายุ 20 รักอิสระ ทำคอนเทนต์เพราะอยากทำ ☆",
  contentType: "YouTube & TikTok Creator",

  // ─── รูปโปรไฟล์ ───────────────────────────────────────
  // ใส่ชื่อไฟล์รูปที่อยู่ในโฟลเดอร์ /public เช่น "profile.jpg"
  // หรือใส่เป็น URL ภายนอก เช่น "https://example.com/photo.jpg"
  profileImage: "/profile.jpg",

  // ─── เกี่ยวกับฉัน ──────────────────────────────────────
  about: {
    intro: `สวัสดี! ผม Moritz คนอีสานอายุ 20 ที่รักอิสระ
ทำคอนเทนต์ในแบบที่ตัวเองอยากทำ ไม่มีกรอบ ไม่มีสูตรสำเร็จ`,

    contentDescription: `ในช่องนี้คุณจะได้พบกับ
• คอนเทนต์ที่ออกมาจากใจจริง ๆ
• วิดีโอเกม ชีวิต และเรื่องราวของคนธรรมดา
• อัปเดตตามใจฉัน ไม่บังคับตัวเอง`,

    thankYou: "ขอบคุณทุกคนที่ติดตามและให้กำลังใจกันมาโดยตลอดนะ 💜",
  },

  // ─── Social Media Links ────────────────────────────────
  socials: {
    youtube: {
      url: "https://www.youtube.com/@MoRitz-z9g",
      channelName: "คิดถึงคนเก่า",
      description: "ดูวิดีโอและคอนเทนต์ทั้งหมดได้ที่นี่",
      subscribers: "577",
    },
    tiktok: {
      url: "https://www.tiktok.com/@kit_tueng_kon_kao",
      handle: "@kit_tueng_kon_kao",
      description: "คลิปสั้น ๆ สนุก ๆ อัปเดตบ่อย ๆ",
      followers: "3.6K",
    },
    // ช่องทางอื่น ๆ — ตั้งค่า url เป็น null เพื่อซ่อน
    instagram: {
      url: null,
      handle: "@moritz",
      description: "ภาพถ่ายและเรื่องราวเบื้องหลัง",
    },
    twitter: {
      url: null,
      handle: "@moritz",
      description: "อัปเดตและความคิดเห็นสด ๆ",
    },
    facebook: {
      url: null,
      pageName: "Moritz",
      description: "ติดตามข่าวสารและไลฟ์สด",
    },
  },

  // ─── Donation / Support ───────────────────────────────
  donation: {
    url: "https://ezdn.app/mo_ritz",
    platformName: "EzDonate",
    thankYouMessage: "ขอบคุณมากเลย ทุก ๆ การสนับสนุนมีความหมายเสมอ 😘",
    description: "ถ้ามักอ้ายก็โดเนทให้อ้ายแหน่เด้อ",
  },

  // ─── SEO & Meta ───────────────────────────────────────
  seo: {
    title: "Moritz — คิดถึงคนเก่า",
    description:
      "เว็บไซต์ประจำตัวของ Moritz คอนเทนต์ครีเอเตอร์บน YouTube และ TikTok คนอีสานรักอิสระ",
    ogImage: "/og-image.jpg",
    siteUrl: "YOUR_SITE_URL",
    lang: "th",
  },

  // ─── Footer ───────────────────────────────────────────
  footer: {
    copyrightName: "Moritz",
    thankYou: "ขอบคุณที่แวะมาเยี่ยมชม",
  },
};
