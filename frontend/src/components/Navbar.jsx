import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [permitOpen, setPermitOpen] = useState(false)

  return (
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
            <Link to="/work-order" className="btn-nav">Work Order</Link>
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
                  <Link to="/work-permit/new" onClick={() => setPermitOpen(false)}>New Work Permit</Link>
                  <Link to="/work-permit/renew" onClick={() => setPermitOpen(false)}>Renew Work Permit</Link>
                </div>
              )}
            </div>
            <span className="navbar-email">{user.email}</span>
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
  )
}
