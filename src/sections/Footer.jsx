import { useCallback } from 'react'
import { siteConfig } from '../data/siteConfig'
import {
  YouTubeIcon,
  TikTokIcon,
  InstagramIcon,
  TwitterIcon,
  FacebookIcon,
  ArrowUpIcon,
} from '../components/Icons'
import '../styles/Footer.css'

const SOCIAL_ICONS = {
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  twitter: TwitterIcon,
  facebook: FacebookIcon,
}

const SOCIAL_LABELS = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
}

export default function Footer() {
  const { creatorName, creatorHandle, tagline, socials, footer } = siteConfig

  const currentYear = new Date().getFullYear()
  const displayName = creatorName === 'YOUR_NAME' ? 'Creator' : creatorName
  const copyrightName = footer.copyrightName === 'YOUR_NAME' ? 'Creator' : footer.copyrightName

  const activeSocials = Object.entries(socials).filter(
    ([, data]) => data?.url && !data.url.startsWith('YOUR_')
  )

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-inner">
          {/* Brand */}
          <div className="footer-brand">
            <a
              href="#home"
              className="footer-logo"
              onClick={(e) => {
                e.preventDefault()
                scrollToTop()
              }}
              aria-label="กลับหน้าแรก"
            >
              <span className="footer-logo-dot" aria-hidden="true" />
              {displayName}
            </a>
            <p className="footer-tagline">
              {tagline}
              {footer.thankYou && (
                <>
                  <br />
                  <span>{footer.thankYou}</span>
                </>
              )}
            </p>
          </div>

          {/* Social Links */}
          {activeSocials.length > 0 && (
            <div className="footer-socials">
              <p className="footer-socials-label">ติดตาม</p>
              <nav
                className="footer-social-links"
                aria-label="ลิงก์โซเชียลมีเดีย"
              >
                {activeSocials.map(([platform, data]) => {
                  const Icon = SOCIAL_ICONS[platform]
                  const label = SOCIAL_LABELS[platform]
                  if (!Icon) return null
                  return (
                    <a
                      key={platform}
                      href={data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-social-link"
                      aria-label={`ไปยัง ${label}`}
                    >
                      <Icon className="footer-social-icon" size={18} />
                    </a>
                  )
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} {copyrightName}. สงวนสิทธิ์ทุกประการ.
          </p>

          <button
            className="footer-back-top"
            onClick={scrollToTop}
            aria-label="กลับขึ้นด้านบนสุด"
          >
            <ArrowUpIcon size={14} />
            กลับด้านบน
          </button>
        </div>
      </div>
    </footer>
  )
}
