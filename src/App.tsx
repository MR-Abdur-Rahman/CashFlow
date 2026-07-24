import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useRealtimeSplits } from "./hooks/useRealtimeSplits";
import { Fab, type TxnTab } from "./components/Fab";
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
import SettingsAccountEdit from "./routes/settings-account-edit";
import SettingsPrivacy from "./routes/settings-privacy";
import SettingsHistory from "./routes/settings-history";
import SettingsNotifications from "./routes/settings-notifications";
import SettingsNotificationHistory from "./routes/settings-notification-history";
import SettingsQr from "./routes/settings-qr";
import SettingsPreferences from "./routes/settings-preferences";
import SettingsInvite from "./routes/settings-invite";
import SettingsHistoryHub from "./routes/settings-history-hub";
import SettingsHelp from "./routes/settings-help";
import SettingsFeedback from "./routes/settings-feedback";
import SettingsAppInfo from "./routes/settings-app-info";
import SettingsTutorial from "./routes/settings-tutorial";
import SettingsTutorialDetail from "./routes/settings-tutorial-detail";
import SettingsScheduled from "./routes/settings-scheduled";
import { ScheduledDuePrompt } from "@/components/ScheduledDuePrompt";
import { BottomNav } from "./components/BottomNav";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { NativeUpdateModal } from "./components/NativeUpdateModal";
import { PermissionsOnboarding } from "./components/PermissionsOnboarding";
import { BackButtonHandler } from "./components/BackButtonHandler";
import { SplashScreen, SPLASH_MIN_MS } from "./components/SplashScreen";
import Setup from "./routes/setup";
import Welcome from "./routes/welcome";
import { supabase } from "./integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { syncGoogleEmail } from "@/lib/googleAuth";

// The add-transaction FAB lives on every main tab (Home / Accounts / Split / Reports / Manage /
// Settings), not detail pages. Kept here so a single sheet instance is shared across tabs.
const FAB_TABS = ["/home", "/accounts", "/split", "/reports", "/manage", "/settings"];

function GlobalFab() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TxnTab>("expense");
  if (!FAB_TABS.includes(pathname)) return null;
  return (
    <>
      <Fab
        onSelect={(t) => {
          setTab(t);
          setOpen(true);
        }}
      />
      <AddTransactionSheet open={open} onOpenChange={setOpen} defaultTab={tab} />
    </>
  );
}

function App() {
  useRealtimeSplits();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Enforce a minimum splash duration so it never just flashes by. The splash stays up until BOTH the
  // real session check is done AND at least 2.5s have elapsed since mount — whichever finishes later.
  const [minElapsed, setMinElapsed] = useState(false);
  // Bumped each time ScheduledDuePrompt closes, so NativeUpdateModal can re-run its check in the same
  // session once that prompt is dismissed (instead of deferring to the next launch).
  const [scheduledClosedTick, setScheduledClosedTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Native only: paint the reserved status-bar strip to match the app background, with light icons.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#0A0A0A" }).catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Backfill google_email for a Google-linked user (deferred to avoid the supabase-js
      // in-callback deadlock). Covers the link case the handle_new_user trigger can't.
      if (event === "SIGNED_IN") setTimeout(() => void syncGoogleEmail(), 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading || !minElapsed) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter>
      <RoutedApp
        session={session}
        scheduledClosedTick={scheduledClosedTick}
        onScheduledClosed={() => setScheduledClosedTick((t) => t + 1)}
      />
    </BrowserRouter>
  );
}

// Everything below the router: the onboarding gate + routes + app chrome. Split into its own component
// so it can call useLocation()/useQuery() inside the BrowserRouter context.
function RoutedApp({
  session,
  scheduledClosedTick,
  onScheduledClosed,
}: {
  session: any;
  scheduledClosedTick: number;
  onScheduledClosed: () => void;
}) {
  const location = useLocation();
  const userId = session?.user?.id as string | undefined;
  const { data: profile, isLoading: profileLoading } = useQuery(profileQuery(userId));

  // With a session but the profile not yet loaded, hold on the splash so we never flash /home before
  // the gate can decide. profileQuery is disabled without a userId, so this only waits when signed in.
  if (session && profileLoading) {
    return <SplashScreen />;
  }

  const onboarded = !!profile?.onboarded_at;
  // Central onboarding gate: any signed-in user whose profile exists but hasn't finished guided setup
  // is funneled to /setup from EVERY entry point (app reopen, direct nav to /home, Google landing).
  // A brand-new email/Google user's row is created synchronously by the handle_new_user trigger inside
  // the signup transaction, so by the time a session exists the row is present with onboarded_at null
  // → gate sends them to /setup. If the row is somehow absent (profile == null), fall through to normal
  // routing rather than trap them in a loop.
  const needsSetup = !!session && profile != null && !onboarded;
  if (needsSetup && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }
  // A finished user should never sit on /setup. Hand off to /welcome (permissions → intro carousel →
  // home), matching Setup's own navigate — so the redirect is deterministic and never races to /home.
  if (session && onboarded && location.pathname === "/setup") {
    return <Navigate to="/welcome" replace />;
  }

  // App chrome (nav, FAB, prompts) shows only once past setup — never over the guided-setup or intro
  // screens. /welcome renders full-screen post-setup (and on logged-in replay), so exclude it too.
  const showChrome = !!session && !needsSetup && location.pathname !== "/welcome";

  return (
    <div className="phone-frame">
      <BackButtonHandler />
      <Routes>
        <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/home" />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<Navigate to={session ? "/home" : "/auth"} />} />
        <Route path="/setup" element={session ? <Setup /> : <Navigate to="/auth" />} />
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
        <Route
          path="/settings/account/edit"
          element={session ? <SettingsAccountEdit /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/privacy"
          element={session ? <SettingsPrivacy /> : <Navigate to="/auth" />}
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
          path="/settings/invite"
          element={session ? <SettingsInvite /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/history"
          element={session ? <SettingsHistoryHub /> : <Navigate to="/auth" />}
        />
        <Route path="/settings/help" element={session ? <SettingsHelp /> : <Navigate to="/auth" />} />
        <Route
          path="/settings/feedback"
          element={session ? <SettingsFeedback /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/app-info"
          element={session ? <SettingsAppInfo /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/tutorial"
          element={session ? <SettingsTutorial /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/tutorial/:topicId"
          element={session ? <SettingsTutorialDetail /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/scheduled"
          element={session ? <SettingsScheduled /> : <Navigate to="/auth" />}
        />
        <Route
          path="/settings/history/transactions"
          element={session ? <SettingsHistory /> : <Navigate to="/auth" />}
        />
      </Routes>
      {showChrome && <GlobalFab />}
      {showChrome && <BottomNav />}
      {showChrome && <PermissionsOnboarding />}
      {showChrome && <NativeUpdateModal retrySignal={scheduledClosedTick} />}
      {showChrome && <ScheduledDuePrompt onClosed={onScheduledClosed} />}
      <UpdatePrompt />
    </div>
  );
}

export default App;
