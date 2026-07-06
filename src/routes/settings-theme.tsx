import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsHeader } from "@/components/SettingsRows";

export default function ThemePage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { data: profile } = useQuery(profileQuery(userId));
  const theme = (profile as any)?.theme ?? "dark";

  const updateProfile = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update(patch as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(e.message),
  });

  // Apply the theme to <html> immediately (global, instant) so it doesn't wait on the profile
  // refetch; the mutation persists it and PrefsApplier re-confirms on next load.
  function choose(next: "dark" | "light") {
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("light", next === "light");
    root.style.colorScheme = next;
    updateProfile.mutate({ theme: next });
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Appearance" />
      {/* Dark | Light segmented toggle — same style as Reports income/expense */}
      <div className="flex rounded-xl bg-secondary p-1 gap-1">
        <button
          type="button"
          onClick={() => choose("dark")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
            theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <Moon className="h-4 w-4" /> Dark
        </button>
        <button
          type="button"
          onClick={() => choose("light")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
            theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <Sun className="h-4 w-4" /> Light
        </button>
      </div>
    </div>
  );
}
