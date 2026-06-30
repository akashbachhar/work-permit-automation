import { useState, useEffect, useCallback } from 'react'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useGoogleMaps } from '../../context/GoogleMapsContext'

const PRIORITIES = ['Safety Critical', 'High', 'Medium', 'Low']

const DEFAULT_DONE = [
  'AREA CORDONED OFF AND PRECAUTIONARY TAGS/BOARDS PROVIDED',
  'CHECKED FOR OIL & GAS TRAPPED BEHIND THE LINING IN EQUIPMENT',
  'CONSIDERED HAZARD FROM OTHER OPERATIONS AND CONCERNED PERSONS INFORMED',
  'EQUIPMENT BLINDED/ DISCONNECTED/ CLOSED/ ISOLATED/ WEDGED OPEN',
  'EQUIPMENT ELECTRICALLY ISOLATED AND TAGGED',
  'EQUIPMENT/ WORK AREA INSPECTED',
  'GAS TEST',
  'PROPER VENTILLATION AND LIGHTING PROVIDED',
  'RUNNING WATER HOSE/ FIRE EXTINGUISHER PROVIDED. FIRE WATER SYSTEM CHARGED',
  'SEWERS, MANHOLES, CBD, ETC. AND HOT SURFACES NEARBY COVERED',
  'SHIELD PROVIDED AGAINST SPARKS',
  'STANDBY PERSONNEL PROVIDED FROM PROCESS / MAINT / CONTRACTOR',
  'SURROUNDING AREA CHECKED, CLEANED AND COVERED',
]

const DEFAULT_NOT_REQUIRED = [
  'EQUIPMENT PROPERLY DRAINED AND DEPRESSURIZED',
  'EQUIPMENT PROPERLY STEAMED / PURGED',
  'EQUIPMENT WATER FLUSHED',
  'IRON SULPHIDE REMOVED/ KEPT WET',
  'PORTABLE EQUIPMENT/NOZZLES PROPERLY GROUNDED',
  'PROPER MEANS OF EXIT / ESCAPE PROVIDED',
]

const defaultCenter = { lat: 12.975717, lng: 74.834972 }
const permitMapStyle = { width: '100%', height: '220px', borderRadius: '8px' }
const permitMapOptions = { mapTypeId: 'satellite', disableDefaultUI: true, zoomControl: true }

