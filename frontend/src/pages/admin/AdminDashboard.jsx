import { useState, useEffect } from 'react'

const PRIORITIES = ['Safety Critical', 'High', 'Medium', 'Low']

function WorkOrderModal({ order, orderTypes, onClose, onSaved }) {
  const isEdit = !!order
  const [form, setForm] = useState({
    order_type: order?.order_type || '',
    priority: order?.priority || '',
    description: order?.description || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const url = isEdit ? `/api/admin/work-orders/${order.id}` : '/api/admin/work-orders'
    const method = isEdit ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{isEdit ? 'Edit Work Order' : 'Create Work Order'}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="admin-modal-body" onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}
          <label>
            Order Type
            <select value={form.order_type} onChange={(e) => setForm({ ...form, order_type: e.target.value })} required>
              <option value="">Select order type</option>
              {orderTypes.map((t) => (
                <option key={t.code} value={t.code}>{t.code} — {t.description}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} required>
              <option value="">Select priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              placeholder="Brief description"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminDashboard({ admin, onLogout }) {
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [showCreds, setShowCreds] = useState(false)
  const [creds, setCreds] = useState({ current_password: '', username: '', password: '' })
  const [credsMsg, setCredsMsg] = useState('')
  const [credsError, setCredsError] = useState('')
  const [modalOrder, setModalOrder] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const fetchUsers = () => {
    setLoadingUsers(true)
    fetch('/api/admin/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoadingUsers(false))
  }

  const fetchOrders = () => {
    setLoadingOrders(true)
    fetch('/api/admin/work-orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setOrders(data.work_orders || []))
      .finally(() => setLoadingOrders(false))
  }

  useEffect(() => {
    fetchUsers()
    fetchOrders()
    fetch('/api/admin/order-types', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setOrderTypes(data.order_types || []))
  }, [])

  const deleteOrder = async (id) => {
    if (!confirm('Delete this work order?')) return
    await fetch(`/api/admin/work-orders/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchOrders()
  }

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

  const openCreate = () => {
    setModalOrder(null)
    setShowModal(true)
  }

  const openEdit = (order) => {
    setModalOrder(order)
    setShowModal(true)
  }

  const handleSaved = () => {
    setShowModal(false)
    fetchOrders()
  }

  const priorityClass = (p) => {
    if (p === 'Safety Critical') return 'priority-critical'
    if (p === 'High') return 'priority-high'
    if (p === 'Medium') return 'priority-medium'
    return 'priority-low'
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
            <h3>Work Orders</h3>
            <div className="admin-card-actions">
              <button className="admin-btn-create" onClick={openCreate}>+ Create</button>
              <button className="admin-btn-icon" onClick={fetchOrders} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            </div>
          </div>
          {loadingOrders ? (
            <p className="admin-loading">Loading work orders...</p>
          ) : orders.length === 0 ? (
            <p className="admin-empty">No work orders yet</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono-cell">{o.order_no}</td>
                      <td>{o.order_type} — {o.order_type_desc}</td>
                      <td>{o.description}</td>
                      <td><span className={`priority-badge ${priorityClass(o.priority)}`}>{o.priority}</span></td>
                      <td>{o.created_by}</td>
                      <td>{new Date(o.created_at).toLocaleString()}</td>
                      <td className="action-cell">
                        <button className="admin-btn-edit" onClick={() => openEdit(o)}>Edit</button>
                        <button className="admin-btn-danger" onClick={() => deleteOrder(o.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
          {loadingUsers ? (
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

      {showModal && (
        <WorkOrderModal
          order={modalOrder}
          orderTypes={orderTypes}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
