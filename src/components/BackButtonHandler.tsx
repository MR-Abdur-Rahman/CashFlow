import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { parentOf } from "@/lib/navBack";

// Native-only: drive the Android hardware/gesture back button off the logical hierarchy (parentOf)
// instead of the WebView's raw browser-back. Renders nothing. Must live inside the Router.
//   - has a parent  → go up one level (replace)
//   - Home / Auth   → exit the app (standard Android root-back behavior)
//   - Welcome/Setup → no-op (those flows drive their own back with in-screen controls)
export function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep the current path in a ref so the once-registered listener always sees the latest route
  // without re-subscribing on every navigation.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let sub: { remove: () => void } | undefined;
    App.addListener("backButton", () => {
      const path = pathRef.current;
      const parent = parentOf(path);
      if (parent) {
        navigate(parent, { replace: true });
      } else if (path === "/home" || path === "/auth") {
        App.exitApp();
      }
      // else (/welcome, /setup): no-op — those screens handle back themselves.
    }).then((s) => {
      sub = s;
    });
    return () => sub?.remove();
  }, [navigate]);

  return null;
}
