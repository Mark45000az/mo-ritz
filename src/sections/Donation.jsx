import { siteConfig } from '../data/siteConfig'
import { HeartIcon, ExternalLinkIcon } from '../components/Icons'
import '../styles/Donation.css'

export default function Donation() {
  const { donation } = siteConfig

  const hasDonate = donation.url && donation.url !== 'YOUR_DONATION_URL'

  return (
    <section id="support" className="donation section" aria-label="สนับสนุน Creator">
      <div className="donation-bg" aria-hidden="true" />

      <div className="container">
        <div className="donation-inner reveal">
          {/* Icon */}
          <div className="donation-icon-wrapper" aria-hidden="true">
            <HeartIcon className="donation-icon" size={36} />
          </div>

          <span className="section-label" style={{ justifyContent: 'center' }}>
            <span aria-hidden="true">💜</span>
            สนับสนุน Creator
          </span>

          <h2 className="donation-title">Support My Work</h2>

          <p className="donation-desc">{donation.description}</p>

          <p className="donation-thank-you">{donation.thankYouMessage}</p>

          <div className="donation-btn-wrapper">
            {hasDonate ? (
              <a
                href={donation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-donate btn-lg"
                aria-label={`โดเนทผ่าน ${donation.platformName}`}
              >
                <HeartIcon size={20} />
                โดเนทผ่าน {donation.platformName}
              </a>
            ) : (
              <span
                className="btn btn-donate btn-lg"
                style={{ opacity: 0.4, cursor: 'default' }}
                aria-label="ยังไม่ได้ตั้งค่า URL โดเนท"
              >
                <HeartIcon size={20} />
                โดเนท / Support Me
              </span>
            )}

            {hasDonate && (
              <p className="donation-platform-note">
                <ExternalLinkIcon size={12} />
                จะเปิดไปยัง {donation.platformName} ในแท็บใหม่
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
