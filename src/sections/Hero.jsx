import { siteConfig } from '../data/siteConfig'
import { HeartIcon, UserIcon } from '../components/Icons'
import '../styles/Hero.css'

export default function Hero() {
  const { creatorName, creatorHandle, tagline, contentType, profileImage, donation } = siteConfig

  const donateUrl = donation?.url
  const hasDonate = donateUrl && donateUrl !== 'YOUR_DONATION_URL'

  return (
    <section id="home" className="hero" aria-label="ส่วนแนะนำ">
      {/* Subtle background decorations */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-bg-gradient" />
        <div className="hero-bg-gradient-2" />
      </div>

      <div className="container">
        <div className="hero-content">
          {/* Left: Text */}
          <div className="hero-text">
            <div className="hero-badge" role="text">
              <span className="hero-badge-dot" aria-hidden="true" />
              {contentType}
            </div>

            <h1 className="hero-name">
              เว็บของคน{' '}
              <span className="hero-name-accent">คิดถึงคนเก่า</span>
            </h1>

            <p className="hero-handle">{creatorHandle}</p>

            <p className="hero-description">{tagline}</p>

            <div className="hero-actions">
              {hasDonate && (
                <a
                  href={donateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-donate btn-lg"
                  aria-label="สนับสนุน Creator"
                >
                  <HeartIcon size={18} />
                  Support Me
                </a>
              )}
            </div>
          </div>

          {/* Right: Profile Image */}
          <div className="hero-image-wrapper" aria-hidden="true">
            <div className="hero-avatar">
              <div className="hero-avatar-ring" />
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={`รูปโปรไฟล์ของ ${creatorName}`}
                  className="hero-avatar-img"
                  width="280"
                  height="280"
                  loading="eager"
                />
              ) : (
                <div className="hero-avatar-placeholder">
                  <UserIcon className="placeholder-icon" size={56} />
                  <p className="placeholder-text">
                    เพิ่มรูปโปรไฟล์<br />
                    ใน siteConfig.js
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="hero-scroll-hint" aria-hidden="true">
        <div className="scroll-mouse">
          <div className="scroll-wheel" />
        </div>
        <span className="scroll-text">เลื่อนลง</span>
      </div>
    </section>
  )
}