function AdminCreatePermitModal({ onClose, onSaved }) {
  const isLoaded = useGoogleMaps()
  const [options, setOptions] = useState({ work_orders: [], partners: [], permit_subtypes: [], shifts: [] })
  const [form, setForm] = useState({
    work_order_no: '', permit_subtype: '', shift: '',
    location_lat: null, location_lng: null,
    exact_location: '', num_workmen: '', partner_no: '',
    gas_o2: '21', gas_lel: '0', gas_co: '0', gas_h2s: '0',
  })
  const [checkDone, setCheckDone] = useState([...DEFAULT_DONE])
  const [checkNotReq, setCheckNotReq] = useState([...DEFAULT_NOT_REQUIRED])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    fetch('/api/admin/permit-options', { credentials: 'include' })
      .then((r) => r.json())
      .then(setOptions)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/create-permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          location_lat: form.location_lat,
          location_lng: form.location_lng,
          num_workmen: form.num_workmen ? Number(form.num_workmen) : null,
          gas_o2: form.gas_o2 !== '' ? Number(form.gas_o2) : null,
          gas_lel: form.gas_lel !== '' ? Number(form.gas_lel) : null,
          gas_co: form.gas_co !== '' ? Number(form.gas_co) : null,
          gas_h2s: form.gas_h2s !== '' ? Number(form.gas_h2s) : null,
          checklist_done: checkDone,
          checklist_not_required: checkNotReq,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(data.permit_no)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{success ? 'Permit Created' : 'Create Work Permit'}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        {success ? (
          <div className="admin-modal-body" style={{ alignItems: 'center', gap: '1rem', padding: '2rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-6" />
            </svg>
            <span className="mono-cell" style={{ fontSize: '1.3rem' }}>{success}</span>
            <button onClick={() => { onSaved() }}>Close</button>
          </div>
        ) : (
          <form className="admin-modal-body admin-modal-scroll" onSubmit={handleSubmit}>
            {error && <div className="admin-error">{error}</div>}
            <label>
              Work Order
              <select value={form.work_order_no} onChange={(e) => setForm({ ...form, work_order_no: e.target.value })} required>
                <option value="">Select work order</option>
                {options.work_orders.map((o) => (
                  <option key={o.order_no} value={o.order_no}>{o.order_no} — {o.description}</option>
                ))}
              </select>
            </label>
            <label>
              Permit Subtype
              <select value={form.permit_subtype} onChange={(e) => setForm({ ...form, permit_subtype: e.target.value })} required>
                <option value="">Select subtype</option>
                {options.permit_subtypes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Shift
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} required>
                <option value="">Select shift</option>
                {options.shifts.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Work Location Coordinate
              {form.location_lat && (
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#4ade80' }}>
                  {form.location_lat.toFixed(6)}, {form.location_lng.toFixed(6)}
                </span>
              )}
            </label>
            <div className="admin-permit-map-box">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={permitMapStyle}
                  center={form.location_lat ? { lat: form.location_lat, lng: form.location_lng } : defaultCenter}
                  zoom={17}
                  options={permitMapOptions}
                  onClick={(e) => setForm({ ...form, location_lat: e.latLng.lat(), location_lng: e.latLng.lng() })}
                >
                  {form.location_lat && (
                    <Marker position={{ lat: form.location_lat, lng: form.location_lng }} />
                  )}
                </GoogleMap>
              ) : (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1b2d', borderRadius: '8px', color: '#64748b' }}>Loading map...</div>
              )}
            </div>
            <label>
              Exact Work Location
              <input type="text" value={form.exact_location} onChange={(e) => setForm({ ...form, exact_location: e.target.value })} required />
            </label>
            <label>
              No. of Workmen
              <input type="number" min="1" value={form.num_workmen} onChange={(e) => setForm({ ...form, num_workmen: e.target.value })} required />
            </label>
            <label>
              Partner
              <select value={form.partner_no} onChange={(e) => setForm({ ...form, partner_no: e.target.value })} required>
                <option value="">Select partner</option>
                {options.partners.map((p) => <option key={p.partner_no} value={p.partner_no}>{p.partner_no} — {p.partner_name}</option>)}
              </select>
            </label>
            <fieldset className="admin-gas-group">
              <legend>Gas Test</legend>
              <div className="admin-gas-fields">
                <label>O2 %<input type="number" step="0.1" value={form.gas_o2} onChange={(e) => setForm({ ...form, gas_o2: e.target.value })} /></label>
                <label>LEL %<input type="number" step="0.1" value={form.gas_lel} onChange={(e) => setForm({ ...form, gas_lel: e.target.value })} /></label>
                <label>CO %<input type="number" step="0.1" value={form.gas_co} onChange={(e) => setForm({ ...form, gas_co: e.target.value })} /></label>
                <label>H2S (PPM)<input type="number" step="0.1" value={form.gas_h2s} onChange={(e) => setForm({ ...form, gas_h2s: e.target.value })} /></label>
              </div>
            </fieldset>
            <div className="admin-checklist-section">
              <h4>Check List</h4>
              <div className="admin-checklist-columns">
                <div className="admin-checklist-box admin-cl-done">
                  <div className="admin-cl-header done-header">Done</div>
                  {checkDone.map((item) => (
                    <div key={item} className="admin-cl-chip admin-chip-done" onClick={() => { setCheckDone((p) => p.filter((i) => i !== item)); setCheckNotReq((p) => [...p, item]) }}>{item}</div>
                  ))}
                </div>
                <div className="admin-checklist-box admin-cl-notreq">
                  <div className="admin-cl-header notreq-header">Not Required</div>
                  {checkNotReq.map((item) => (
                    <div key={item} className="admin-cl-chip admin-chip-notreq" onClick={() => { setCheckNotReq((p) => p.filter((i) => i !== item)); setCheckDone((p) => [...p, item]) }}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Work Permit'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function WorkOrderModal({ order, orderTypes, onClose, onSaved }) {
  const isEdit = !!order
  const [form, setForm] = useState({
    order_type: order?.order_type || '',
    priority: order?.priority || '',
    description: order?.description || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const url = isEdit ? `/api/admin/work-orders/${order.id}` : '/api/admin/work-orders'
    const method = isEdit ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{isEdit ? 'Edit Work Order' : 'Create Work Order'}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}
          <label>
            Order Type
            <select value={form.order_type} onChange={(e) => setForm({ ...form, order_type: e.target.value })} required>
              <option value="">Select order type</option>
              {orderTypes.map((t) => (
                <option key={t.code} value={t.code}>{t.code} — {t.description}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} required>
              <option value="">Select priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              placeholder="Brief description"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  )
}

const DESIGNATIONS = [
  'Officer', 'Senior Officer', 'Assistant Manager', 'Manager',
  'Senior Manager', 'Chief Manager', 'Deputy General Manager', 'General Manager',
]

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name,
    designation: user.designation,
    email: user.email,
    password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Edit User</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}
          <label>
            Name
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Designation
            <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required>
              {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Update'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PartnerModal({ partner, onClose, onSaved }) {
  const isEdit = !!partner
  const [form, setForm] = useState({
    partner_no: partner?.partner_no || '',
    partner_name: partner?.partner_name || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const url = isEdit ? `/api/admin/partners/${partner.id}` : '/api/admin/partners'
    const method = isEdit ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{isEdit ? 'Edit Partner' : 'Add Partner'}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}
          <label>
            Partner Number
            <input
              type="text"
              value={form.partner_no}
              onChange={(e) => setForm({ ...form, partner_no: e.target.value })}
              required
              placeholder="e.g. 50007134"
            />
          </label>
          <label>
            Partner Name
            <input
              type="text"
              value={form.partner_name}
              onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
              required
              placeholder="Workmen party name"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}

const PERMIT_SUBTYPES = ['Hot', 'Cold', 'Electrical', 'Height', 'Composite', 'Confined Space']
const SHIFTS = ['07:00 - 15:00', '15:00 - 23:00', '23:00 - 07:00', '08:30 - 17:00', '17:00 - 23:00']

function PermitViewModal({ permit, partners, onClose, onSaved }) {
  const [form, setForm] = useState({
    permit_subtype: permit.permit_subtype,
    shift: permit.shift,
    location_lat: permit.location_lat,
    location_lng: permit.location_lng,
    exact_location: permit.exact_location,
    num_workmen: permit.num_workmen,
    partner_no: permit.partner_no,
    partner_name: permit.partner_name,
    gas_o2: permit.gas_o2 ?? '',
    gas_lel: permit.gas_lel ?? '',
    gas_co: permit.gas_co ?? '',
    gas_h2s: permit.gas_h2s ?? '',
  })
  const [checkDone, setCheckDone] = useState(permit.checklist_done || [])
  const [checkNotReq, setCheckNotReq] = useState(permit.checklist_not_required || [])
  const [renewalDates, setRenewalDates] = useState(permit.renewal_dates || [])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [validUntil, setValidUntil] = useState(permit.valid_until)

  const handleRenew = async () => {
    setRenewing(true)
    try {
      const res = await fetch(`/api/admin/work-permits/${permit.id}/renew`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      setRenewalDates((prev) => [...prev, now])
      setSuccessMsg('Approval renewed successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setRenewing(false)
    }
  }

  const moveToDone = (item) => {
    setCheckNotReq((prev) => prev.filter((i) => i !== item))
    setCheckDone((prev) => [...prev, item])
  }
  const moveToNotReq = (item) => {
    setCheckDone((prev) => prev.filter((i) => i !== item))
    setCheckNotReq((prev) => [...prev, item])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setSubmitting(true)
    try {
      const selectedPartner = partners.find((p) => p.partner_no === form.partner_no)
      const res = await fetch(`/api/admin/work-permits/${permit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          partner_name: selectedPartner?.partner_name || form.partner_name,
          gas_o2: form.gas_o2 !== '' ? Number(form.gas_o2) : null,
          gas_lel: form.gas_lel !== '' ? Number(form.gas_lel) : null,
          gas_co: form.gas_co !== '' ? Number(form.gas_co) : null,
          gas_h2s: form.gas_h2s !== '' ? Number(form.gas_h2s) : null,
          checklist_done: checkDone,
          checklist_not_required: checkNotReq,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccessMsg('Saved successfully')
      setTimeout(() => { onSaved() }, 800)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Permit {permit.permit_no}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="admin-modal-body admin-modal-scroll" onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}
          {successMsg && <div className="admin-success">{successMsg}</div>}

          <div className="permit-info-row">
            <span className="permit-info-label">Work Order</span>
            <span className="permit-info-value mono-cell">{permit.work_order_no}</span>
          </div>
          <div className="permit-info-row">
            <span className="permit-info-label">Created By</span>
            <span className="permit-info-value">{permit.created_by}</span>
          </div>
          <div className="permit-info-row">
            <span className="permit-info-label">Created At</span>
            <span className="permit-info-value">{new Date(permit.created_at).toLocaleString()}</span>
          </div>
          <div className="permit-info-row">
            <span className="permit-info-label">Valid Until</span>
            <span className="permit-info-value">{validUntil ? new Date(validUntil).toLocaleString() : '-'}</span>
          </div>
          <div className="permit-renewal-section">
            <div className="permit-renewal-header">
              <span className="permit-info-label">Approval History ({renewalDates.length})</span>
              <button type="button" className="admin-btn-renew" onClick={handleRenew} disabled={renewing}>
                {renewing ? 'Renewing...' : 'Renew Approval'}
              </button>
            </div>
            <div className="permit-renewal-list">
              {renewalDates.map((d, i) => (
                <span key={i} className="renewal-chip">
                  {i === 0 ? 'Created' : `Approval ${i}`}: {new Date(d).toLocaleString()}
                </span>
              ))}
            </div>
          </div>
          <div className="permit-info-row">
            <span className="permit-info-label">Coordinates</span>
            <span className="permit-info-value mono-cell">{form.location_lat}, {form.location_lng}</span>
          </div>

          <label>
            Permit Subtype
            <select value={form.permit_subtype} onChange={(e) => setForm({ ...form, permit_subtype: e.target.value })}>
              {PERMIT_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Shift
            <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Exact Work Location
            <input type="text" value={form.exact_location} onChange={(e) => setForm({ ...form, exact_location: e.target.value })} required />
          </label>
          <label>
            No. of Workmen
            <input type="number" min="1" value={form.num_workmen} onChange={(e) => setForm({ ...form, num_workmen: e.target.value })} required />
          </label>
          <label>
            Partner
            <select value={form.partner_no} onChange={(e) => setForm({ ...form, partner_no: e.target.value })}>
              {partners.map((p) => <option key={p.partner_no} value={p.partner_no}>{p.partner_no} — {p.partner_name}</option>)}
            </select>
          </label>

          <fieldset className="admin-gas-group">
            <legend>Gas Test</legend>
            <div className="admin-gas-fields">
              <label>O2 %<input type="number" step="0.1" value={form.gas_o2} onChange={(e) => setForm({ ...form, gas_o2: e.target.value })} /></label>
              <label>LEL %<input type="number" step="0.1" value={form.gas_lel} onChange={(e) => setForm({ ...form, gas_lel: e.target.value })} /></label>
              <label>CO %<input type="number" step="0.1" value={form.gas_co} onChange={(e) => setForm({ ...form, gas_co: e.target.value })} /></label>
              <label>H2S (PPM)<input type="number" step="0.1" value={form.gas_h2s} onChange={(e) => setForm({ ...form, gas_h2s: e.target.value })} /></label>
            </div>
          </fieldset>

          <div className="admin-checklist-section">
            <h4>Check List</h4>
            <div className="admin-checklist-columns">
              <div className="admin-checklist-box admin-cl-done">
                <div className="admin-cl-header done-header">Done</div>
                {checkDone.map((item) => (
                  <div key={item} className="admin-cl-chip admin-chip-done" onClick={() => moveToNotReq(item)}>{item}</div>
                ))}
                {checkDone.length === 0 && <p className="admin-cl-empty">Click items to move here</p>}
              </div>
              <div className="admin-checklist-box admin-cl-notreq">
                <div className="admin-cl-header notreq-header">Not Required</div>
                {checkNotReq.map((item) => (
                  <div key={item} className="admin-cl-chip admin-chip-notreq" onClick={() => moveToDone(item)}>{item}</div>
                ))}
                {checkNotReq.length === 0 && <p className="admin-cl-empty">Click items to move here</p>}
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminDashboard({ admin, onLogout }) {
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [permits, setPermits] = useState([])
  const [partners, setPartners] = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingPermits, setLoadingPermits] = useState(true)
  const [loadingPartners, setLoadingPartners] = useState(true)
  const [showCreds, setShowCreds] = useState(false)
  const [creds, setCreds] = useState({ current_password: '', username: '', password: '' })
  const [credsMsg, setCredsMsg] = useState('')
  const [credsError, setCredsError] = useState('')
  const [modalOrder, setModalOrder] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalPartner, setModalPartner] = useState(null)
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [viewPermit, setViewPermit] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [showCreatePermit, setShowCreatePermit] = useState(false)

  const fetchUsers = () => {
    setLoadingUsers(true)
    fetch('/api/admin/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoadingUsers(false))
  }

  const fetchOrders = () => {
    setLoadingOrders(true)
    fetch('/api/admin/work-orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setOrders(data.work_orders || []))
      .finally(() => setLoadingOrders(false))
  }

  const fetchPermits = () => {
    setLoadingPermits(true)
    fetch('/api/admin/work-permits', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPermits(data.work_permits || []))
      .finally(() => setLoadingPermits(false))
  }

  const fetchPartners = () => {
    setLoadingPartners(true)
    fetch('/api/admin/partners', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPartners(data.partners || []))
      .finally(() => setLoadingPartners(false))
  }

  useEffect(() => {
    fetchUsers()
    fetchOrders()
    fetchPermits()
    fetchPartners()
    fetch('/api/admin/order-types', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setOrderTypes(data.order_types || []))
  }, [])

  const deleteOrder = async (id) => {
    if (!confirm('Delete this work order?')) return
    await fetch(`/api/admin/work-orders/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchOrders()
  }

  const deletePermit = async (id) => {
    if (!confirm('Delete this work permit?')) return
    await fetch(`/api/admin/work-permits/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchPermits()
  }

  const deletePartner = async (id) => {
    if (!confirm('Delete this partner?')) return
    await fetch(`/api/admin/partners/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchPartners()
  }

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchUsers()
  }

  const handleCredsSubmit = async (e) => {
    e.preventDefault()
    setCredsMsg('')
    setCredsError('')
    const res = await fetch('/api/admin/change-credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(creds),
    })
    const data = await res.json()
    if (!res.ok) {
      setCredsError(data.error)
    } else {
      setCredsMsg('Credentials updated successfully')
      setCreds({ current_password: '', username: '', password: '' })
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    onLogout()
  }

  const openCreate = () => {
    setModalOrder(null)
    setShowModal(true)
  }

  const openEdit = (order) => {
    setModalOrder(order)
    setShowModal(true)
  }

  const handleSaved = () => {
    setShowModal(false)
    fetchOrders()
  }

  const priorityClass = (p) => {
    if (p === 'Safety Critical') return 'priority-critical'
    if (p === 'High') return 'priority-high'
    if (p === 'Medium') return 'priority-medium'
    return 'priority-low'
  }

  return (
    <div className="admin-dashboard">
      <nav className="admin-navbar">
        <h1>Admin Panel</h1>
        <div className="admin-navbar-right">
          <span className="admin-username">{admin.username}</span>
          <button className="admin-btn-outline" onClick={() => setShowCreds(!showCreds)}>
            Change Credentials
          </button>
          <button className="admin-btn-outline" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="admin-content">
        {showCreds && (
          <div className="admin-card admin-card-full admin-creds-card">
            <h3>Change Credentials</h3>
            <form onSubmit={handleCredsSubmit}>
              {credsError && <div className="admin-error">{credsError}</div>}
              {credsMsg && <div className="admin-success">{credsMsg}</div>}
              <label>
                Current Password
                <input
                  type="password"
                  value={creds.current_password}
                  onChange={(e) => setCreds({ ...creds, current_password: e.target.value })}
                  required
                />
              </label>
              <label>
                New Username
                <input
                  type="text"
                  value={creds.username}
                  onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  placeholder="Leave blank to keep current"
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                />
              </label>
              <button type="submit">Update</button>
            </form>
          </div>
        )}

        <div className="admin-card admin-card-full">
          <div className="admin-card-header">
            <h3>Work Orders</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={openCreate}>+ Create</button>
              <button className="admin-btn-icon" onClick={fetchOrders} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            </div>
          </div>
          {loadingOrders ? (
            <p className="admin-loading">Loading work orders...</p>
          ) : orders.length === 0 ? (
            <p className="admin-empty">No work orders yet</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono-cell">{o.order_no}</td>
                      <td>{o.order_type} — {o.order_type_desc}</td>
                      <td>{o.description}</td>
                      <td><span className={`priority-badge ${priorityClass(o.priority)}`}>{o.priority}</span></td>
                      <td>{o.created_by}</td>
                      <td>{new Date(o.created_at).toLocaleString()}</td>
                      <td className="action-cell">
                        <button className="admin-btn-edit" onClick={() => openEdit(o)}>Edit</button>
                        <button className="admin-btn-danger" onClick={() => deleteOrder(o.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card admin-card-full">
          <div className="admin-card-header">
            <h3>Work Permits</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={() => setShowCreatePermit(true)}>+ Create</button>
              <button className="admin-btn-icon" onClick={fetchPermits} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
            </div>
          </div>
          {loadingPermits ? (
            <p className="admin-loading">Loading work permits...</p>
          ) : permits.length === 0 ? (
            <p className="admin-empty">No work permits yet</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Permit No</th>
                    <th>Subtype</th>
                    <th>Location</th>
                    <th>Partner</th>
                    <th>Workmen</th>
                    <th>Shift</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th>Validity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p) => {
                    const isExpired = p.valid_until && new Date(p.valid_until) < new Date()
                    return (
                      <tr key={p.id}>
                        <td className="mono-cell">{p.permit_no}</td>
                        <td>{p.permit_subtype}</td>
                        <td className="location-cell">{p.exact_location}</td>
                        <td>{p.partner_name}</td>
                        <td>{p.num_workmen}</td>
                        <td>{p.shift}</td>
                        <td>{p.created_by}</td>
                        <td>{new Date(p.created_at).toLocaleString()}</td>
                        <td>
                          <span className={isExpired ? 'validity-expired' : 'validity-active'}>
                            {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td className="action-cell">
                          <button className="admin-btn-edit" onClick={() => setViewPermit(p)}>View/Edit</button>
                          <button className="admin-btn-sop" onClick={() => {}}>Generate SOP</button>
                          <button className="admin-btn-danger" onClick={() => deletePermit(p.id)}>Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Partners</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={() => { setModalPartner(null); setShowPartnerModal(true) }}>+ Add</button>
              <button className="admin-btn-icon" onClick={fetchPartners} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            </div>
          </div>
          {loadingPartners ? (
            <p className="admin-loading">Loading partners...</p>
          ) : partners.length === 0 ? (
            <p className="admin-empty">No partners added yet</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Partner No</th>
                    <th>Partner Name</th>
                    <th>Added On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id}>
                      <td className="mono-cell">{p.partner_no}</td>
                      <td>{p.partner_name}</td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="action-cell">
                        <button className="admin-btn-edit" onClick={() => { setModalPartner(p); setShowPartnerModal(true) }}>Edit</button>
                        <button className="admin-btn-danger" onClick={() => deletePartner(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Registered Users</h3>
            <button className="admin-btn-icon" onClick={fetchUsers} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
          {loadingUsers ? (
            <p className="admin-loading">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="admin-empty">No registered users</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Password Hash</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.name}</td>
                      <td>{u.designation}</td>
                      <td>{u.email}</td>
                      <td className="hash-cell">{u.password_hash}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="action-cell">
                        <button className="admin-btn-edit" onClick={() => setEditUser(u)}>Edit</button>
                        <button className="admin-btn-danger" onClick={() => deleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <WorkOrderModal
          order={modalOrder}
          orderTypes={orderTypes}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {showPartnerModal && (
        <PartnerModal
          partner={modalPartner}
          onClose={() => setShowPartnerModal(false)}
          onSaved={() => { setShowPartnerModal(false); fetchPartners() }}
        />
      )}

      {viewPermit && (
        <PermitViewModal
          permit={viewPermit}
          partners={partners}
          onClose={() => setViewPermit(null)}
          onSaved={() => { setViewPermit(null); fetchPermits() }}
        />
      )}

      {showCreatePermit && (
        <AdminCreatePermitModal
          onClose={() => setShowCreatePermit(false)}
          onSaved={() => { setShowCreatePermit(false); fetchPermits() }}
        />
      )}

      {editUser && (
        <UserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers() }}
        />
      )}
    </div>
  )
}
