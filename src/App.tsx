import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Home from './routes/home'
import Accounts from './routes/accounts'
import Split from './routes/split'
import Reports from './routes/reports'
import Manage from './routes/manage'
import Settings from './routes/settings'
import Auth from './routes/auth'
import { BottomNav } from './components/BottomNav'

function App() {
  return (
    <BrowserRouter>
      <div className="phone-frame">
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/split" element={<Split />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App