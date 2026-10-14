# Admin Dashboard Editor — Handoff

Status: **not started. Owner has not yet asked for it to be built.**
Written 2026-10-14 so a future session can pick it up without re-deciding.

## Goal

Let the site owner (admin account only) edit short pieces of site text from
the Admin Dashboard: landing-page lines, card copy, button labels, and similar.
Changes appear on the live site without a code change or a redeploy.

Out of scope for now: rich text, images, page layout, new pages, and
anything for non-admin members to edit.

## Recommended approach: a `site_copy` table in Supabase

Why this one: the app already has Supabase, the admin account, and an
Admin Dashboard. It adds no new accounts and no new services.

### Data model

```sql
create table if not exists public.site_copy (
  key        text primary key,            -- e.g. 'landing.general.line1'
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.site_copy enable row level security;

-- Anyone (guests included) may read; the landing page is public.
create policy "Anyone can read site copy" on public.site_copy
  for select to anon, authenticated using (true);

-- No direct insert/update/delete. Writes go through the admin RPC below.
revoke insert, update, delete on public.site_copy from anon, authenticated;

create or replace function public.admin_set_copy(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Admins only';
  end if;
  if length(p_value) > 500 then
    raise exception 'Keep each line under 500 characters';
  end if;
  insert into public.site_copy (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), (select auth.uid()))
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
end $$;

revoke execute on function public.admin_set_copy(text, text) from anon;
```

Check the `is_admin` helper name and signature in the live database before
running this; it is referenced as `is_admin(uid)` in CLAUDE.md. Run this in
the Supabase SQL Editor (or via the Management API, see CLAUDE.md "Running SQL
as Claude"), then verify with a rolled-back test: a non-admin call to
`admin_set_copy` must raise "Admins only".

### Frontend

1. On app load, fetch all rows: `supabase.from('site_copy').select('key,value')`.
2. Build a map. For every line, use the stored value if present, otherwise the
   hard-coded default in `MainBoard.jsx`. **The defaults stay in code**, so the
   landing page renders correctly if the table is empty or the fetch fails.
3. Replace the literal strings in the landing page with `copy('key', 'default')`.
4. Admin Dashboard gets a new **Site text** tab:
   - Lists every known key, grouped (Hero, General card, Members card, Posting note).
   - Shows the current value in a text box, with the default beside it.
   - Save calls `admin_set_copy`. "Reset to default" deletes the row (add an
     `admin_reset_copy(p_key)` RPC, same admin check).
   - Keep each line short. Show a live preview of the landing block if practical.
5. Keys are a fixed list in one file (e.g. `src/lib/siteCopy.js`), with defaults
   beside them. Adding a new editable line means adding one entry there.

### Current editable lines (as of PR #11 and #12)

| Key | Default |
|---|---|
| `landing.hero.1` | Neighborly built, hosted, and maintained — Community Board. |
| `landing.hero.2` | Fueled by transparency, authenticity, anonymity, if need be. |
| `landing.hero.3` | Our Build. Your Voice. |
| `landing.general.1` | Open to neighbors. Start a thread, read a thread, join in a conversation. |
| `landing.general.2` | See something, say something. |
| `landing.general.3` | No account required. |
| `landing.general.4` | Post with name, unit number, or anonymously. |
| `landing.members.intro` | Register as a Building 7 resident. Sign up with your unit number to get in. |
| `landing.members.posting` | Members can post under their name, unit #, or anonymously. |

The Members bullet list and the Archives line are also candidates, but they
contain JSX (icons), so they need a small structural change first. Leave them
for a later pass.

## Alternative considered: Decap CMS

Decap (formerly Netlify CMS) gives a web editor at `/admin` and commits
changes to a file in this repo, such as `src/content/landing.json`. Vercel
then redeploys.

What it would take:
- A GitHub OAuth App for the repo.
- A small serverless login endpoint on Vercel (`api/auth.js`), because Decap's
  GitHub login needs an OAuth proxy. Netlify Identity is the easier route but
  this project is on Vercel.
- Every admin needs a GitHub account with write access to the repo.
- Each edit is a git commit and triggers a deploy, so a change takes a minute
  or two to go live. The `site_copy` approach is instant.

Verdict: it works, but it adds more moving parts (OAuth app, login function,
GitHub accounts) than the Supabase approach for one owner editing a few lines.
Revisit if the owner later wants edit history in git or wants to hand editing
to someone without a Supabase admin login.

## Open questions for the owner

1. Are you happy with the Supabase-table approach, or do you want Decap?
2. Should "Reset to default" exist, or is editing enough?
3. Should there be an edit history (who changed what, when)? The table keeps
   only the latest `updated_by` and `updated_at`. Full history needs a
   `site_copy_history` table.

## Testing when built

- Unit: `copy()` returns the stored value, else the default; an empty table
  renders the defaults.
- Permissions (against scratch or live via rolled-back `DO` block): anon and
  member calls to `admin_set_copy` are refused; admin calls succeed; direct
  INSERT/UPDATE on `site_copy` is refused.
- Browser at phone width: edit a line as admin, reload as a guest, confirm the
  new text shows. Reset it and confirm the default returns.
- Build passes (`npm run build`).
