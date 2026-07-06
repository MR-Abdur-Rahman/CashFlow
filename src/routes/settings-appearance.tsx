import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";
import { SettingsHeader, Section, ThemeChoice } from "@/components/SettingsRows";

export default function AppearancePage() {
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

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      <SettingsHeader title="Appearance" />
      <Section label="Theme">
        <div className="p-3 grid grid-cols-2 gap-2">
          <ThemeChoice
            active={theme === "dark"}
            icon={<Moon className="h-4 w-4" />}
            label="Dark"
            onClick={() => updateProfile.mutate({ theme: "dark" })}
          />
          <ThemeChoice
            active={theme === "light"}
            icon={<Sun className="h-4 w-4" />}
            label="Light"
            onClick={() => updateProfile.mutate({ theme: "light" })}
          />
        </div>
      </Section>
    </div>
  );
}
