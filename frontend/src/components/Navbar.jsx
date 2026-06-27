import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <div className="navbar-right">
        {user ? (
          <>
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
