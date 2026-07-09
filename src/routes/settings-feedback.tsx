import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill name/email from the signed-in account (both stay editable).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUserId(u?.id ?? null);
      setEmail((e) => e || u?.email || "");
      setName((n) => n || ((u?.user_metadata?.full_name as string) ?? ""));
    });
  }, []);

  function pick(f: File) {
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function send() {
    if (!email.trim()) return toast.error("Email is required");
    if (!text.trim()) return;
    setSending(true);
    const { error } = await (supabase as any).from("feedback").insert({
      user_id: userId,
      name: name.trim() || null,
      email: email.trim(),
      message: text.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Feedback sent");
    setText("");
    setPreview(null);
  }

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: "var(--background)" }}>
      <div className="px-4 pt-6">
        <SettingsHeader title="Send feedback" back="/settings/help" />
      </div>

      <div className="flex-1 px-4 pt-3 space-y-5">
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
          />
          <Input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (so we can reply)"
          />
        </div>

        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the technical issue"
        />

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Screenshots or recordings (optional)</p>
            <p className="text-xs text-muted-foreground">
              Tap screenshot to edit or remove sensitive info
            </p>
          </div>

          {preview ? (
            <div className="relative h-20 w-20">
              <img
                src={preview}
                alt="Attachment"
                className="h-20 w-20 rounded-xl object-cover border border-border"
              />
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setPreview(null)}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground border border-border"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-20 w-20 place-items-center rounded-xl border border-border bg-card text-muted-foreground active:bg-secondary/40"
            >
              <ImagePlus className="h-6 w-6" />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pick(f);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          By sending, you allow CashFlow to review related technical info to help address your
          feedback.
        </p>
      </div>

      <div className="px-4 pt-4">
        <Button
          className="w-full"
          disabled={sending || !text.trim() || !email.trim()}
          onClick={send}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
