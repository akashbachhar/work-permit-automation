import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CreateWorkOrderModal from './CreateWorkOrderModal'
import CreateWorkPermitModal from './CreateWorkPermitModal'
import RenewWorkPermitModal from './RenewWorkPermitModal'
import logo from '../assets/logo.png'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [permitOpen, setPermitOpen] = useState(false)
  const [showWorkOrder, setShowWorkOrder] = useState(false)
  const [showNewPermit, setShowNewPermit] = useState(false)
  const [showRenewPermit, setShowRenewPermit] = useState(false)

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-left">
          <img src={logo} alt="HPCL Logo" className="navbar-logo" />
          <div className="navbar-title">
            <h1>Plant Maintenance Dashboard</h1>
            <p>Hindustan Petroleum Corporation Limited</p>
          </div>
        </Link>
        <div className="navbar-right">
          {user ? (
            <>
              <button className="btn-nav" onClick={() => setShowWorkOrder(true)}>Work Order</button>
              <div className="nav-dropdown">
                <button
                  className="btn-nav"
                  onClick={() => setPermitOpen(!permitOpen)}
                >
                  Work Permit
                  <svg className="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
                    <path d="M0 0l5 6 5-6z" />
                  </svg>
                </button>
                {permitOpen && (
                  <div className="dropdown-menu" onMouseLeave={() => setPermitOpen(false)}>
                    <button onClick={() => { setPermitOpen(false); setShowNewPermit(true) }}>New Work Permit</button>
                    <button onClick={() => { setPermitOpen(false); setShowRenewPermit(true) }}>Renew Approval</button>
                  </div>
                )}
              </div>
              <Link to="/analytics" className="btn-nav btn-nav-analytics">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <path d="M3 3v18h18" /><path d="M18 9l-5 5-2-2-5 5" />
                </svg>
                Analytics
              </Link>
              <span className="navbar-email">{user.name}</span>
              <button className="btn-nav" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-nav">Login</Link>
              <Link to="/register" className="btn-nav btn-nav-primary">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
      {showWorkOrder && <CreateWorkOrderModal onClose={() => setShowWorkOrder(false)} />}
      {showNewPermit && <CreateWorkPermitModal onClose={() => setShowNewPermit(false)} />}
      {showRenewPermit && <RenewWorkPermitModal onClose={() => setShowRenewPermit(false)} />}
    </>
  )
}
