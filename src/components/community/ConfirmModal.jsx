import '../../styles/ConfirmModal.css'

export default function ConfirmModal({
  isOpen,
  title = 'ยืนยันการดำเนินการ',
  message = 'คุณต้องการดำเนินการนี้ใช่หรือไม่?',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  confirmVariant = 'danger',
  icon = '⚠️',
  onConfirm,
  onClose
}) {
  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-icon-badge">{icon}</div>
        <h3 className="confirm-modal-title">{title}</h3>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm confirm-modal-btn"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'} btn-sm confirm-modal-btn`}
            onClick={() => {
              onConfirm?.()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

