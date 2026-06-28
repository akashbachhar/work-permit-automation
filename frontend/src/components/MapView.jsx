import { useState, useEffect, useCallback } from 'react'
import { GoogleMap, OverlayView, InfoWindow } from '@react-google-maps/api'
import { useGoogleMaps } from '../context/GoogleMapsContext'

const center = { lat: 12.975717, lng: 74.834972 }

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px',
}

const mapOptions = {
  mapTypeId: 'satellite',
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
}

const MARKER_COLORS = {
  Hot: '#FF69B4',
  Cold: '#FFD700',
  Electrical: '#4A90D9',
  Height: '#9B59B6',
  Composite: '#FF8C00',
  'Confined Space': '#2ECC71',
}


export default function MapView() {
  const [mapKey, setMapKey] = useState(0)
  const [markers, setMarkers] = useState([])
  const [selected, setSelected] = useState(null)
  const isLoaded = useGoogleMaps()

  const fetchMarkers = useCallback(() => {
    fetch('/api/work-permits/markers', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { markers: [] }))
      .then((data) => setMarkers(data.markers || []))
  }, [])

  useEffect(() => {
    fetchMarkers()
    window.addEventListener('permits-updated', fetchMarkers)
    return () => window.removeEventListener('permits-updated', fetchMarkers)
  }, [fetchMarkers])

  const handleReload = () => {
    setMapKey((k) => k + 1)
    fetchMarkers()
  }

  if (!isLoaded) {
    return (
      <div className="map-placeholder">
        <div className="map-spinner" />
        Loading map...
      </div>
    )
  }

  return (
    <div className="map-wrapper">
      <button className="map-reload-btn" onClick={handleReload} title="Reload Map">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </button>
      <div className="map-legend">
        {Object.entries(MARKER_COLORS).map(([type, color]) => (
          <div key={type} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>
      <GoogleMap
        key={mapKey}
        mapContainerStyle={containerStyle}
        center={center}
        zoom={17}
        options={mapOptions}
      >
        {markers.map((m) => {
          const color = MARKER_COLORS[m.permit_subtype] || '#fff'
          return (
            <OverlayView
              key={m.permit_no}
              position={{ lat: m.location_lat, lng: m.location_lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div className="pulse-marker" onClick={() => setSelected(m)}>
                <span className="pulse-ring" style={{ borderColor: color }} />
                <span className="pulse-dot" style={{ background: color }} />
              </div>
            </OverlayView>
          )
        })}
        {selected && (() => {
          const isExpired = selected.valid_until && new Date(selected.valid_until) < new Date()
          const color = MARKER_COLORS[selected.permit_subtype] || '#888'
          return (
            <InfoWindow
              position={{ lat: selected.location_lat, lng: selected.location_lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="map-info">
                <div className="info-top" style={{ borderColor: color }}>
                  <div className="info-top-left">
                    <span className="info-heading">{selected.work_description || 'Work Permit'}</span>
                    <span className="info-subheading">PO: {selected.permit_no} &middot; WO: {selected.work_order_no}</span>
                  </div>
                  <span className="info-badge" style={{ background: color }}>
                    {selected.permit_subtype}
                  </span>
                </div>

                <div className="info-location">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#003d82" strokeWidth="2">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  {selected.exact_location}
                </div>

                <div className="info-grid">
                  <div className="info-cell">
                    <span className="info-label">Shift</span>
                    <span className="info-value">{selected.shift}</span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Workmen</span>
                    <span className="info-value">{selected.num_workmen}</span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Partner</span>
                    <span className="info-value">{selected.partner_name}</span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Issued By</span>
                    <span className="info-value">{selected.created_by}</span>
                  </div>
                </div>

                <div className="info-footer">
                  <div className="info-dates">
                    <span>Created: {new Date(selected.created_at).toLocaleString()}</span>
                    {selected.renewal_dates.length > 1 && (
                      <span>Approvals: {selected.renewal_dates.length}</span>
                    )}
                  </div>
                  <div className={`info-validity-pill ${isExpired ? 'expired' : 'active'}`}>
                    {isExpired ? 'Expired' : `Valid till ${new Date(selected.valid_until).toLocaleDateString()}`}
                  </div>
                </div>
              </div>
            </InfoWindow>
          )
        })()}
      </GoogleMap>
    </div>
  )
}
