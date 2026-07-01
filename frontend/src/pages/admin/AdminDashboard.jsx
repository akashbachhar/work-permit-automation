import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useGoogleMaps } from '../../context/GoogleMapsContext'
import JSADetailModal from '../../components/JSADetailModal'


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
const permitMapOptions = { mapTypeId: 'satellite', disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' }

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
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerFocused, setPartnerFocused] = useState(false)
  const [hasEI, setHasEI] = useState(false)
  const [eiItems, setEiItems] = useState([{ technical_object: '', quantity: 1 }])
  const [jsaLoading, setJsaLoading] = useState(false)
  const [jsaData, setJsaData] = useState(null)
  const [jsaError, setJsaError] = useState('')
  const [viewingJsa, setViewingJsa] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  const canGenerateJsa = !!(
    form.work_order_no && form.permit_subtype && form.shift &&
    form.location_lat && form.exact_location && form.num_workmen && form.partner_no
  )

  const handleGenerateJsa = async () => {
    setJsaLoading(true)
    setJsaError('')
    setJsaData(null)
    try {
      const res = await fetch('/api/admin/generate-jsa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          work_order_no: form.work_order_no,
          permit_subtype: form.permit_subtype,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJsaData(data.jsa)
    } catch (err) {
      setJsaError(err.message)
    } finally {
      setJsaLoading(false)
    }
  }

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
          electrical_isolation_items: hasEI ? eiItems.filter((i) => i.technical_object.trim()) : [],
          jsa_data: jsaData || null,
          gas_lel: form.gas_lel !== '' ? Number(form.gas_lel) : null,
          gas_co: form.gas_co !== '' ? Number(form.gas_co) : null,
          gas_h2s: form.gas_h2s !== '' ? Number(form.gas_h2s) : null,
          checklist_done: checkDone,
          checklist_not_required: checkNotReq,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess({ permit_no: data.permit_no, iso_no: data.iso_no, jsa_doc_no: data.jsa_doc_no })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{success ? 'Permit Created' : 'Create Work Permit'}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        {success ? (
          <div className="admin-modal-body" style={{ alignItems: 'center', gap: '0.75rem', padding: '2rem', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-6" />
            </svg>
            <span className="mono-cell" style={{ fontSize: '1.3rem' }}>{success.permit_no}</span>
            {success.iso_no && (
              <p className="success-detail-row">
                <span className="success-detail-label">Isolation No</span>
                <span className="success-detail-value">{success.iso_no}</span>
              </p>
            )}
            {success.jsa_doc_no && (
              <p className="success-detail-row">
                <span className="success-detail-label">JSA Doc No</span>
                <span className="success-detail-value">{success.jsa_doc_no}</span>
              </p>
            )}
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
                <span className="coord-display">
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
                <div className="admin-permit-map-loading">Loading map...</div>
              )}
            </div>
            <label>
              Exact Work Location
              <input type="text" value={form.exact_location} onChange={(e) => setForm({ ...form, exact_location: e.target.value })} required placeholder="e.g. Near Pump House 3, Unit A" />
            </label>
            <label>
              No. of Workmen
              <input type="number" min="1" value={form.num_workmen} onChange={(e) => setForm({ ...form, num_workmen: e.target.value })} required />
            </label>
            <label>
              Partner
              <div className="partner-select">
                <input
                  type="text"
                  className="partner-search"
                  placeholder="Search partner..."
                  value={form.partner_no
                    ? `${options.partners.find((p) => p.partner_no === form.partner_no)?.partner_no} — ${options.partners.find((p) => p.partner_no === form.partner_no)?.partner_name}`
                    : partnerSearch}
                  onChange={(e) => {
                    setPartnerSearch(e.target.value)
                    setForm({ ...form, partner_no: '' })
                    setPartnerFocused(true)
                  }}
                  onFocus={() => {
                    setPartnerFocused(true)
                    if (form.partner_no) {
                      setPartnerSearch('')
                      setForm({ ...form, partner_no: '' })
                    }
                  }}
                  onBlur={() => setTimeout(() => setPartnerFocused(false), 200)}
                />
                {!form.partner_no && partnerFocused && (
                  <div className="partner-dropdown">
                    {options.partners.filter((p) =>
                      p.partner_name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
                      p.partner_no.includes(partnerSearch)
                    ).length === 0 ? (
                      <div className="partner-option partner-empty">No match</div>
                    ) : (
                      options.partners
                        .filter((p) =>
                          p.partner_name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
                          p.partner_no.includes(partnerSearch)
                        )
                        .map((p) => (
                          <div
                            key={p.partner_no}
                            className="partner-option"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForm({ ...form, partner_no: p.partner_no })
                              setPartnerSearch('')
                              setPartnerFocused(false)
                            }}
                          >
                            {p.partner_no} — {p.partner_name}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
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
            <div className="safety-docs-section">
              <h4 className="safety-docs-title">Safety Documents</h4>

              <div className="safety-docs-row">
                {jsaData ? (
                  <button
                    type="button"
                    className="safety-doc-btn safety-doc-btn-success"
                    onClick={() => setViewingJsa(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View JSA ({jsaData.job_steps?.length} steps)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="safety-doc-btn"
                    disabled={jsaLoading || !canGenerateJsa}
                    title={!canGenerateJsa ? 'Fill all required fields above first' : ''}
                    onClick={handleGenerateJsa}
                  >
                    {jsaLoading ? <><span className="jsa-spinner" /> Generating...</> : 'Generate JSA'}
                  </button>
                )}

                <button
                  type="button"
                  className={`safety-doc-btn${hasEI ? ' safety-doc-btn-active' : ''}`}
                  onClick={() => setHasEI(!hasEI)}
                >
                  {hasEI ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Electrical Isolation
                    </>
                  ) : 'Add Electrical Isolation'}
                </button>
              </div>

              {!canGenerateJsa && (
                <p className="jsa-fields-note">Fill all required fields above to enable JSA generation</p>
              )}
              {jsaError && <p className="jsa-error">{jsaError}</p>}

              {hasEI && (
                <div className="ei-items-list">
                  {eiItems.map((item, idx) => (
                    <div key={idx} className="ei-item-row">
                      <input
                        type="text"
                        className="ei-object-input"
                        placeholder="Technical object to isolate"
                        value={item.technical_object}
                        onChange={(e) => {
                          const updated = [...eiItems]
                          updated[idx] = { ...item, technical_object: e.target.value }
                          setEiItems(updated)
                        }}
                      />
                      <input
                        type="number"
                        className="ei-qty-input"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...eiItems]
                          updated[idx] = { ...item, quantity: Number(e.target.value) }
                          setEiItems(updated)
                        }}
                      />
                      {eiItems.length > 1 && (
                        <button
                          type="button"
                          className="ei-remove-btn"
                          onClick={() => setEiItems(eiItems.filter((_, i) => i !== idx))}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ei-add-btn"
                    onClick={() => setEiItems([...eiItems, { technical_object: '', quantity: 1 }])}
                  >
                    + Add Item
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting || jsaLoading}>
              {submitting ? 'Creating...' : 'Create Work Permit'}
            </button>
          </form>
        )}
      </div>
    </div>

    {viewingJsa && jsaData && (
      <JSADetailModal
        docNo="(unsaved)"
        jsaContent={jsaData}
        onClose={() => setViewingJsa(false)}
      />
    )}
  </>
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
  const [permitJsa, setPermitJsa] = useState(null)
  const [permitEI, setPermitEI] = useState(null)
  const [viewingJsa, setViewingJsa] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/work-permits/${permit.id}/jsa`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPermitJsa(data.jsa || null))
    fetch(`/api/admin/work-permits/${permit.id}/electrical-isolations`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPermitEI(data.electrical_isolations || null))
  }, [permit.id])

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
    <>
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
          {permit.work_description && (
            <div className="permit-info-row">
              <span className="permit-info-label">Description</span>
              <span className="permit-info-value">{permit.work_description}</span>
            </div>
          )}
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

          {(permitJsa || permitEI) && (
            <div className="safety-docs-section">
              <h4 className="safety-docs-title">Safety Documents</h4>
              <div className="safety-docs-row">
                {permitJsa && (
                  <button type="button" className="safety-doc-btn safety-doc-btn-success" onClick={() => setViewingJsa(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View JSA ({permitJsa.jsa_content?.job_steps?.length} steps)
                  </button>
                )}
              </div>
              {permitJsa && (
                <div className="permit-doc-info-row">
                  <span className="permit-info-label">JSA Doc No</span>
                  <span className="permit-info-value mono-cell">{permitJsa.doc_no}</span>
                </div>
              )}
              {permitEI && (
                <div className="permit-ei-section">
                  <div className="permit-doc-info-row">
                    <span className="permit-info-label">Isolation No</span>
                    <span className="permit-info-value mono-cell">{permitEI.iso_no}</span>
                    <span className={`ei-tag-badge ${permitEI.tagging_condition === 'energised' ? 'ei-tag-energised' : 'ei-tag-deenergised'}`}>
                      {permitEI.tagging_condition === 'energised' ? 'Energised' : 'De-energised'}
                    </span>
                  </div>
                  <div className="permit-ei-items">
                    {permitEI.items.map((item, i) => (
                      <div key={i} className="permit-ei-item">
                        <span className="permit-ei-object">{item.technical_object}</span>
                        <span className="permit-ei-qty">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>

    {viewingJsa && permitJsa && (
      <JSADetailModal
        docNo={permitJsa.doc_no}
        permitNo={permit.permit_no}
        jsaContent={permitJsa.jsa_content}
        onClose={() => setViewingJsa(false)}
      />
    )}
  </>
  )
}

function renderMarkdown(text) {
  const lines = text.split('\n')
  const result = []
  let listBuffer = []
  let listType = null
  let k = 0

  const parseInline = (s) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
      if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
      return part
    })
  }

  const flushList = () => {
    if (!listBuffer.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    result.push(
      <Tag key={k++} className="sop-list">
        {listBuffer.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
      </Tag>
    )
    listBuffer = []
    listType = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      flushList()
      result.push(<h4 key={k++} className="sop-h4">{parseInline(trimmed.slice(4))}</h4>)
    } else if (trimmed.startsWith('## ')) {
      flushList()
      result.push(<h3 key={k++} className="sop-h3">{parseInline(trimmed.slice(3))}</h3>)
    } else if (trimmed.startsWith('# ')) {
      flushList()
      result.push(<h2 key={k++} className="sop-h2">{parseInline(trimmed.slice(2))}</h2>)
    } else if (/^[*-]\s+/.test(trimmed)) {
      if (listType === 'ol') flushList()
      listType = 'ul'
      listBuffer.push(trimmed.replace(/^[*-]\s+/, ''))
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (listType === 'ul') flushList()
      listType = 'ol'
      listBuffer.push(trimmed.replace(/^\d+\.\s+/, ''))
    } else if (trimmed === '') {
      flushList()
    } else {
      flushList()
      result.push(<p key={k++} className="sop-p">{parseInline(trimmed)}</p>)
    }
  }
  flushList()
  return result
}

const SOP_LANGUAGES = [
  { key: 'hindi', label: 'Hindi' },
  { key: 'bengali', label: 'Bengali' },
  { key: 'kannada', label: 'Kannada' },
]

function SOPModal({ permit, mode, onClose, onGenerated }) {
  const [sop, setSop] = useState(mode === 'view' ? permit.sop_text : null)
  const [loading, setLoading] = useState(mode === 'generate')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [translations, setTranslations] = useState({})
  const [activeLang, setActiveLang] = useState('english')
  const [translating, setTranslating] = useState(null)

  useEffect(() => {
    if (mode !== 'generate') return
    fetch(`/api/admin/work-permits/${permit.id}/generate-sop`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSop(data.sop)
        onGenerated(permit.id, data.sop)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [permit.id, mode])

  useEffect(() => {
    if (!sop) return
    fetch(`/api/admin/work-permits/${permit.id}/sop/translations`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setTranslations(data.translations || {}))
  }, [sop, permit.id])

  const displayText = activeLang === 'english' ? sop : translations[activeLang]

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExportPdf = () => {
    window.open(`/api/admin/work-permits/${permit.id}/sop/pdf?lang=${activeLang}`, '_blank')
  }

  const handleTranslate = (language) => {
    setTranslating(language)
    setError('')
    fetch(`/api/admin/work-permits/${permit.id}/sop/translate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setTranslations((prev) => ({ ...prev, [language]: data.sop }))
        setActiveLang(language)
      })
      .catch((err) => setError(err.message))
      .finally(() => setTranslating(null))
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide sop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>SOP — Permit {permit.permit_no}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="sop-modal-body">
          {loading && (
            <div className="sop-loading">
              <div className="sop-spinner" />
              <p>Generating SOP using your HPCL manuals...</p>
              <p className="sop-loading-sub">This may take up to 60 seconds</p>
            </div>
          )}
          {error && <div className="admin-error">{error}</div>}
          {sop && (
            <>
              <div className="sop-lang-tabs">
                <button
                  className={`sop-lang-tab ${activeLang === 'english' ? 'active' : ''}`}
                  onClick={() => setActiveLang('english')}
                >
                  English
                </button>
                {SOP_LANGUAGES.map((l) =>
                  translations[l.key] ? (
                    <button
                      key={l.key}
                      className={`sop-lang-tab ${activeLang === l.key ? 'active' : ''}`}
                      onClick={() => setActiveLang(l.key)}
                    >
                      {l.label}
                    </button>
                  ) : (
                    <button
                      key={l.key}
                      className="sop-lang-tab sop-lang-translate"
                      disabled={translating === l.key}
                      onClick={() => handleTranslate(l.key)}
                    >
                      {translating === l.key ? 'Translating...' : `Translate to ${l.label}`}
                    </button>
                  )
                )}
              </div>
              <div className="sop-actions">
                <button className="admin-btn-edit" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="admin-btn-pdf" onClick={handleExportPdf}>
                  Export PDF
                </button>
              </div>
              <div className="sop-content">{renderMarkdown(displayText || '')}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EditJSAModal({ jsaRecord, onClose, onSaved }) {
  const [step, setStep] = useState('')
  const [hazards, setHazards] = useState('')
  const [measures, setMeasures] = useState('')
  const [pending, setPending] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const existingCount = jsaRecord.jsaContent?.job_steps?.length ?? 0

  function handleAdd() {
    if (!step.trim()) return
    const newStep = {
      step: step.trim(),
      potential_hazards: hazards.split('\n').map(s => s.trim()).filter(Boolean),
      control_measures: measures.split('\n').map(s => s.trim()).filter(Boolean),
    }
    setPending(prev => [...prev, newStep])
    setStep('')
    setHazards('')
    setMeasures('')
  }

  async function handleSave() {
    if (pending.length === 0) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/jsa-records/${jsaRecord.id}/steps`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: pending }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved(data.jsa_content)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <h3>Edit JSA — {jsaRecord.docNo}</h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Permit {jsaRecord.permitNo} &nbsp;·&nbsp; {existingCount} existing step{existingCount !== 1 ? 's' : ''}</span>
          </div>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="admin-modal-body">
          <div className="jsa-edit-section-label">Add a new step</div>

          <label className="admin-label">Step Name</label>
          <input
            className="admin-input"
            placeholder="e.g. Ensure Area is Clear of Personnel"
            value={step}
            onChange={e => setStep(e.target.value)}
          />

          <label className="admin-label">Potential Hazards <span style={{ color: '#64748b', fontWeight: 400 }}>(one per line)</span></label>
          <textarea
            className="admin-input jsa-edit-textarea"
            placeholder={"Falls from height\nExposure to chemicals"}
            value={hazards}
            onChange={e => setHazards(e.target.value)}
          />

          <label className="admin-label">Hazard Control Measures <span style={{ color: '#64748b', fontWeight: 400 }}>(one per line)</span></label>
          <textarea
            className="admin-input jsa-edit-textarea"
            placeholder={"Use safety harness\nWear PPE"}
            value={measures}
            onChange={e => setMeasures(e.target.value)}
          />

          <div className="jsa-edit-add-row">
            <button
              type="button"
              className="jsa-edit-add-btn"
              onClick={handleAdd}
              disabled={!step.trim()}
            >
              + Add Step
            </button>
            {pending.length > 0 && (
              <span className="jsa-edit-status">{pending.length} step{pending.length !== 1 ? 's' : ''} added</span>
            )}
          </div>

          {pending.length > 0 && (
            <div className="jsa-edit-pending-list">
              {pending.map((s, i) => (
                <div key={i} className="jsa-edit-pending-item">
                  <span className="jsa-edit-pending-num">{existingCount + i + 1}</span>
                  <span className="jsa-edit-pending-name">{s.step}</span>
                  <button
                    type="button"
                    className="jsa-edit-pending-remove"
                    onClick={() => setPending(prev => prev.filter((_, idx) => idx !== i))}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="jsa-error">{error}</p>}

          <div className="admin-modal-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="admin-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={handleSave}
              disabled={saving || pending.length === 0}
            >
              {saving ? 'Saving…' : `Save ${pending.length > 0 ? `(${pending.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard({ admin, onLogout }) {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [permits, setPermits] = useState([])
  const [partners, setPartners] = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [electricalIsolations, setElectricalIsolations] = useState([])
  const [jsaRecords, setJsaRecords] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingPermits, setLoadingPermits] = useState(true)
  const [loadingPartners, setLoadingPartners] = useState(true)
  const [loadingEI, setLoadingEI] = useState(true)
  const [loadingJSA, setLoadingJSA] = useState(true)
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
  const [sopPermit, setSopPermit] = useState(null)
  const [sopMode, setSopMode] = useState('generate')
  const [viewJsa, setViewJsa] = useState(null)
  const [editJsa, setEditJsa] = useState(null)

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

  const fetchElectricalIsolations = () => {
    setLoadingEI(true)
    fetch('/api/admin/electrical-isolations', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setElectricalIsolations(data.electrical_isolations || []))
      .finally(() => setLoadingEI(false))
  }

  const fetchJsaRecords = () => {
    setLoadingJSA(true)
    fetch('/api/admin/jsa-records', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setJsaRecords(data.jsa_records || []))
      .finally(() => setLoadingJSA(false))
  }

  useEffect(() => {
    fetchUsers()
    fetchOrders()
    fetchPermits()
    fetchPartners()
    fetchElectricalIsolations()
    fetchJsaRecords()
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
          <button className="admin-btn-outline admin-btn-analytics" onClick={() => navigate('/admin/analytics')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
              <path d="M3 3v18h18" /><path d="M18 9l-5 5-2-2-5 5" />
            </svg>
            Analytics
          </button>
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

        {/* 1 — Work Permits (full width) */}
        <div className="admin-card admin-card-full">
          <div className="admin-card-header">
            <h3>Work Permits</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={() => setShowCreatePermit(true)}>+ Create</button>
              <button className="admin-btn-icon" onClick={fetchPermits} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
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
                          {p.sop_text ? (
                            <button className="admin-btn-sop admin-btn-sop-view" onClick={() => { setSopPermit(p); setSopMode('view') }}>View SOP</button>
                          ) : (
                            <button className="admin-btn-sop" onClick={() => { setSopPermit(p); setSopMode('generate') }}>Generate SOP</button>
                          )}
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

        {/* 2 — Work Orders (full width) */}
        <div className="admin-card admin-card-full">
          <div className="admin-card-header">
            <h3>Work Orders</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={openCreate}>+ Create</button>
              <button className="admin-btn-icon" onClick={fetchOrders} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
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

        {/* 3 — JSA (half) + Electrical Isolations (half) */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Job Safety Analysis (JSA)</h3>
            <button className="admin-btn-icon" onClick={fetchJsaRecords} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
          {loadingJSA ? (
            <p className="admin-loading">Loading JSA records...</p>
          ) : jsaRecords.length === 0 ? (
            <p className="admin-empty">No JSA records yet</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>JSA Doc No</th>
                    <th>Permit No</th>
                    <th>Steps</th>
                    <th>Created At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jsaRecords.map((j) => (
                    <tr key={j.id}>
                      <td className="mono-cell">{j.doc_no}</td>
                      <td className="mono-cell">{j.permit_no}</td>
                      <td>{j.jsa_content?.job_steps?.length ?? '-'}</td>
                      <td>{new Date(j.created_at).toLocaleString()}</td>
                      <td className="action-cell">
                        {j.jsa_content && (
                          <button className="admin-btn-edit" onClick={() => setViewJsa({ docNo: j.doc_no, permitNo: j.permit_no, jsaContent: j.jsa_content })}>View</button>
                        )}
                        <button
                          className="admin-btn-secondary-sm"
                          onClick={() => setEditJsa({ id: j.id, docNo: j.doc_no, permitNo: j.permit_no, jsaContent: j.jsa_content })}
                        >Edit</button>
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
            <h3>Electrical Isolations</h3>
            <button className="admin-btn-icon" onClick={fetchElectricalIsolations} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
          {loadingEI ? (
            <p className="admin-loading">Loading electrical isolations...</p>
          ) : electricalIsolations.length === 0 ? (
            <p className="admin-empty">No electrical isolations recorded</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ISO No</th>
                    <th>Permit No</th>
                    <th>Location</th>
                    <th>Technical Objects</th>
                    <th>Tagging</th>
                  </tr>
                </thead>
                <tbody>
                  {electricalIsolations.map((ei) => (
                    <tr key={ei.permit_id}>
                      <td className="mono-cell">{ei.iso_no ?? '—'}</td>
                      <td className="mono-cell">{ei.permit_no}</td>
                      <td className="location-cell">{ei.exact_location}</td>
                      <td>
                        <ul className="ei-admin-list">
                          {ei.items.map((item, i) => (
                            <li key={i}>{item.technical_object} <span className="ei-qty-badge">×{item.quantity}</span></li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <div className="ei-tagging-cell">
                          <label className={`ei-switch ${ei.tagging_condition === 'energised' ? 'ei-switch-locked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={ei.tagging_condition === 'energised'}
                              disabled={ei.tagging_condition === 'energised'}
                              onChange={async () => {
                                const res = await fetch(`/api/admin/electrical-isolations/${ei.permit_id}/energise`, {
                                  method: 'POST', credentials: 'include',
                                })
                                if (res.ok) {
                                  setElectricalIsolations((prev) =>
                                    prev.map((e) => e.permit_id === ei.permit_id ? { ...e, tagging_condition: 'energised' } : e)
                                  )
                                }
                              }}
                            />
                            <span className="ei-switch-slider" />
                          </label>
                          <span className={`ei-switch-label ${ei.tagging_condition === 'energised' ? 'ei-label-energised' : 'ei-label-deenergised'}`}>
                            {ei.tagging_condition === 'energised' ? 'Energised' : 'De-energised'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4 — Partners (half) + Users (half) */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Partners</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={() => { setModalPartner(null); setShowPartnerModal(true) }}>+ Add</button>
              <button className="admin-btn-icon" onClick={fetchPartners} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
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
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
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
          onSaved={() => { setShowCreatePermit(false); fetchPermits(); fetchElectricalIsolations(); fetchJsaRecords() }}
        />
      )}

      {editUser && (
        <UserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers() }}
        />
      )}

      {sopPermit && (
        <SOPModal
          key={sopPermit.id}
          permit={sopPermit}
          mode={sopMode}
          onClose={() => setSopPermit(null)}
          onGenerated={(id, text) => setPermits((prev) =>
            prev.map((p) => p.id === id ? { ...p, sop_text: text } : p)
          )}
        />
      )}

      {viewJsa && (
        <JSADetailModal
          docNo={viewJsa.docNo}
          permitNo={viewJsa.permitNo}
          jsaContent={viewJsa.jsaContent}
          onClose={() => setViewJsa(null)}
        />
      )}

      {editJsa && (
        <EditJSAModal
          jsaRecord={editJsa}
          onClose={() => setEditJsa(null)}
          onSaved={(updatedContent) => {
            setJsaRecords(prev =>
              prev.map(j => j.id === editJsa.id ? { ...j, jsa_content: updatedContent } : j)
            )
            setEditJsa(null)
            setViewJsa({ docNo: editJsa.docNo, permitNo: editJsa.permitNo, jsaContent: updatedContent })
          }}
        />
      )}
    </div>
  )
}
