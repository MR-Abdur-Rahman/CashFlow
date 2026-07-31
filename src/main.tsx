// test comment
console.log("URL:", import.meta.env.VITE_SUPABASE_URL);
import { PrefsApplier } from "./components/PrefsApplier";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";
import { SwipeProvider } from "./components/SwipeRow";
import { initAccountSync } from "./lib/accountSync";

const queryClient = new QueryClient();

// Remember every account that signs in, and keep the active one's stored tokens current.
// Registered here (not inside a component) so it runs once and can't be torn down by a remount.
initAccountSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SwipeProvider>
        <PrefsApplier />
        <App />
        <Toaster position="top-center" />
      </SwipeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
