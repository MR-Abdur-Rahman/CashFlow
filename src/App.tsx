import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Home from './routes/home'
import Accounts from './routes/accounts'
import Split from './routes/split'
import Reports from './routes/reports'
import Manage from './routes/manage'
import Settings from './routes/settings'
import Auth from './routes/auth'
import AccountDetail from './routes/account-detail'
import SplitPerson from './routes/split-person'
import SplitGroup from './routes/split-group'
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
          <Route path="/accounts/:accountId" element={<AccountDetail />} />
          <Route path="/split" element={<Split />} />
          <Route path="/split/person/:personId" element={<SplitPerson />} />
          <Route path="/split/group/:groupId" element={<SplitGroup />} />
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