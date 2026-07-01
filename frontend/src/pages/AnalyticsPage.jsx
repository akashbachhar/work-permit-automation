import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const TYPE_COLORS = {
  Hot: '#ef4444',
  Cold: '#3b82f6',
  Electrical: '#f59e0b',
  Height: '#8b5cf6',
  'Confined Space': '#06b6d4',
  Composite: '#10b981',
}
const fallbackColor = (i) => ['#6366f1', '#ec4899', '#14b8a6', '#f97316'][i % 4]

// ── SVG Gauge ────────────────────────────────────────────────────────────────
function Gauge({ label, value, unit, max, safeMax, warnMax, dark }) {
  const pct = value != null ? Math.min(Math.max(value / max, 0), 1) : 0
  const angle = Math.PI - pct * Math.PI
  const cx = 80, cy = 78, r = 60
  const endX = cx + r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)
  // The gauge sweeps 0°→180° (left to right through the top).
  // The value arc is always ≤180°, so it is always the short arc — largeArc must be 0.
  const largeArc = 0
  const arcColor =
    value == null ? (dark ? '#334155' : '#cbd5e1')
    : value <= safeMax ? '#22c55e'
    : value <= warnMax ? '#f59e0b'
    : '#ef4444'
  const trackColor = dark ? '#1e293b' : '#e2e8f0'
  const textColor = dark ? '#e2e8f0' : '#0f172a'
  const subColor = dark ? '#64748b' : '#94a3b8'

  return (
    <div className={`gauge-card${dark ? ' gauge-card-dark' : ''}`}>
      <svg viewBox="0 0 160 95" width="100%" height="95">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={trackColor} strokeWidth="11" strokeLinecap="round" />
        {value != null && pct > 0 && (
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={arcColor} strokeWidth="11" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="700" fill={arcColor}>
          {value != null ? value : '—'}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9.5" fill={subColor}>{unit}</text>
      </svg>
      <p className="gauge-label" style={{ color: dark ? '#94a3b8' : '#475569' }}>{label}</p>
    </div>
  )
}

// ── Custom Donut tooltip ──────────────────────────────────────────────────────
function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="chart-tooltip">
      <span className="ct-name">{name}</span>
      <span className="ct-val">{value} <span className="ct-pct">({total ? Math.round(value / total * 100) : 0}%)</span></span>
    </div>
  )
}

