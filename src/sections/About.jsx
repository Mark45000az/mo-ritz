import { siteConfig } from '../data/siteConfig'
import '../styles/About.css'

export default function About() {
  const { creatorName, about } = siteConfig

  return (
    <section id="about" className="about section" aria-label="เกี่ยวกับฉัน">
      <div className="container">
        <div className="about-inner">
          <div className="about-header reveal">
            <span className="section-label">
              <span aria-hidden="true">👋</span>
              เกี่ยวกับฉัน
            </span>
            <div className="divider" aria-hidden="true" />

            <h2 className="about-title">
              {creatorName === 'YOUR_NAME' ? 'Creator' : creatorName}
              <span className="about-title-sub">Content Creator</span>
            </h2>

            <p className="about-intro">{about.intro}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
