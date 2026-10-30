import { siteConfig } from '../data/siteConfig'
import { YouTubeIcon, PlayIcon, VideoIcon } from '../components/Icons'
import '../styles/FeaturedContent.css'

function getYouTubeThumbnail(videoId) {
  if (!videoId || videoId.startsWith('YOUR_')) return null
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

function VideoCard({ video, index }) {
  const isConfigured =
    video.youtubeUrl && !video.youtubeUrl.startsWith('YOUR_')
  const thumbnailSrc =
    video.thumbnail ||
    (video.youtubeId ? getYouTubeThumbnail(video.youtubeId) : null)

  if (!isConfigured) {
    return (
      <div
        className="video-card"
        style={{ cursor: 'default', opacity: 0.5 }}
        aria-label={`คลิป ${index + 1} — ยังไม่ได้ตั้งค่า`}
      >
        <div className="video-thumbnail">
          <div className="video-thumbnail-placeholder">
            <VideoIcon className="video-thumbnail-placeholder-icon" size={40} />
          </div>
        </div>
        <div className="video-card-body">
          <p className="video-card-title">คลิปแนะนำ #{index + 1}</p>
          <p className="video-card-desc">
            แก้ไข youtubeUrl และ youtubeId ใน src/data/siteConfig.js
          </p>
        </div>
      </div>
    )
  }

  return (
    <a
      href={video.youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`video-card reveal reveal-delay-${Math.min(index + 1, 4)}`}
      aria-label={`รับชม: ${video.title} บน YouTube`}
    >
      <div className="video-thumbnail">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={`Thumbnail ของ ${video.title}`}
            loading="lazy"
            width="480"
            height="270"
            onError={(e) => {
              // Fallback to medium quality if maxresdefault fails
              if (video.youtubeId && e.target.src.includes('maxresdefault')) {
                e.target.src = `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`
              }
            }}
          />
        ) : (
          <div className="video-thumbnail-placeholder">
            <VideoIcon className="video-thumbnail-placeholder-icon" size={40} />
          </div>
        )}

        {/* Play button overlay */}
        <div className="video-play-overlay" aria-hidden="true">
          <div className="video-play-btn">
            <PlayIcon className="video-play-icon" size={20} />
          </div>
        </div>

        {/* YouTube badge */}
        <div className="video-yt-badge" aria-hidden="true">
          <YouTubeIcon className="video-yt-icon" size={12} />
          YouTube
        </div>
      </div>

      <div className="video-card-body">
        <h3 className="video-card-title">{video.title}</h3>
        {video.description && (
          <p className="video-card-desc">{video.description}</p>
        )}
        <span className="video-card-cta">
          <PlayIcon size={12} />
          รับชม
        </span>
      </div>
    </a>
  )
}

export default function FeaturedContent() {
  const { featuredVideos } = siteConfig

  const configured = featuredVideos.filter(
    (v) => v.youtubeUrl && !v.youtubeUrl.startsWith('YOUR_')
  )

  return (
    <section id="content" className="featured section" aria-label="ผลงานแนะนำ">
      <div className="container">
        <header className="featured-header reveal">
          <span className="section-label">
            <span aria-hidden="true">🎬</span>
            ผลงาน
          </span>
          <div className="divider" aria-hidden="true" />
          <h2 className="section-title">คลิปแนะนำ</h2>
          <p className="section-subtitle">
            คลิปที่เลือกมาแนะนำเป็นพิเศษสำหรับคุณ
          </p>
        </header>

        <div className="featured-grid">
          {featuredVideos.length > 0 ? (
            featuredVideos.map((video, i) => (
              <VideoCard key={video.id || i} video={video} index={i} />
            ))
          ) : (
            <div className="featured-empty">
              <VideoIcon className="featured-empty-icon" size={48} />
              <p>ยังไม่มีคลิป — เพิ่มคลิปใน src/data/siteConfig.js</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
