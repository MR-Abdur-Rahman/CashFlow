-- Support multiple attachments per feedback submission. Stored as an array on the row itself (rather
-- than a child table) so the AFTER-INSERT webhook payload (to_jsonb(new)) carries every path
-- atomically — a child table would be inserted after the feedback row and race the webhook.
-- The legacy single image_path column is retained for older rows and read as a fallback.
alter table public.feedback add column if not exists image_paths text[];

comment on column public.feedback.image_paths is
  'Storage paths (feedback bucket) for all attachments on this submission. Supersedes image_path; the singular column is kept for older rows and as a fallback.';
