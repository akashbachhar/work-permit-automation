import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import AdminAnalyticsPage from './AdminAnalyticsPage'

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

  return (
    <Routes>
      <Route index element={<AdminDashboard admin={admin} onLogout={() => setAdmin(null)} />} />
      <Route path="analytics" element={<AdminAnalyticsPage />} />
    </Routes>
  )
}
