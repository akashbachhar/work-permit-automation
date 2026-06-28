import { useState, useEffect } from 'react'

export default function RenewWorkPermitModal({ onClose }) {
  const [permits, setPermits] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [renewing, setRenewing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    fetch('/api/work-permits/valid', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPermits(data.permits || []))
      .finally(() => setLoading(false))
  }, [])

  const handleRenew = async () => {
    if (!selected) return
    setError('')
    setRenewing(true)
    try {
      const res = await fetch(`/api/work-permits/${selected}/renew`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const permit = permits.find((p) => String(p.id) === selected)
      setSuccess({
        permit_no: permit.permit_no,
        renewed_at: data.renewed_at,
      })
      window.dispatchEvent(new Event('permits-updated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setRenewing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Renew Approval</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {success ? (
          <div className="modal-body">
            <div className="modal-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <h3>Approval Renewed</h3>
              <p className="order-no">{success.permit_no}</p>
              <p className="renew-validity">Approved at: {new Date(success.renewed_at).toLocaleString()}</p>
            </div>
            <button className="modal-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}
            {loading ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Loading permits...</p>
            ) : permits.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>No valid permits available</p>
            ) : (
              <>
                <label>
                  Select Permit
                  <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">Choose a permit...</option>
                    {permits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.permit_no} — {p.permit_subtype} — {p.exact_location} (valid till {new Date(p.valid_until).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </label>
                <button className="modal-btn" onClick={handleRenew} disabled={!selected || renewing}>
                  {renewing ? 'Renewing...' : 'Renew Approval'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
