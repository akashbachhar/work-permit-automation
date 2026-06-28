import { useState, useEffect } from 'react'

export default function AdminDashboard({ admin, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreds, setShowCreds] = useState(false)
  const [creds, setCreds] = useState({ current_password: '', username: '', password: '' })
  const [credsMsg, setCredsMsg] = useState('')
  const [credsError, setCredsError] = useState('')

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchUsers, [])

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchUsers()
  }

  const handleCredsSubmit = async (e) => {
    e.preventDefault()
    setCredsMsg('')
    setCredsError('')
    const res = await fetch('/api/admin/change-credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(creds),
    })
    const data = await res.json()
    if (!res.ok) {
      setCredsError(data.error)
    } else {
      setCredsMsg('Credentials updated successfully')
      setCreds({ current_password: '', username: '', password: '' })
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    onLogout()
  }

  return (
    <div className="admin-dashboard">
      <nav className="admin-navbar">
        <h1>Admin Panel</h1>
        <div className="admin-navbar-right">
          <span className="admin-username">{admin.username}</span>
          <button className="admin-btn-outline" onClick={() => setShowCreds(!showCreds)}>
            Change Credentials
          </button>
          <button className="admin-btn-outline" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="admin-content">
        {showCreds && (
          <div className="admin-card admin-creds-card">
            <h3>Change Credentials</h3>
            <form onSubmit={handleCredsSubmit}>
              {credsError && <div className="admin-error">{credsError}</div>}
              {credsMsg && <div className="admin-success">{credsMsg}</div>}
              <label>
                Current Password
                <input
                  type="password"
                  value={creds.current_password}
                  onChange={(e) => setCreds({ ...creds, current_password: e.target.value })}
                  required
                />
              </label>
              <label>
                New Username
                <input
                  type="text"
                  value={creds.username}
                  onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  placeholder="Leave blank to keep current"
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                />
              </label>
              <button type="submit">Update</button>
            </form>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Registered Users</h3>
            <button className="admin-btn-icon" onClick={fetchUsers} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
          {loading ? (
            <p className="admin-loading">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="admin-empty">No registered users</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Password Hash</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.email}</td>
                      <td className="hash-cell">{u.password_hash}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="admin-btn-danger" onClick={() => deleteUser(u.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
