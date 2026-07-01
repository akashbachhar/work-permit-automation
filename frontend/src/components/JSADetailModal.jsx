export default function JSADetailModal({ docNo, permitNo, jsaContent, onClose }) {
  const steps = jsaContent?.job_steps || []
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal jsa-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <h3>JSA — {docNo}</h3>
            {permitNo && <span className="jsa-detail-subtitle">Permit {permitNo}</span>}
          </div>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="jsa-detail-body">
          {steps.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No steps available.</p>}
          {steps.map((step, i) => (
            <div key={i} className="jsa-step-card">
              <div className="jsa-step-number">Step {i + 1}</div>
              <div className="jsa-step-name">{step.step}</div>
              <div className="jsa-step-columns">
                <div className="jsa-step-col">
                  <div className="jsa-col-header jsa-hazard-header">Potential Hazards</div>
                  <ul className="jsa-col-list">
                    {(step.potential_hazards || []).map((h, j) => <li key={j}>{h}</li>)}
                  </ul>
                </div>
                <div className="jsa-step-col">
                  <div className="jsa-col-header jsa-control-header">Hazard Control Measures</div>
                  <ul className="jsa-col-list">
                    {(step.control_measures || []).map((c, j) => <li key={j}>{c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
