import { useState, useEffect } from 'react'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

export default function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setAdmin(data.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  if (!admin) return <AdminLogin onLogin={setAdmin} />

  return <AdminDashboard admin={admin} onLogout={() => setAdmin(null)} />
}
