# Crevo OpenCall Beta

OpenCall is a separate public route at `/opencall`. Brands publish one of their existing briefs as an open creative challenge. Registered creators upload actual concept previews. Visitors browse and vote without creating an account. The host selects a creator under the published selection rules, and the selected concept continues into the existing Round 2 project workflow.

## Beta status

OpenCall is marked **Beta** in navigation, the directory, launch form, dashboards and challenge pages. This release includes the public route on the existing Render service and uses the same Supabase project as the marketplace. The additive hosted schema was installed on 25 October 2026. The winner RPC was verified as the server role inside a transaction that was rolled back; ordinary marketplace records were preserved. New environments must apply the hosted SQL before enabling the feature. No new dependency or paid AI call is required.

## Try it locally

Build the frontend with `npm run build`. Then, from `backend`, run:

```powershell
python run_opencall_local.py --port 8011
```

The launcher asks for a password and starts `http://127.0.0.1:8011/opencall`. It uses the isolated `tmp/opencall-preview.db`, with `brand@gmail.com` and `creator@gmail.com`, the curated studio portfolio, and an open Cobalt brief. Both local accounts use the password supplied at first creation. Re-running the launcher preserves challenges, profile edits, declared rights, brand details and existing local passwords. It does not reset the live accounts or engagement. Optional `--db` selects a separate local file; `CREVO_LOCAL_DEMO_PASSWORD` supplies a password non-interactively.

Each challenge shows a **Your next step** panel for the current account and stage. This explains when submission or voting is available, links to the right controls, and provides **Copy public link**. Logging in or joining from an OpenCall returns to that challenge. The mobile navigation includes logout so both sides of a collaboration can be tried on a narrow screen. Background polling cannot overwrite a newer saved revision.

### Brand: launch a challenge

1. Sign in as the local brand. Choose **OpenCall** in navigation or **Launch OpenCall** on the dashboard.
2. Choose **Launch an OpenCall**. Select an existing open brief. Briefs with an existing project or OpenCall are unavailable.
3. Choose **Brand choice**, **Community vote**, or **Together, 50 / 50**.
4. Set the submission and voting/review deadlines in local time. The server stores explicit time zones and rejects past or reversed deadlines.
5. Write participation terms: what a concept should demonstrate, judging criteria, compensation for participation, and the winning engagement. The USD project budget is not promised to every entrant. Payment processing is not implemented.
6. Confirm publication. **Launch OpenCall** makes the brief, requirements, rights and participation terms public. The public snapshot and selection mode are fixed for that challenge.

### Creator: submit real work

1. Sign out and sign in as the local creator. Open the challenge from `/opencall`.
2. Read the public brief and participation terms.
3. Choose a PNG, JPEG, WebP or MP4, at most 50 MB. The server inspects actual bytes, format and dimensions. This is a concept preview; final delivery requirements are enforced later in the project.
4. Add a title, creative approach, tools actually used and the production workflow. These claims are creator reported.
5. Confirm permission to publish and acceptance of the participation terms, then **Submit your creation**. The actual file appears in the public gallery.
6. One entry per creator is enforced. An entry can be withdrawn while submissions are open; withdrawal does not allow a replacement entry. A watermarked preview is appropriate where the creator wants protection against casual reuse.

### Visitors: vote

1. Open the public challenge in a signed-out browser.
2. Voting begins when submissions close, either at the deadline or when the host deliberately closes that stage early.
3. Click **Vote** on a concept. A signed, HTTP-only, SameSite cookie identifies the browser. The database holds a challenge-specific keyed hash, not the raw cookie or IP address.
4. Repeating a vote does not add another. Choosing another concept moves the existing vote. Reloading preserves it.
5. Signed-in host brands and participating creators cannot vote. IP and browser quotas limit abuse, but clearing cookies, using other browsers or signing out can defeat identity-level restrictions. This is explicitly one vote per browser, **not verified one-person voting**.

### Brand: evaluate and select

