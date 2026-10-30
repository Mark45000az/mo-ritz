# 🎬 Creator Website

เว็บไซต์ประจำตัวสำหรับ Content Creator บน YouTube และ TikTok  
สร้างด้วย **React + Vite** · Modern Dark Premium Design

---

## 🚀 เริ่มต้นใช้งาน

### ข้อกำหนดเบื้องต้น

- Node.js เวอร์ชัน 18 ขึ้นไป
- npm เวอร์ชัน 9 ขึ้นไป

### ติดตั้งและรันเว็บไซต์

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. เปิดเว็บไซต์ในโหมด Development
npm run dev

# 3. Build สำหรับ Production
npm run build

# 4. ดูตัวอย่าง Production Build
npm run preview
```

---

## ✏️ วิธีแก้ไขข้อมูลเว็บไซต์

**ไฟล์หลักที่ต้องแก้ไขมีเพียงไฟล์เดียว:**

```
src/data/siteConfig.js
```

เปิดไฟล์นี้และแก้ไขข้อมูลทั้งหมดของคุณ ไม่ต้องแก้ไขไฟล์อื่น ๆ

---

## 📝 รายการข้อมูลที่ต้องกรอก

### 1. ข้อมูลพื้นฐาน

```js
creatorName: "ชื่อของคุณ",          // เช่น "สมชาย"
creatorHandle: "@ชื่อHandle",        // เช่น "@somchai_creator"
tagline: "คำอธิบายสั้น ๆ",          // เช่น "ครีเอเตอร์ที่ชอบแชร์ความรู้"
contentType: "ประเภทคอนเทนต์",      // เช่น "YouTube & TikTok Creator"
```

### 2. รูปโปรไฟล์

วิธีที่ 1: วางไฟล์รูปในโฟลเดอร์ `public/` แล้วใส่ชื่อไฟล์:
```js
profileImage: "profile.jpg",   // หรือ "photo.png"
```

วิธีที่ 2: ใส่ URL ภายนอก:
```js
profileImage: "https://example.com/my-photo.jpg",
```

วิธีที่ 3: ปล่อยว่างเพื่อแสดง Placeholder:
```js
profileImage: null,
```

### 3. Social Media URLs

```js
socials: {
  youtube: {
    url: "https://youtube.com/@YourChannelName",  // URL จริงของช่อง
    channelName: "ชื่อช่อง YouTube",
    description: "คำอธิบายช่องสั้น ๆ",
  },
  tiktok: {
    url: "https://tiktok.com/@YourHandle",
    handle: "@yourhandle",
    description: "คำอธิบายสั้น ๆ",
  },
  // ช่องทางอื่น ๆ — ตั้งค่า url เป็น null เพื่อซ่อน
  instagram: { url: null },  // ซ่อน
  instagram: { url: "https://instagram.com/yourhandle" },  // แสดง
}
```

### 4. ปุ่มโดเนท

```js
donation: {
  url: "https://tipme.in.th/yourname",  // หรือ ko-fi, patreon ฯลฯ
  platformName: "TipMe",
}
```

### 5. คลิปแนะนำ

```js
featuredVideos: [
  {
    id: "video-1",
    title: "ชื่อคลิป",
    description: "คำอธิบายคลิป",
    youtubeUrl: "https://youtu.be/VIDEO_ID",    // ลิงก์คลิป
    youtubeId: "VIDEO_ID",                      // ID ของวิดีโอ เช่น "dQw4w9WgXcQ"
    thumbnail: null,  // null = ดึง Thumbnail จาก YouTube อัตโนมัติ
  },
]
```

> **วิธีหา YouTube Video ID:** เปิดคลิปบน YouTube แล้วดู URL:  
> `https://www.youtube.com/watch?v=`**VIDEO_ID_HERE**

---

## 🎨 วิธีเปลี่ยนสีและดีไซน์

แก้ไข CSS Variables ในไฟล์ `src/styles/global.css` ส่วน `:root {}`

