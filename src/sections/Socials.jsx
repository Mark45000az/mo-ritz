import { siteConfig } from '../data/siteConfig'
import {
  YouTubeIcon,
  TikTokIcon,
  InstagramIcon,
  TwitterIcon,
  FacebookIcon,
  ArrowUpRightIcon,
} from '../components/Icons'
import '../styles/Socials.css'

const PLATFORM_META = {
  youtube: {
    label: 'YouTube',
    Icon: YouTubeIcon,
    ctaLabel: 'Subscribe ตอนนี้',
  },
  tiktok: {
    label: 'TikTok',
    Icon: TikTokIcon,
    ctaLabel: 'Follow ตอนนี้',
  },
  instagram: {
    label: 'Instagram',
    Icon: InstagramIcon,
    ctaLabel: 'Follow บน Instagram',
  },
  twitter: {
    label: 'X (Twitter)',
    Icon: TwitterIcon,
    ctaLabel: 'Follow บน X',
  },
  facebook: {
    label: 'Facebook',
    Icon: FacebookIcon,
    ctaLabel: 'ติดตามบน Facebook',
  },
}

function SocialCard({ platform, data }) {
  const meta = PLATFORM_META[platform]
  if (!meta) return null
  if (!data?.url || data.url.startsWith('YOUR_')) return null

  const { Icon, label, ctaLabel } = meta
  const handle = data.handle || data.channelName || data.pageName || ''
  const stat = data.subscribers || data.followers || null

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="social-card"
      data-platform={platform}
      aria-label={`ไปยัง ${label}${handle ? ` — ${handle}` : ''}`}
    >
      <div className="social-card-header">
        <div className="social-card-icon-wrapper" aria-hidden="true">
          <Icon className="social-card-icon" size={26} />
        </div>
        <ArrowUpRightIcon className="social-card-arrow" size={18} />
      </div>

      <div className="social-card-body">
        <p className="social-card-platform">{label}</p>
        {handle && <p className="social-card-handle">{handle}</p>}
        {data.description && (
          <p className="social-card-description">{data.description}</p>
        )}
      </div>

      {stat && (
        <div className="social-card-stat">
          <span>{stat} ผู้ติดตาม</span>
        </div>
      )}

      <span className="social-card-cta">{ctaLabel}</span>
    </a>
  )
}

export default function Socials() {
  const { socials } = siteConfig

  const platforms = ['youtube', 'tiktok', 'instagram', 'twitter', 'facebook']
  const activePlatforms = platforms.filter(
    (p) => socials[p]?.url && !socials[p].url.startsWith('YOUR_')
  )

  return (
    <section id="socials" className="socials section" aria-label="ช่องทางติดตาม">
      <div className="container">
        <header className="socials-header reveal">
          <span className="section-label">
            <span aria-hidden="true">📡</span>
            ช่องทางติดตาม
          </span>
          <div className="divider" aria-hidden="true" />
          <h2 className="section-title">ติดตามฉันได้ที่</h2>
          <p className="section-subtitle">
            ติดตามช่องทางต่าง ๆ เพื่อไม่พลาดคอนเทนต์ใหม่ ๆ
          </p>
        </header>

        <div className="socials-grid" role="list" aria-label="ช่องทางโซเชียลมีเดีย">
          {activePlatforms.length > 0 ? (
            activePlatforms.map((platform, i) => (
              <div
                key={platform}
                className={`reveal reveal-delay-${Math.min(i + 1, 4)}`}
                role="listitem"
              >
                <SocialCard platform={platform} data={socials[platform]} />
              </div>
            ))
          ) : (
            /* Show placeholder cards when no URLs are configured */
            ['youtube', 'tiktok'].map((platform) => {
              const meta = PLATFORM_META[platform]
              const { Icon, label } = meta
              return (
                <div
                  key={platform}
                  className="social-card"
                  data-platform={platform}
                  style={{ cursor: 'default', opacity: 0.5 }}
                  aria-label={`${label} — ยังไม่ได้ตั้งค่า URL`}
                >
                  <div className="social-card-header">
                    <div className="social-card-icon-wrapper">
                      <Icon className="social-card-icon" size={26} />
                    </div>
                  </div>
                  <div className="social-card-body">
                    <p className="social-card-platform">{label}</p>
                    <p className="social-card-handle">ยังไม่ได้ตั้งค่า URL</p>
                    <p className="social-card-description">
                      แก้ไข URL ใน src/data/siteConfig.js
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