1. **Close entries & open voting**, or **Close entries & review** for Brand choice. A confirmation panel explains the change. Early closures are recorded publicly.
2. For modes with voting, **Close voting & review** freezes voting.
3. **Brand choice:** evaluate the chosen concept (0–100 and a rationale), then choose any evaluated entry.
4. **Community vote:** select an entry with the highest vote count, with at least one vote. A lower-voted entry is rejected by the server. The host explains a decision between tied leaders.
5. **Together, 50 / 50:** evaluate every visible entry. Each score is `0.5 × brand score + 0.5 × (entry votes / highest entry votes × 100)`. No votes gives a zero community component. Select a highest-scoring entry; ties go to the host with a reason.
6. **Select creator** checks current declared rights against the original brief. Unknown or mismatched required rights block selection. The creator can update their offer before the brand retries.
7. **Confirm selection & create project** saves the winner, application and project atomically, closes the source brief, and exposes the project link only to its participants. Retrying the same successful selection returns the existing project.
8. **Open project workspace** continues through **Propose terms → Confirm scope & license → production updates → checked upload → version-specific feedback → revision → approval**. The chosen concept is linked from the workspace. A preview is not treated as an approved final delivery or an agreed commercial license.

Brand evaluations and rationales remain private to the host until a winner is selected. Final scores and the selection reason are then public. Voter identity hashes, account emails, internal actor IDs and private project IDs are excluded from public responses.

## Moderation and closure

The host can remove an inappropriate entry with a recorded public reason, excluding it from eligible vote totals and preventing public access to its preview. The creator can still see their entry status. Canceling a challenge requires a reason and ends further submissions, votes and selection. The same brief cannot be relaunched as another challenge; create a new brief instead. The original private application flow remains available after cancellation.

Challenge stages are enforced server-side from deadlines as well as explicit transitions. Concurrent writes use a revision comparison; a conflict returns 409 and the UI refreshes rather than losing another visitor's vote or creator's entry. Limits are 200 entries, 10,000 browser votes and 1,500 recorded management events per challenge. This compact JSON aggregate is intended for the hackathon's scale; a larger launch should normalize entries and votes into indexed tables.

## Data and deployment

- `backend/opencall.py`: API, phase rules, voting, scoring, safe public projection and winner selection.
- `backend/store.py`: isolated local schema and JSON normalization.
- `backend/opencall_schema.sql`: idempotent hosted upgrade, private storage bucket and transactional winner RPC. `schema.sql` includes the same extension for new installs.
- `backend/engagements.py`: shared transaction helper preserves the existing application-to-project behavior.
- `src/OpenCall.jsx`, `src/opencall.css`: public directory, launch form, real upload gallery, host controls and results.
- `src/App.jsx`, `BriefDetail.jsx`, `ProjectWorkspace.jsx`: navigation, dashboard and brief entry points, plus the selected-concept handoff.

For a later deployment, run `backend/opencall_schema.sql` against the intended Supabase project before deploying the backend. The upgrade was applied to the existing hosted project for the Beta release. It remains a prerequisite for a new environment. The `opencalls` table has RLS enabled and no grants for anonymous/authenticated database clients; only the server role accesses the aggregate. The `crevo-opencall` storage bucket is private. Public media is served through the backend only for visible submissions. These previews are intentionally public and can be downloaded; do not submit private originals.

Local files live beside the selected SQLite database under `opencall-media/`. Hosted files use Supabase Storage. Removing or withdrawing an entry prevents public serving but retains its file for operator recovery. Uploaded files that lose a known revision conflict are removed. Unexpected upstream write failures are not replayed automatically; orphan cleanup is an operator task.

## Verification

`backend/test_opencall.py` includes Beta regressions for uploads crossing deadlines and local profile persistence. `src/opencall-state.test.js` covers safe login return paths, stage guidance and stale polling. The backend suite covers launch permissions and privacy, actual file inspection, consent and duplicates, visitor voting/moving votes, all three selection modes, deadline and revision conflicts, moderation, rights checks, atomic rollback, retry safety, and the existing agreement/revision/final-delivery workflow. Tests use isolated SQLite data and no paid services. The hosted winner RPC was exercised under the service role, including retry safety and project handoff, inside a rollback-only transaction. Hosted API checks additionally exercise actual storage, visitor votes and selection using temporary records that are removed after verification.
