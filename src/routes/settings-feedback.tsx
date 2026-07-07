import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { SettingsHeader } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function FeedbackPage() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File) {
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function send() {
    // No backend yet — just acknowledge.
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
        <Button className="w-full" disabled={!text.trim()} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
