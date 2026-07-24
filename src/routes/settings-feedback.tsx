import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

// Up to this many screenshots/recordings per submission — enough for a full repro, bounded so the
// notification email (which attaches every file) stays sane.
const MAX_ATTACHMENTS = 5;

type Attachment = { file: File; preview: string; isVideo: boolean };

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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

  // Append newly-picked files up to the cap, building a data-URL preview for each.
  function pick(files: File[]) {
    setAttachments((prev) => {
      const room = MAX_ATTACHMENTS - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files`);
        return prev;
      }
      if (files.length > room) toast.message(`Only the first ${room} more were added (max ${MAX_ATTACHMENTS})`);
      const added: Attachment[] = files.slice(0, room).map((file) => {
        const att: Attachment = { file, preview: "", isVideo: (file.type || "").startsWith("video/") };
        const reader = new FileReader();
        reader.onload = () =>
          setAttachments((cur) => cur.map((a) => (a.file === file ? { ...a, preview: reader.result as string } : a)));
        reader.readAsDataURL(file);
        return att;
      });
      return [...prev, ...added];
    });
  }

  function removeAttachment(file: File) {
    setAttachments((prev) => prev.filter((a) => a.file !== file));
  }

  async function send() {
    if (!email.trim()) return toast.error("Email is required");
    if (!text.trim()) return;
    setSending(true);
    try {
      // Upload every attachment to the private feedback bucket; the Edge Function attaches them all to
      // the email. Best-effort — a file that fails to upload is skipped, the rest (and the text) still
      // send.
      const imagePaths: string[] = [];
      for (const { file } of attachments) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${userId ?? "anon"}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feedback")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) toast.error(`"${file.name}" couldn't upload: ${upErr.message}`);
        else imagePaths.push(path);
      }

      const { error } = await (supabase as any).from("feedback").insert({
        user_id: userId,
        name: name.trim() || null,
        email: email.trim(),
        message: text.trim(),
        // New array carries every attachment; keep the legacy singular column populated with the first
        // for backward compatibility with older readers.
        image_path: imagePaths[0] ?? null,
        image_paths: imagePaths.length ? imagePaths : null,
      });
      if (error) return toast.error(error.message);
      toast.success("Feedback sent");
      setText("");
      setAttachments([]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: "var(--background)" }}>
      <div className="px-4 pt-6">
        <SettingsHeader title="Send feedback" back="/settings/help" />
      </div>

      <div className="px-4 pt-3 space-y-5">
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
            <p className="text-sm font-medium">
              Screenshots or recordings (optional)
              {attachments.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {attachments.length}/{MAX_ATTACHMENTS}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Add up to {MAX_ATTACHMENTS}. Remove any sensitive info before attaching.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {attachments.map(({ file, preview, isVideo }) => (
              <div key={`${file.name}-${file.lastModified}-${file.size}`} className="relative h-20 w-20">
                {isVideo ? (
                  <video
                    src={preview || undefined}
                    className="h-20 w-20 rounded-xl object-cover border border-border bg-secondary"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={preview || undefined}
                    alt={file.name}
                    className="h-20 w-20 rounded-xl object-cover border border-border bg-secondary"
                  />
                )}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeAttachment(file)}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground border border-border"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {attachments.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-xl border border-border bg-card text-muted-foreground active:bg-secondary/40"
              >
                <ImagePlus className="h-6 w-6" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (fs.length) pick(fs);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          By sending, you allow CashFlow to review related technical info to help address your
          feedback.
        </p>

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
