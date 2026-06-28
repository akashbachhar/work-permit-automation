import { useState, useEffect } from 'react'

export default function CreateWorkOrderModal({ onClose }) {
  const [types, setTypes] = useState([])
  const [orderType, setOrderType] = useState('')
  const [priority, setPriority] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    fetch('/api/work-orders/types', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setTypes(data.order_types || []))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_type: orderType, priority, description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(data.order_no)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Work Order</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {success ? (
          <div className="modal-body">
            <div className="modal-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <h3>Work Order Created</h3>
              <p className="order-no">{success}</p>
            </div>
            <button className="modal-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleSubmit}>
            {error && <div className="modal-error">{error}</div>}
            <label>
              Order Type
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)} required>
                <option value="">Select order type</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.description}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)} required>
                <option value="">Select priority</option>
                <option value="Safety Critical">Safety Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <label>
              Description
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Brief description"
              />
            </label>
            <button className="modal-btn" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
