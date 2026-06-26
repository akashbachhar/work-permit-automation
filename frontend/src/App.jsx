import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('disconnected'))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>Plant Maintenance</h1>
        <span className={`status ${status === 'ok' ? 'online' : 'offline'}`}>
          {status === 'ok' ? 'Connected' : 'Offline'}
        </span>
      </header>
      <main className="main">
        <p>Welcome to the Plant Maintenance System</p>
      </main>
    </div>
  )
}

export default App
