import { useState, useCallback } from 'react'
import { siteConfig } from '../data/siteConfig'
import { useNavbarScroll } from '../hooks/useScrollEffects'
import { HeartIcon } from './Icons'
import '../styles/Navbar.css'

const NAV_ITEMS = [
  { id: 'home', label: 'หน้าแรก', href: '#home' },
  { id: 'about', label: 'เกี่ยวกับฉัน', href: '#about' },
  { id: 'socials', label: 'ช่องทางติดตาม', href: '#socials' },
  { id: 'support', label: 'สนับสนุน', href: '#support' },
]

export default function Navbar({ onOpenCommunity }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useNavbarScroll(20)

  const scrollTo = useCallback((href) => {
    setMenuOpen(false)
    const target = document.querySelector(href)
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 64
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }, [])

  const { creatorName, donation } = siteConfig

  const displayName = creatorName === 'YOUR_NAME' ? 'Creator' : creatorName

  return (
    <>
      <nav id="navbar" className="navbar" role="navigation" aria-label="เมนูหลัก">
        <div className="container">
          <div className="navbar-inner">
            {/* Logo */}
            <a
              href="#home"
              className="navbar-logo"
              onClick={(e) => { e.preventDefault(); scrollTo('#home') }}
              aria-label="กลับหน้าแรก"
            >
              <span className="navbar-logo-dot" aria-hidden="true" />
              {displayName}
            </a>

            {/* Desktop Links */}
            <nav className="navbar-links" aria-label="ลิงก์นำทาง">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="nav-link"
                  onClick={(e) => { e.preventDefault(); scrollTo(item.href) }}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Community Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenCommunity}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  borderColor: 'rgba(139, 92, 246, 0.35)',
                  color: '#c4b5fd'
                }}
              >
                💬 คอมมูนิตี้
              </button>

              {/* Donate Button */}
              {donation.url && donation.url !== 'YOUR_DONATION_URL' && (
                <a
                  href={donation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm navbar-donate-btn"
                  aria-label="สนับสนุน Creator"
                >
                  <HeartIcon size={14} />
                  สนับสนุน
                </a>
              )}

              {/* Hamburger */}
              <button
                className={`navbar-hamburger${menuOpen ? ' open' : ''}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        className={`mobile-menu${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="mobile-nav-link"
            onClick={(e) => { e.preventDefault(); scrollTo(item.href) }}
            tabIndex={menuOpen ? 0 : -1}
          >
            {item.label}
          </a>
        ))}
        <button
          type="button"
          className="mobile-nav-link"
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            color: '#c4b5fd',
            textAlign: 'left',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          onClick={() => {
            setMenuOpen(false)
            onOpenCommunity()
          }}
          tabIndex={menuOpen ? 0 : -1}
        >
          💬 คอมมูนิตี้ (แชท / แฟนอาร์ต / มีม)
        </button>
        {donation.url && donation.url !== 'YOUR_DONATION_URL' && (
          <a
            href={donation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mobile-donate-btn"
            tabIndex={menuOpen ? 0 : -1}
          >
            <HeartIcon size={14} />
            สนับสนุน Creator
          </a>
        )}
      </div>
    </>
  )
}
