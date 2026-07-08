// Tiny pub/sub so the home "N due" badge can re-open the ScheduledDuePrompt after it's been
// dismissed (the dialog lives in App.tsx; the badge lives in home.tsx — siblings, no shared tree).
let listeners = new Set<() => void>();

export function openScheduledPrompt() {
  listeners.forEach((l) => l());
}

export function subscribeScheduledPrompt(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
