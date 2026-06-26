import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="app">
      <header className="header">
        <h1>Plant Maintenance</h1>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="btn-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="main">
        <p>Welcome to the Plant Maintenance System</p>
      </main>
    </div>
  )
}
