import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function exportJsaPdf(docNo, permitNo, steps) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header block
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 43, 92)
  doc.text('JOB SAFETY ANALYSIS (JSA)', 148, 18, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`JSA Doc No: ${docNo}`, 14, 27)
  if (permitNo) doc.text(`Permit No: ${permitNo}`, 14, 33)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, permitNo ? 39 : 33)

  // Divider
  doc.setDrawColor(0, 43, 92)
  doc.setLineWidth(0.5)
  doc.line(14, permitNo ? 43 : 37, 283, permitNo ? 43 : 37)

  const tableStartY = permitNo ? 47 : 41

  const body = steps.map((s, i) => [
    `${i + 1}. ${s.step}`,
    (s.potential_hazards || []).map((h, j) => `${j + 1}. ${h}`).join('\n'),
    (s.control_measures || []).map((c, j) => `${j + 1}. ${c}`).join('\n'),
  ])

  autoTable(doc, {
    startY: tableStartY,
    head: [['Job Steps', 'Potential Hazards', 'Hazard Control Measures']],
    body,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      valign: 'top',
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [0, 43, 92],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 95 },
      2: { cellWidth: 95 },
    },
    alternateRowStyles: { fillColor: [240, 246, 255] },
    margin: { left: 14, right: 14 },
    tableLineColor: [0, 43, 92],
    tableLineWidth: 0.4,
  })

  // Page numbers
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${p} of ${pageCount}`, 283, 205, { align: 'right' })
  }

  doc.save(`JSA_${docNo}${permitNo ? `_${permitNo}` : ''}.pdf`)
}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {steps.length > 0 && (
              <button
                className="jsa-pdf-btn"
                onClick={() => exportJsaPdf(docNo, permitNo, steps)}
                title="Download PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export PDF
              </button>
            )}
            <button className="admin-modal-close" onClick={onClose}>&times;</button>
          </div>
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
