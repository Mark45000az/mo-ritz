/**
 * UserNametag.jsx — Reusable component to render custom styled Nametags and Badges.
 */

export default function UserNametag({
  name,
  style = 'default',
  badge = '',
  className = '',
  showBadge = true,
  onClick,
  title,
}) {
  const safeStyle = style || 'default'

  return (
    <span
      className={`user-nametag-container ${className} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={title}
    >
      <span className={`user-nametag-text nametag-style-${safeStyle}`}>
        {name || 'สมาชิก'}
      </span>
      {showBadge && Boolean(badge) && (
        <span className={`user-nametag-badge nametag-style-${safeStyle}`}>
          {badge}
        </span>
      )}
    </span>
  )
}