```css
:root {
  --color-accent: #8b5cf6;        /* สีหลัก (ม่วง) */
  --color-accent-light: #a78bfa;  /* สีหลักสว่าง */
  --color-bg-primary: #0d0d0f;    /* พื้นหลังหลัก */
  --color-bg-secondary: #13131a;  /* พื้นหลังรอง */
}
```

---

## 🌐 วิธี Deploy ขึ้น Vercel (แนะนำ)

### วิธีที่ 1: Deploy ผ่านเว็บไซต์ Vercel

1. Push โค้ดไปยัง GitHub Repository
2. ไปที่ [vercel.com](https://vercel.com) และ Login
3. กด **"New Project"** แล้วเลือก Repository ของคุณ
4. Vercel จะตรวจจับว่าเป็น Vite โปรเจกต์อัตโนมัติ
5. กด **"Deploy"** — เสร็จสิ้น!

### วิธีที่ 2: Deploy ผ่าน Vercel CLI

```bash
# ติดตั้ง Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy Production
vercel --prod
```

### วิธีที่ 3: Cloudflare Pages

1. Push โค้ดไปยัง GitHub
2. ไปที่ [pages.cloudflare.com](https://pages.cloudflare.com)
3. Connect GitHub Repository
4. ตั้งค่า Build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. กด Deploy

---

## 📂 โครงสร้างโปรเจกต์

```
AbotMe/
├── public/
│   ├── favicon.svg          # Favicon
│   └── og-image.jpg         # รูปสำหรับ Social Media Share (เพิ่มเอง)
├── src/
│   ├── components/
│   │   ├── Icons.jsx        # SVG Icons ทั้งหมด
│   │   └── Navbar.jsx       # Navigation Bar
│   ├── data/
│   │   └── siteConfig.js    # ⭐ ไฟล์ตั้งค่ากลาง (แก้ไขที่นี่)
│   ├── hooks/
│   │   └── useScrollEffects.js  # Custom Hooks
│   ├── sections/
│   │   ├── Hero.jsx         # ส่วนแรก
│   │   ├── About.jsx        # เกี่ยวกับฉัน
│   │   ├── Socials.jsx      # ช่องทางติดตาม
│   │   ├── FeaturedContent.jsx  # คลิปแนะนำ
│   │   ├── Donation.jsx     # สนับสนุน
│   │   └── Footer.jsx       # Footer
│   ├── styles/
│   │   ├── global.css       # Design System
│   │   ├── Navbar.css
│   │   ├── Hero.css
│   │   ├── About.css
│   │   ├── Socials.css
│   │   ├── FeaturedContent.css
│   │   ├── Donation.css
│   │   └── Footer.css
│   ├── App.jsx              # Root Component
│   └── main.jsx             # Entry Point
├── index.html               # HTML + Meta Tags
├── vite.config.js
└── package.json
```

---

## ✅ Checklist ก่อน Deploy

- [ ] แก้ไขข้อมูลทั้งหมดใน `src/data/siteConfig.js`
- [ ] ใส่รูปโปรไฟล์ใน `public/` และอัปเดต `profileImage`
- [ ] สร้างรูป `public/og-image.jpg` ขนาด 1200×630px สำหรับ Social Share
- [ ] อัปเดต `index.html` — เปลี่ยน YOUR_NAME และ YOUR_SITE_URL
- [ ] ตรวจสอบว่า URL ทุกอันถูกต้อง
- [ ] รัน `npm run build` เพื่อตรวจสอบว่า Build ผ่าน
- [ ] รัน `npm run preview` เพื่อทดสอบ Production Build

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI Framework |
| Vite | 6 | Build Tool |
| CSS3 | — | Styling (Vanilla CSS) |
| Google Fonts | — | Sarabun (TH) + Inter (EN) |

ไม่ใช้ CSS Framework หรือ UI Library ภายนอก — ทุกอย่างเขียนด้วย Vanilla CSS เพื่อให้โหลดเร็วที่สุด

---

## 📧 ติดต่อ

หากต้องการความช่วยเหลือ สามารถดูเอกสารเพิ่มเติมได้ที่:
- [Vite Documentation](https://vite.dev)
- [React Documentation](https://react.dev)
- [Vercel Documentation](https://vercel.com/docs)
