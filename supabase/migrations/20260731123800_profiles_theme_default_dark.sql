-- Dark is the app's primary theme: index.css defines the dark palette on :root and light is the
-- html.light override. The column defaulting to 'light' (set by 20260706103024_default_theme_light)
-- meant every new signup landed on the non-default theme without ever choosing it.
--
-- Future signups only. Existing rows are deliberately untouched: a row holding 'light' because it
-- was never set is indistinguishable from one where the user picked Light (nothing writes `theme`
-- except the Preferences toggle, and there is no audit trail), so rewriting them would silently
-- override real choices.
alter table public.profiles alter column theme set default 'dark';
