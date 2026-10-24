# Crevo Round 2 walkthrough

Round 2 extends the original React/FastAPI marketplace. The new flow uses stored briefs, registered creators, AI portfolios, contact threads, applications, and projects. It does not use a separate hardcoded matching screen.

## Start the isolated local demo

From the repository root, in two terminals:

```powershell
python backend/run_round_two_local.py
```

```powershell
npm run dev
```

Open `http://localhost:5173/login`. The existing **Try as a brand** and **Try as a creator** buttons use the seeded accounts. The shared password is `CrevoDemo2026!`. Data is saved in `tmp/round2-preview.db`, separately from the original SQLite database and hosted Supabase project. To start a fresh scenario, pass a new file: `python backend/run_round_two_local.py --db tmp/round2-fresh.db`.

All seeded identities and portfolio claims are fictional, clearly described shared demo accounts. Their MP4 samples are solid-color technical placeholders, not creative campaigns. Replace these with your team's actual creative exports for the presentation. File dimensions and duration checks run on the actual uploaded bytes either way.

Rules matching works without an AI service. Add `--ai` to the launcher to enable the configured Gemini/OpenAI assessment. Actual AI results are labeled with the provider-assisted method; errors retain the rules ranking. No generated response is simulated.

## Judge journey

1. **Brand → campaign.** Open “Sola Coffee / the first sip.” It requests a 15-second 9:16 video, Runway evidence, and worldwide organic/paid social and website use for 12 months. Alternatively publish a new brief: it automatically starts the shortlist assistant and opens its proposals.
2. **Matching.** Inspect the ranked cards, component scores, portfolio references, and weaknesses. Maya and Arjun have compatible declared offers. Nia's India-only, three-month offer conflicts with the brief. Sol's sparse profile has weak evidence. Unknown rights are not treated as compatible.
3. **Assistant.** On the seeded brief, choose **Build auto-shortlist**. Accept the proposals, keep/remove individual creators, or reject the set. Check the durable activity history, including removed proposals. The assistant only proposes candidates with scores of at least 50 and no declared rights conflict. An empty result explains that more suitable evidence or refined requirements are needed.
4. **Contact.** Invite Maya with an editable message. This creates a private inbox conversation and a creator notification. Generating or accepting proposals alone does not send invitations.
5. **Creator response.** Open `/login`, choose **Try as a creator**, open the invitation notification, then accept or decline from the brief. Accepting creates an application for the brand to review. The profile editor includes the creator's structured offered rights.
6. **Selection and agreement.** Switch to the brand, review the application, and select Maya. A creator with conflicting or undeclared rights cannot be selected for a brief with structured requirements. The project retains the selected brief and offered-rights snapshot. Propose the INR quote and scope, review the license, then switch to the creator and confirm the scope and license. Production starts only after acceptance. The quote explicitly remains separate from the original USD budget; the payment walkthrough is optional and simulated.
7. **Fail a delivery check.** Upload `public/round-two-samples/round2-landscape.mp4`. The server inspects the file and flags the 16:9 versus 9:16 mismatch. It returns a fix and no submission token. The brand's version history remains unchanged.
8. **Submit version 1.** Upload `public/round-two-samples/round2-vertical.mp4`, or your own 15-second 9:16 MP4, add a title and handoff notes, and submit. File type, aspect ratio, and duration (±0.5s) are checked before submission. The saved version includes the results and file hash.
9. **Revise.** As the brand, request specific changes on version 1. As the creator, choose **Start revision**, upload the revised file, describe the changes, and submit version 2. The previous feedback, actor, timestamp, and relationship between versions stay visible.
10. **Deliver.** As the brand, approve the latest version. The project completes, additional submissions are blocked, and both sides retain the agreed license, scope, version history, file checks, and activity timeline. A completed-project review is then available.

## Existing hosted project

Apply the additive statements in `backend/schema.sql` before deploying this code to the existing Supabase-backed service. The schema adds structured rights, tools, duration, and shortlist records and updates the transactional selection function. The new table enables RLS, revokes direct browser access, and grants access only to the backend service role, consistent with the original architecture. Existing records remain intact. The existing Render service serves the deployed app; `/api/health` identifies the Round 2 release.

Delivery files use the private Supabase `crevo-deliveries` Storage bucket created by the schema. In local mode they are stored beside the selected database in `deliveries/`. Both storage modes require project membership for downloads through FastAPI; delivery files do not receive public Storage links. Uploaded assets are checked on the server, signed for the project, and expire for submission after 24 hours. Saved deliveries remain downloadable afterward.

## Verification

```powershell
npm run build
python -m pytest backend -q
```

The suite covers the original account/marketplace features plus portfolio ranking, rights conflicts and unknowns, real MP4 dimensions/duration, shortlist decisions, invitations, authorization, agreement acceptance, failed uploads, checked versions, revision lineage, concurrency conflicts, final approval, and file access. On this Windows sandbox, API tests need loopback access for FastAPI TestClient's event loop.

The delivery check supports PNG, JPEG, WebP and MP4 up to 50 MB. It checks technical metadata, not visual quality, underlying model licenses, originality, or legal validity. License comparisons use explicitly declared terms; creator confirmation is retained in the project. Country names must match (case-insensitive); “Worldwide” is the broad grant. Portfolio style matching uses textual evidence rather than visual embedding analysis.
