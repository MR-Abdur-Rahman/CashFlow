import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Single source of truth for the app's back hierarchy. Every screen has ONE logical parent, and "back"
// (the Android hardware/gesture button OR an in-app back arrow) always walks UP this tree — independent
// of the raw order screens were visited in. The five bottom-nav tabs are children of Home; Home is the
// root. Returns null for the root and for the logged-out/onboarding flow screens (no in-app parent).
export function parentOf(pathname: string): string | null {
  if (pathname === "/home") return null; // root

  // Top-level bottom-nav tabs → Home
  if (
    pathname === "/accounts" ||
    pathname === "/split" ||
    pathname === "/reports" ||
    pathname === "/settings"
  ) {
    return "/home";
  }

  // Section drill-downs
  if (/^\/accounts\/[^/]+$/.test(pathname)) return "/accounts";
  if (/^\/split\/(person|group)\/[^/]+$/.test(pathname)) return "/split";
  // The SAME person-detail component is also mounted under Manage; back returns to Manage's People tab.
  if (/^\/manage\/person\/[^/]+$/.test(pathname)) return "/manage?tab=people";

  // Settings sub-pages that nest deeper than the Settings hub
  if (pathname === "/settings/account/edit") return "/settings/account";
  if (pathname === "/settings/feedback" || pathname === "/settings/app-info") return "/settings/help";
  if (pathname === "/settings/history/transactions" || pathname === "/settings/notifications/history") {
    return "/settings/history";
  }
  if (/^\/settings\/tutorial\/[^/]+$/.test(pathname)) return "/settings/tutorial";

  // Manage is reached from the Settings hub
  if (pathname === "/manage") return "/settings";

  // Every other /settings/* page backs up to the Settings hub
  if (pathname.startsWith("/settings/")) return "/settings";

  // /auth, /welcome, /setup, "/" — flow screens with no in-app parent
  return null;
}

// Navigate up one level in the hierarchy (replace, so back walks up the tree without accumulating
// history). Used by every in-app back arrow so they stay consistent with the hardware back handler.
export function useBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const parent = parentOf(location.pathname);
    if (parent) navigate(parent, { replace: true });
  }, [navigate, location.pathname]);
}
