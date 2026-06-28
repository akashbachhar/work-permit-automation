import { useState } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { useGoogleMaps } from '../context/GoogleMapsContext'

const center = { lat: 12.978935582489221, lng: 74.83626455299897 }

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

export default function MapView() {
  const [mapKey, setMapKey] = useState(0)
  const isLoaded = useGoogleMaps()

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
      <button className="map-reload-btn" onClick={() => setMapKey((k) => k + 1)} title="Reload Map">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </button>
      <GoogleMap
        key={mapKey}
        mapContainerStyle={containerStyle}
        center={center}
        zoom={16}
        options={mapOptions}
      />
    </div>
  )
}
