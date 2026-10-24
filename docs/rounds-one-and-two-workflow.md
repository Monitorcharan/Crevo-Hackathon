# Crevo: complete Round 1 and Round 2 workflow

Verified on 24 October 2026 against the repository and live application.

Trust signals now include documented work, actual portfolio review status, brand-approved engagement history and completed-project feedback. See [trust signals and connection recovery](trust-signals.md) for the implementation and the fix for reported intermittent 500 responses.

[Open Crevo](https://crevo-hackathon.onrender.com) · [Sign in](https://crevo-hackathon.onrender.com/login)

## 1. Introduction

Crevo connects brands and agencies with creators who use AI creative tools. Round 1 supplies creator profiles, AI portfolios, discovery and structured briefs. Round 2 uses those same records to recommend creators, explain fit, agree scope and rights, coordinate production, manage revisions and approve delivered work.

The complete journey is:

Creator profile → documented AI work → brand brief → ranked matches → reviewed shortlist → invitation → creator response → selection → confirmed scope and license → production → checked version 1 → feedback → version 2 → final approval.

## 2. What was verified

- **52 backend tests passed**, covering the original marketplace, authentication, authorization and Round 2 journey.
- **8 frontend tests passed** and the Vite production build passed.
- A temporary live brief completed matching, an actual assistant proposal, invitation notification, creator acceptance, brand selection, scope/license confirmation, production update, failed upload, successful version 1, revision, version 2 and approval.
- Live matching used **70% weighted rules + 30% AI assessment** and returned **95/100** for the test brief. This is a fit score, not an accuracy benchmark or guaranteed outcome.
- The square file failed the required 4:5 ratio before it became a delivery. The correct PNG passed server inspection and was downloadable privately by the brand. Unauthenticated download was blocked.
- The live revision clarified the written handoff while resubmitting the same concept file. The history correctly identified the identical file. Automated tests separately verify changed file bytes, hashes and version comparisons.
- All temporary test records and uploaded files were removed. Your prepared Cobalt brief remains open with no shortlist, application or project, ready to begin.

One active creator and one active brand are intentionally retained. The assistant proposes up to five eligible creators; with this data, one proposal is correct. Broader ranking, sparse profiles, contradictory requirements, unknown rights and conflicting territories are covered by isolated tests.

## 3. Prepare the two sessions

1. Open a normal browser window for the brand.
2. Open Incognito or a different browser profile for the creator. Two ordinary tabs share the sign-in session and can switch each other's account.
3. Sign in with **brand@gmail.com** and **creator@gmail.com**, using the passwords supplied privately in this conversation. Passwords are not copied into this repository guide.
4. Confirm the dashboard names: **Crevo Creative Team** for the brand and **Crevo Studio** for the creator.

Use the existing accounts for the presentation. Public email registration needs a configured email provider for reliable confirmation delivery. Email confirmation remains enabled; existing users do not need another confirmation email to sign in.

## 4. Round 1: marketplace foundations

### Step 1 — Creator profile

As the creator, open **Dashboard → Edit your profile** or `/profile/edit`.

Review the name, studio mark/photo, title, bio, categories, skills, platforms, location and starting rate. Crevo Studio focuses on product visualization, AI photography and advertising creative. Save the profile and use **View public profile** to inspect its presentation.

Only list skills and tools you can demonstrate. The current work uses OpenAI Image Generation; do not claim that these assets were made with Runway or Midjourney.

### Step 2 — AI portfolio evidence

Open `/portfolio/edit`. Review the existing Cobalt and Citrus work samples. Each item should contain the work itself, title/description, actual tools/models, production workflow, content type, format/aspect ratio, commercial-use terms and provenance.

These are original independent concepts created for this project, not commissioned client campaigns. Cobalt is a vertical 1122 × 1402 PNG, approximately 4:5. Citrus is a square 1254 × 1254 PNG. A service listing alone does not count as portfolio evidence.

The declared rights offer is worldwide organic social, paid social and website use for 12 months, non-exclusive. Independent verification is pending. There is no approved verification badge or invented client review.

[View the creator profile](https://crevo-hackathon.onrender.com/creators/86e5d32a-81c6-43b5-93a8-46d8ca0834dc)

### Step 3 — Brand profile

As the brand, open **Dashboard → Edit brand profile**. Review the contact name, company name and logo. Save the profile so creators can identify the organization behind its briefs.

### Step 4 — Manual discovery

Open `/discover`. Search/filter by category, skill, tool, content type or platform. Inspect the creator's content fit, skills/tools, portfolio evidence, commercial-use fit and trust signals. This is Round 1 discovery; Round 2 adds brief-specific ranking using the same records.

### Step 5 — Structured brief

For a quick walkthrough, open **Cobalt launch / premium product imagery** from the brand dashboard.

[Open the prepared brief](https://crevo-hackathon.onrender.com/briefs/caf0c30d-7328-46c8-b59c-fb458324e6c5)

To demonstrate a new brief, choose **Create a brief**. Optionally enter a campaign idea and select **Draft brief fields**. Review every suggested field before publishing. Use these values to match the current portfolio:

- Category: Product Visualization.
- Goal/style: premium minimalist studio imagery for a cobalt-blue skincare bottle.
- Skills: Art Direction, Product Imagery, Visual Concept Development.
- Content type: Image; format: PNG, 4:5.
- Required tool: OpenAI Image Generation. Leave video duration empty for a still image.
- Platforms: Instagram/Facebook; budget: USD 1,500.
- Deliverables: one vertical PNG at least 1000 pixels wide, workflow notes and usage-rights handoff.
- Target date: 10 November 2026; revision rounds: 2.
- Structured rights: organic social, paid social and web; Worldwide; 12 months; non-exclusive.

Choose **Publish brief**. Publishing through this screen starts the shortlist assistant and opens proposals. On the prepared older brief, use **Build auto-shortlist** when ready.

## 5. Round 2: matching through delivery

### Step 6 — Review ranked, explained matches

On the brief, choose **Explore matches & shortlist → Ranked matches**. Expand **Why this match · evidence & gaps**. Review the score, component signals, relevant portfolio links, offered rights and weaknesses.

Explain how Cobalt supports the requested style, content, tool and format. Pending verification remains a gap to discuss. No strong match produces an explicit warning. Unknown rights are not treated as compatible. Rights conflicts cap the result at 49; sparse portfolio evidence or unconfirmed rights caps it at 74. Uncovered structured rights block selection.

### Step 7 — Review the auto-shortlist

For the prepared brief, choose **Build auto-shortlist**. A newly published brief proposes candidates automatically.

Open **Shortlist & proposals**. Choose **Accept proposals**, **Reject proposals**, or edit suggestions with **Keep creator** and **Remove**. You can also use **+ Shortlist** from ranked results.

The assistant uses actual stored brief, creator and portfolio data. Its actions and brand decisions persist in the activity history. Candidates need a score of at least 50 and no declared rights mismatch. No eligible result produces an explanation instead of invented creators.

### Step 8 — Invitation and creator response

As the brand, choose **Invite creator**, review the editable message, then **Send invitation**. A private conversation and creator notification are created.

As the creator, open the invitation notification or brief. Choose **Accept invitation** or **Decline invitation**. For this walkthrough, accept. This records interest and creates an application; scope is confirmed later.

As the brand, refresh **Applications** and choose **Accept & start project**. Both users can open the shared workspace from their dashboards.

### Step 9 — Confirm scope, timeline and license

As the brand, open **Scope & usage rights**. Review the license, enter **Proposed amount (INR)** and write **Deliverables & usage terms**.

Example: “One premium 4:5 PNG, workflow notes, worldwide organic/paid social and website use for 12 months, non-exclusive; due 10 November 2026; two revision rounds.” An example quote is INR 25,000. This quote is separate from the USD brief budget; no currency conversion occurs.

Choose **Propose terms**. As the creator, review them and choose **Confirm scope & license**. Production begins, with agreed rights and confirmation attached to the project. Accepted terms cannot be silently changed. Payments are outside the current live workflow.

### Step 10 — Production updates and discussion

As the creator, write a note in **Progress updates** and choose **Post**. The brand sees it in the same workspace. Use **Project conversation** for questions and responses. Updates/messages retain actors and timestamps; open conversations refresh live with a polling fallback.

### Step 11 — Demonstrate delivery checking

Download these existing assets to your computer before uploading:

- [Citrus square PNG: wrong ratio for this brief](https://crevo-hackathon.onrender.com/portfolio/citrus-studio.png).
- [Cobalt vertical PNG: matching ratio](https://crevo-hackathon.onrender.com/portfolio/cobalt-studio.png).

As the creator, under **Submit version 1 → Upload the actual delivery**, first upload Citrus. Crevo flags the aspect-ratio mismatch and explains the fix. The failed file does not create a version for brand review.

Upload Cobalt next and inspect the successful checks. The server inspects actual bytes, rather than trusting filenames or browser-supplied dimensions.

### Step 12 — Submit version 1

Enter a **Delivery title** and **Production & handoff notes**, including tools, workflow, format and agreed usage terms. Choose **Submit for review**.

The brand sees version 1, technical checks, file, notes and timestamp. Choose **Download delivery** to inspect it.

### Step 13 — Revision and version history

As the brand, write specific **Feedback** on version 1, then **Request revision**. For a creative revision, describe the desired visual change, such as warmer lighting or adjusted placement.

As the creator, choose **Start revision**. Make the change in the appropriate creative tool, upload the revised export, explain what changed and submit version 2.

The states are requested → in progress → submitted → approved. Original feedback stays linked to version 1. Version 2 records which feedback it responds to. Actors, timestamps and handoff notes remain visible. File metadata comparison reports a new file, changed dimensions/format/duration, or an identical file.

For a technical rehearsal without creating another image, request a written handoff clarification and explicitly resubmit the unchanged file. The history correctly identifies it as identical; do not describe that as a visual edit.

### Step 14 — Approval and final delivery

As the brand, review the latest version and agreed terms, then choose **Approve & complete project**.

Both users retain completed status, approved file, previous versions, feedback, progress, scope, licensing snapshot and activity timeline. Additional submissions are blocked. A genuine completed-project review is optional; avoid fictional client testimonials for a rehearsal.

## 6. Technical explanation and testing

The frontend uses React/Vite. FastAPI implements APIs and enforces roles, ownership and workflow transitions. Supabase supplies PostgreSQL, email/password Auth and private delivery Storage. Firebase supports configured social sign-in. Docker on Render serves the frontend and API from one origin. The configured AI provider assists drafting, introductions and matching.

Matching considers category/specialization, skills, tools, format/aspect ratio, content type, style, rights, trust and budget. Applicable rule signals are normalized to 100. Successful AI assessment contributes 30%, rules contribute 70%, and safety caps are reapplied. If AI fails, rule ranking remains available. Crevo does not train its own recommendation model or claim measured recommendation accuracy.

Tests cover conflicting/unknown rights, sparse evidence, contradictory briefs, AI failure fallback, duplicate invitations, unauthorized actions, stale workflow updates, scope confirmation, real file metadata, blocked submissions, revision lineage, approval and private downloads. Tests inspect PNG and actual MP4 dimensions/duration. The current live creative portfolio contains still images.

## 7. Boundaries to explain accurately

- Delivery checking supports PNG, JPEG, WebP and MP4 up to 50 MB. It checks type, format, ratio and requested video duration, with ±0.5 second duration tolerance.
- Visual quality, exact colors/logos, arbitrary minimum resolution in prose, originality and legal ownership require human review. Cobalt exceeds the requested width, but that prose request is not an automatic gate.
- Style matching uses text/structured evidence, not visual embeddings. Version comparison uses file hashes/metadata, not visual differences.
- Licensing checks compare declared usage, duration, territory and exclusivity. They do not independently certify copyright or each model/provider's license.
- Verification is pending for the current creator. No approved badge is claimed.
- Included revisions are recorded and visible. Extra rounds need discussion; there is no automatic billing or hard stop at the allowance.
- One active creator means one eligible proposal. Bonus features work on real stored data; evaluators decide the actual bonus credit.
- Public email signup still needs an email provider for reliable confirmation delivery. Existing account sign-in and the engagement journey were verified live.

## 8. Short presentation script

“Round 1 gave us AI creator profiles, evidence-rich portfolios, discovery and structured brand briefs. Round 2 turns that data into explained recommendations and a managed engagement. The brand reviews an assistant shortlist, invites a creator and confirms scope and licensing. The creator shares progress and uploads work. Crevo checks technical requirements before review, ties feedback to specific versions and retains agreed rights through final approval. Our walkthrough uses actual platform records and uploaded files.”
