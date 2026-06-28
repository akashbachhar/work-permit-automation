import { useState, useEffect, useCallback } from 'react'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useGoogleMaps } from '../context/GoogleMapsContext'

const defaultCenter = { lat: 12.975717, lng: 74.834972 }

const mapContainerStyle = {
  width: '100%',
  height: '220px',
  borderRadius: '8px',
}

const mapOptions = {
  mapTypeId: 'satellite',
  disableDefaultUI: true,
  zoomControl: true,
}

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

export default function CreateWorkPermitModal({ onClose }) {
  const [options, setOptions] = useState({ work_orders: [], partners: [], permit_subtypes: [], shifts: [] })
  const [form, setForm] = useState({
    work_order_no: '',
    permit_subtype: '',
    shift: '',
    location_lat: null,
    location_lng: null,
    exact_location: '',
    num_workmen: '',
    partner_no: '',
    gas_o2: '21',
    gas_lel: '0',
    gas_co: '0',
    gas_h2s: '0',
  })
  const [checkDone, setCheckDone] = useState([...DEFAULT_DONE])
  const [checkNotReq, setCheckNotReq] = useState([...DEFAULT_NOT_REQUIRED])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerFocused, setPartnerFocused] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  const isLoaded = useGoogleMaps()

  useEffect(() => {
    fetch('/api/work-permits/options', { credentials: 'include' })
      .then((r) => r.json())
      .then(setOptions)
  }, [])

  const moveToDone = (item) => {
    setCheckNotReq((prev) => prev.filter((i) => i !== item))
    setCheckDone((prev) => [...prev, item])
  }

  const moveToNotReq = (item) => {
    setCheckDone((prev) => prev.filter((i) => i !== item))
    setCheckNotReq((prev) => [...prev, item])
  }

  const handleMapClick = useCallback((e) => {
    setForm((f) => ({
      ...f,
      location_lat: e.latLng.lat(),
      location_lng: e.latLng.lng(),
    }))
  }, [])

  const filteredPartners = options.partners.filter(
    (p) =>
      p.partner_name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.partner_no.includes(partnerSearch)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        num_workmen: form.num_workmen ? Number(form.num_workmen) : null,
        gas_o2: form.gas_o2 !== '' ? Number(form.gas_o2) : null,
        gas_lel: form.gas_lel !== '' ? Number(form.gas_lel) : null,
        gas_co: form.gas_co !== '' ? Number(form.gas_co) : null,
        gas_h2s: form.gas_h2s !== '' ? Number(form.gas_h2s) : null,
        checklist_done: checkDone,
        checklist_not_required: checkNotReq,
      }
      const res = await fetch('/api/work-permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(data.permit_no)
      window.dispatchEvent(new Event('permits-updated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPartner = options.partners.find((p) => p.partner_no === form.partner_no)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Work Permit</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {success ? (
          <div className="modal-body">
            <div className="modal-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <h3>Work Permit Created</h3>
              <p className="order-no">{success}</p>
            </div>
            <button className="modal-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="modal-body modal-scroll" onSubmit={handleSubmit}>
            {error && <div className="modal-error">{error}</div>}

            <label>
              Work Order
              <select value={form.work_order_no} onChange={(e) => setForm({ ...form, work_order_no: e.target.value })} required>
                <option value="">Select work order</option>
                {options.work_orders.map((o) => (
                  <option key={o.order_no} value={o.order_no}>
                    {o.order_no} — {o.description}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Permit Subtype
              <select value={form.permit_subtype} onChange={(e) => setForm({ ...form, permit_subtype: e.target.value })} required>
                <option value="">Select subtype</option>
                {options.permit_subtypes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label>
              Shift
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} required>
                <option value="">Select shift</option>
                {options.shifts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
            <div className="permit-map-box">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={form.location_lat ? { lat: form.location_lat, lng: form.location_lng } : defaultCenter}
                  zoom={17}
                  options={mapOptions}
                  onClick={handleMapClick}
                >
                  {form.location_lat && (
                    <Marker position={{ lat: form.location_lat, lng: form.location_lng }} />
                  )}
                </GoogleMap>
              ) : (
                <div className="permit-map-loading">Loading map...</div>
              )}
            </div>

            <label>
              Exact Work Location
              <input
                type="text"
                value={form.exact_location}
                onChange={(e) => setForm({ ...form, exact_location: e.target.value })}
                required
                placeholder="e.g. Near Pump House 3, Unit A"
              />
            </label>

            <label>
              No. of Workmen
              <input
                type="number"
                min="1"
                value={form.num_workmen}
                onChange={(e) => setForm({ ...form, num_workmen: e.target.value })}
                required
              />
            </label>

            <label>
              Partner
              <div className="partner-select">
                <input
                  type="text"
                  className="partner-search"
                  placeholder="Search partner..."
                  value={form.partner_no ? `${selectedPartner?.partner_no} — ${selectedPartner?.partner_name}` : partnerSearch}
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
                    {filteredPartners.length === 0 ? (
                      <div className="partner-option partner-empty">No match</div>
                    ) : (
                      filteredPartners.map((p) => (
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

            <fieldset className="gas-test-group">
              <legend>Gas Test</legend>
              <div className="gas-test-fields">
                <label className="gas-field">
                  O2 %
                  <input type="number" step="0.1" value={form.gas_o2} onChange={(e) => setForm({ ...form, gas_o2: e.target.value })} />
                </label>
                <label className="gas-field">
                  LEL %
                  <input type="number" step="0.1" value={form.gas_lel} onChange={(e) => setForm({ ...form, gas_lel: e.target.value })} />
                </label>
                <label className="gas-field">
                  CO %
                  <input type="number" step="0.1" value={form.gas_co} onChange={(e) => setForm({ ...form, gas_co: e.target.value })} />
                </label>
                <label className="gas-field">
                  H2S (PPM)
                  <input type="number" step="0.1" value={form.gas_h2s} onChange={(e) => setForm({ ...form, gas_h2s: e.target.value })} />
                </label>
              </div>
            </fieldset>

            <div className="checklist-section">
              <h4 className="checklist-title">Check List</h4>
              <div className="checklist-columns">
                <div className="checklist-box checklist-done">
                  <div className="checklist-box-header done-header">Done</div>
                  {checkDone.map((item) => (
                    <div key={item} className="checklist-chip chip-done" onClick={() => moveToNotReq(item)}>
                      {item}
                    </div>
                  ))}
                  {checkDone.length === 0 && <p className="checklist-empty">Click items to move here</p>}
                </div>
                <div className="checklist-box checklist-notreq">
                  <div className="checklist-box-header notreq-header">Not Required</div>
                  {checkNotReq.map((item) => (
                    <div key={item} className="checklist-chip chip-notreq" onClick={() => moveToDone(item)}>
                      {item}
                    </div>
                  ))}
                  {checkNotReq.length === 0 && <p className="checklist-empty">Click items to move here</p>}
                </div>
              </div>
            </div>

            <button className="modal-btn" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Work Permit'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