// ── Donut chart wrapper ───────────────────────────────────────────────────────
function DonutChart({ data, title, dark }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const isEmpty = total === 0
  const emptyData = [{ name: 'No data', value: 1 }]

  return (
    <div className={`chart-card${dark ? ' chart-card-dark' : ''}`}>
      <h4 className="chart-title" style={{ color: dark ? '#94a3b8' : '#475569' }}>{title}</h4>
      {isEmpty ? (
        <div className="chart-empty">No permits yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              paddingAngle={2} dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={TYPE_COLORS[entry.name] || fallbackColor(i)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
            <Legend
              formatter={(val) => <span style={{ fontSize: '0.78rem', color: dark ? '#94a3b8' : '#475569' }}>{val}</span>}
              wrapperStyle={{ paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="chart-total" style={{ color: dark ? '#60a5fa' : '#1d4ed8' }}>
        {total} total
      </div>
    </div>
  )
}

// ── Excel Export card (admin only) ───────────────────────────────────────────
const RANGES = [
  { key: 'today',  label: 'Today' },
  { key: '7days',  label: 'Past 7 Days' },
  { key: 'month',  label: 'Last Month' },
  { key: 'custom', label: 'Custom Range' },
]

function ExportCard({ dark, exportEndpoint }) {
  const [range, setRange] = useState('today')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState('')

  const maxDate = new Date().toISOString().slice(0, 10)
  const minFrom = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10)
  })()

  async function handleDownload() {
    setExportError('')
    if (range === 'custom') {
      if (!fromDate || !toDate) { setExportError('Select both From and To dates.'); return }
      if (fromDate > toDate) { setExportError('"From" must be before "To".'); return }
      const days = (new Date(toDate) - new Date(fromDate)) / 86400000
      if (days > 92) { setExportError('Custom range cannot exceed 3 months.'); return }
    }
    setDownloading(true)
    try {
      let url = `${exportEndpoint}?range=${range}`
      if (range === 'custom') url += `&from=${fromDate}&to=${toDate}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Export failed')
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : 'WorkPermits.xlsx'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setExportError(e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`analytics-card${dark ? ' analytics-card-dark' : ''} export-card`}>
      <div className="export-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22c55e', flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <div>
          <h4 className="section-heading" style={{ margin: 0, color: dark ? '#94a3b8' : '#475569' }}>
            Export Work Permits — Excel
          </h4>
          <p className="export-subtitle">
            All fields: Permit No, WO No, Job Description, Shift, Location, Gas Readings, JSA No, EI ISO No &amp; more
          </p>
        </div>
      </div>

      <div className="export-range-row">
        {RANGES.map(r => (
          <button
            key={r.key}
            className={`export-range-btn${range === r.key ? ' active' : ''}${dark ? ' dark' : ''}`}
            onClick={() => { setRange(r.key); setExportError('') }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="export-custom-row">
          <div className="export-date-field">
            <label className={`export-date-label${dark ? ' dark' : ''}`}>From</label>
            <input type="date" className={`export-date-input${dark ? ' dark' : ''}`}
              value={fromDate} min={minFrom} max={maxDate}
              onChange={e => setFromDate(e.target.value)} />
          </div>
          <span className="export-date-sep" style={{ color: dark ? '#64748b' : '#94a3b8' }}>→</span>
          <div className="export-date-field">
            <label className={`export-date-label${dark ? ' dark' : ''}`}>To</label>
            <input type="date" className={`export-date-input${dark ? ' dark' : ''}`}
              value={toDate} min={fromDate || minFrom} max={maxDate}
              onChange={e => setToDate(e.target.value)} />
          </div>
          <span className="export-date-hint" style={{ color: dark ? '#475569' : '#94a3b8' }}>Max 3 months</span>
        </div>
      )}

      {exportError && <p className="export-error">{exportError}</p>}

      <button className="export-download-btn" onClick={handleDownload} disabled={downloading}>
        {downloading ? (
          <>
            <span className="analytics-spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }} />
            Generating…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Excel
          </>
        )}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage({ apiEndpoint, isAdmin = false, onBack }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const dark = isAdmin

  function load() {
    setLoading(true)
    setError('')
    fetch(apiEndpoint, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
      .then(d => { setData(d); setLastUpdated(new Date()) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [apiEndpoint])

  const handleBack = onBack || (() => navigate(isAdmin ? '/admin' : '/'))

  const permitTypeData = data
    ? Object.entries(data.permit_by_type).map(([name, value]) => ({ name, value }))
    : []

  const todayData = data
    ? Object.entries(data.today_by_type).map(([name, value]) => ({ name, value }))
    : []

  const workmenSeries = data?.workmen_timeseries?.map(d => ({
    ...d,
    date: d.date.slice(5),  // show MM-DD
  })) || []

  const gas = data?.gas_averages || {}
  const status = data?.status_counts || {}

  return (
    <div className={`analytics-page${dark ? ' analytics-dark' : ''}`}>
      {/* Header */}
      <div className="analytics-header">
        <button className="analytics-back-btn" onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
          Back
        </button>
        <div className="analytics-header-title">
          <h2>Analytics &amp; Reports</h2>
          {lastUpdated && (
            <span className="analytics-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <button className="analytics-refresh-btn" onClick={load} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}>
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>
      </div>

      {error && <div className="analytics-error">{error}</div>}

      {loading && !data && (
        <div className="analytics-loading">
          <div className="analytics-spinner" />
          Loading analytics…
        </div>
      )}

      {data && (
        <div className="analytics-grid">

          {/* ── Row 0: Excel Export ── */}
          <ExportCard
            dark={dark}
            exportEndpoint={isAdmin ? '/api/admin/export/work-permits' : '/api/analytics/export/work-permits'}
          />

          {/* ── Row 1: Status numbers ── */}
          <div className="analytics-status-row">
            <div className="status-card status-active">
              <div className="status-number">{status.active ?? 0}</div>
              <div className="status-label">Active Today</div>
              <div className="status-desc">Created or renewed today</div>
            </div>
            <div className="status-card status-pending">
              <div className="status-number">{status.pending ?? 0}</div>
              <div className="status-label">Pending</div>
              <div className="status-desc">Valid but not renewed today</div>
            </div>
            <div className="status-card status-expired">
              <div className="status-number">{status.expired ?? 0}</div>
              <div className="status-label">Expired</div>
              <div className="status-desc">Past 7-day validity</div>
            </div>
          </div>

          {/* ── Row 2: Two Donuts ── */}
          <div className="analytics-two-col">
            <DonutChart
              data={permitTypeData}
              title="All Permits by Type"
              dark={dark}
            />
            <DonutChart
              data={todayData}
              title="Today's Active Permits by Type"
              dark={dark}
            />
          </div>

          {/* ── Row 3: Gas gauges ── */}
          <div className={`analytics-card${dark ? ' analytics-card-dark' : ''}`}>
            <h4 className="section-heading" style={{ color: dark ? '#94a3b8' : '#475569' }}>
              Gas Reading Averages (All Permits)
            </h4>
            <div className="gauges-row">
              <Gauge label="Oxygen (O₂)" value={gas.o2} unit="% vol" max={30} safeMax={23} warnMax={25} dark={dark} />
              <Gauge label="LEL" value={gas.lel} unit="% LEL" max={25} safeMax={5} warnMax={10} dark={dark} />
              <Gauge label="Carbon Monoxide" value={gas.co} unit="ppm" max={100} safeMax={10} warnMax={25} dark={dark} />
              <Gauge label="Hydrogen Sulfide" value={gas.h2s} unit="ppm" max={20} safeMax={1} warnMax={5} dark={dark} />
            </div>
            <div className="gauge-legend">
              <span className="gl-item gl-safe">Safe</span>
              <span className="gl-item gl-warn">Caution</span>
              <span className="gl-item gl-danger">Danger</span>
            </div>
          </div>

          {/* ── Row 4: Workmen time series ── */}
          <div className={`analytics-card${dark ? ' analytics-card-dark' : ''}`}>
            <h4 className="section-heading" style={{ color: dark ? '#94a3b8' : '#475569' }}>
              Workmen Deployed — Last 30 Days
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={workmenSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={dark ? 0.35 : 0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1e3a5f' : '#e2e8f0'} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? '#64748b' : '#94a3b8' }}
                  tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: dark ? '#64748b' : '#94a3b8' }}
                  tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: dark ? '#0f1c2e' : '#fff',
                    border: `1px solid ${dark ? '#1e3a5f' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: dark ? '#e2e8f0' : '#0f172a',
                  }}
                  labelStyle={{ color: dark ? '#60a5fa' : '#1d4ed8', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="workmen" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#wGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  )
}
