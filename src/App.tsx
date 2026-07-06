import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useRealtimeSplits } from "./hooks/useRealtimeSplits";
import { Fab } from "./components/Fab";
import { AddTransactionSheet } from "./components/AddTransactionSheet";
import "./index.css";
import Home from "./routes/home";
import Accounts from "./routes/accounts";
import Split from "./routes/split";
import Reports from "./routes/reports";
import Manage from "./routes/manage";
import Settings from "./routes/settings";
import Auth from "./routes/auth";
import AccountDetail from "./routes/account-detail";
import SplitPerson from "./routes/split-person";
import SplitGroup from "./routes/split-group";
import SettingsAccount from "./routes/settings-account";
import SettingsHistory from "./routes/settings-history";
import SettingsNotifications from "./routes/settings-notifications";
import SettingsNotificationHistory from "./routes/settings-notification-history";
import SettingsQr from "./routes/settings-qr";
import SettingsPreferences from "./routes/settings-preferences";
import SettingsData from "./routes/settings-data";
import SettingsHistoryHub from "./routes/settings-history-hub";
import { BottomNav } from "./components/BottomNav";
import { supabase } from "./integrations/supabase/client";

// The add-transaction FAB lives on every main tab (Home / Accounts / Split / Reports / Manage /
// Settings), not detail pages. Kept here so a single sheet instance is shared across tabs.
const FAB_TABS = ["/home", "/accounts", "/split", "/reports", "/manage", "/settings"];

function GlobalFab() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  if (!FAB_TABS.includes(pathname)) return null;
  return (
    <>
      <Fab onClick={() => setOpen(true)} />
      <AddTransactionSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function App() {
  useRealtimeSplits();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="phone-frame flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="phone-frame">
        <Routes>
          <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/home" />} />
          <Route path="/" element={<Navigate to={session ? "/home" : "/auth"} />} />
          <Route path="/home" element={session ? <Home /> : <Navigate to="/auth" />} />
          <Route path="/accounts" element={session ? <Accounts /> : <Navigate to="/auth" />} />
          <Route
            path="/accounts/:accountId"
            element={session ? <AccountDetail /> : <Navigate to="/auth" />}
          />
          <Route path="/split" element={session ? <Split /> : <Navigate to="/auth" />} />
          <Route
            path="/split/person/:personId"
            element={session ? <SplitPerson /> : <Navigate to="/auth" />}
          />
          <Route
            path="/split/group/:groupId"
            element={session ? <SplitGroup /> : <Navigate to="/auth" />}
          />
          <Route path="/reports" element={session ? <Reports /> : <Navigate to="/auth" />} />
          <Route path="/manage" element={session ? <Manage /> : <Navigate to="/auth" />} />
          <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
          <Route
            path="/settings/account"
            element={session ? <SettingsAccount /> : <Navigate to="/auth" />}
          />
          <Route path="/settings/qr" element={session ? <SettingsQr /> : <Navigate to="/auth" />} />
          <Route
            path="/settings/preferences"
            element={session ? <SettingsPreferences /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings/notifications"
            element={session ? <SettingsNotifications /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings/notifications/history"
            element={session ? <SettingsNotificationHistory /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings/data"
            element={session ? <SettingsData /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings/history"
            element={session ? <SettingsHistoryHub /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings/history/transactions"
            element={session ? <SettingsHistory /> : <Navigate to="/auth" />}
          />
        </Routes>
        {session && <GlobalFab />}
        {session && <BottomNav />}
      </div>
    </BrowserRouter>
  );
}

export default App;
