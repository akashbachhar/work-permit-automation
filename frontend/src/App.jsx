import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import logo from './assets/logo.png'
import './App.css'

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

function AppLayout() {
  const { loading } = useAuth()

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="app">
      <Navbar />
      <div className="hero">
        <img src={logo} alt="HPCL Logo" className="hero-logo" />
        <div className="hero-text">
          <h1>Plant Maintenance Dashboard</h1>
          <p className="hero-subtitle">Hindustan Petroleum Corporation Limited</p>
        </div>
      </div>
      <main className="main">
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
