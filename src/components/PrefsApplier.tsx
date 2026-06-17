import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";
import { setMoneyFormat } from "@/lib/format";

/**
 * Reads the signed-in user's preferences (theme, currency format) and applies
 * them globally. Mount once near the app root.
 */
export function PrefsApplier() {
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id));
    return () => sub.subscription.unsubscribe();
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));

  useEffect(() => {
    const theme = (profile as any)?.theme ?? "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const sep = ((profile as any).thousand_separator ?? ",") as "," | "." | " " | "";
    setMoneyFormat({
      symbol: (profile as any).currency_symbol ?? "LKR",
      thousandSeparator: sep,
      decimalPlaces: (profile as any).decimal_places ?? 2,
    });
  }, [profile]);

  return null;
}
