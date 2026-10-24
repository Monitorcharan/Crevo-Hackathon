# Crevo — AI Creator Marketplace

[Live application](https://crevo-hackathon.onrender.com) · [Complete Round 1 and Round 2 workflow](docs/rounds-one-and-two-workflow.md) · [Presentation guide](docs/demo-guide.md)

Crevo connects AI creators with brands and creative agencies, from discovering relevant work to approving the final delivery. Round 1 provides profiles, AI portfolios, search and structured briefs. Round 2 adds explained recommendations, reviewed shortlist proposals, invitations, scope and licensing agreements, production updates, versioned feedback and delivery checks.

## What is implemented

### Round 1: discovery and brief definition

- Creator profiles with specializations, skills, platforms, starting rates and optional social/contact links.
- AI portfolios documenting actual tools/models, workflow, output format and declared commercial use.
- Search and filters for category, skill, tool, content type and platform; side-by-side creator comparison.
- Brand profiles with company identity and logo.
- Structured briefs covering content, style, format/aspect ratio, tools, deliverables, deadline, revision allowance, budget and usage rights.
- Optional AI assistance for editable brief drafts and portfolio introductions.

### Round 2: matching through delivery

- Ranked creator recommendations with score breakdowns, portfolio references, strengths and gaps.
- Auto-shortlist proposals based on stored briefs and creator evidence. The brand can accept, edit or reject them before sending an invitation.
- Private invitations, creator acceptance/decline, applications and brand selection.
- Confirmed scope, INR project quote, timeline and licensing snapshot before production.
- Production updates and private conversations with live updates and a polling fallback.
- Actual-file delivery checks, numbered versions, feedback tied to a version, revision status and final approval.
- Public trust summaries separating creator documentation, portfolio review, approved engagement history and completed-project feedback.

Publishing a new brief through the interface starts the shortlist assistant. The assistant proposes **up to five eligible creators**; it does not invent candidates to fill the list.

## Technology

- **Frontend:** React, Vite, React Router, GSAP, Motion and Three.js/React Three Fiber for the optional mascot scene.
- **Backend:** Python 3.11, FastAPI and Pydantic.
- **Persistence:** Supabase PostgreSQL, Supabase email/password Auth and Storage; isolated SQLite is available for local development/tests.
- **Social sign-in:** Firebase Authentication for explicitly configured providers.
- **AI:** configured Gemini or OpenAI text APIs. Gemini takes priority when both keys are configured.
- **Hosting:** one Docker web service on Render serving the built frontend and API from the same origin.

## Complete workflow

1. Creator completes a profile and publishes work with tools, workflow, formats and offered rights.
2. Brand completes its company profile, searches creators and publishes a structured brief.
3. Brand reviews ranked matches and their supporting evidence, then reviews the assistant's shortlist proposals.
4. Brand sends an invitation; creator accepts or declines.
5. Brand selects an application to start the shared project.
6. Brand proposes scope, INR quote and rights; creator confirms the agreement.
7. Creator posts progress and uploads a deliverable. Failed technical checks explain what to fix before submission.
8. Creator submits version 1; brand approves it or requests specific changes.
9. Creator starts the revision, submits version 2 and records what changed.
10. Brand approves the latest delivery. Both sides retain the agreed terms, files, versions, feedback and timeline.

Use separate browser profiles for creator and brand sessions. Credentials are not published in this repository. See the [full walkthrough](docs/rounds-one-and-two-workflow.md) for exact screens, buttons and current Cobalt example.

## Run locally

Use Node.js 24 LTS and Python 3.11 to match the production container. Run the following from the repository root in two PowerShell terminals.

**Backend**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements-dev.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
python -m uvicorn main:app --reload
```

**Frontend**

```powershell
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). FastAPI runs at [localhost:8000](http://localhost:8000), with API documentation at `/docs`. Vite proxies `/api` to the backend.

With no Supabase values, the backend creates `backend/crevo.db`. Local startup is empty: register a creator and brand, add real portfolio evidence and publish a brief. Profile/logo uploads require configured Supabase Storage; local project delivery files are supported.

To run isolated fictional development fixtures, use the [local test scenario](docs/round-two-demo.md). It uses a separate SQLite database and technical video fixtures. It does not seed the live Supabase marketplace.

## Configure the backend

Start with [backend/.env.example](backend/.env.example). All server credentials belong in `backend/.env` locally or private Render environment settings.

### Supabase

1. Create a project and apply [backend/schema.sql](backend/schema.sql) in its SQL editor. It includes additive updates for existing installations.
2. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` together. Legacy anon/service-role variable names remain supported.
3. Configure the Auth Site URL and allowed confirmation redirect URLs for the actual app origin and `/login`.
4. Keep email confirmation enabled and configure a verified SMTP sender before broad public registration.
5. Restart the backend and check `/api/health` reports `database: supabase`.

FastAPI enforces roles and ownership. Tables have RLS enabled and direct browser access revoked; server credentials stay on the backend. Public profile images use the `portfolios` bucket. Checked delivery files use the private `crevo-deliveries` bucket and membership-protected API downloads.

**Current operational limit:** reliable public confirmation emails still require an email provider. Existing account sign-in and the engagement journey were verified live. See [Auth troubleshooting](docs/auth-troubleshooting.md).

### Optional AI assistance

Set `GEMINI_API_KEY` or `OPENAI_API_KEY`; model overrides are `GEMINI_MODEL` and `OPENAI_MODEL`. Review provider data-use terms before submitting confidential campaign details.

Rules remain available when AI is unconfigured or unavailable. Brief drafting reports an explicit configuration error without a provider. Template introductions are labeled; no simulated AI response is presented as a model result.

### Optional social sign-in and review administration

Configure Firebase project/web settings using the `FIREBASE_*` variables in the backend template. Enable only providers actually configured and tested. Add the deployed domain to Firebase Auth authorized domains. Existing email accounts explicitly link a social identity from their dashboard.

`CREVO_ADMIN_USER_IDS` lists existing account UUIDs allowed to review portfolio evidence. Hosted administrators also require a verified identity. Email registration alone never grants administrator access. Decisions require written review notes; the badge describes review of submitted portfolio evidence.

## Matching, trust and licensing

Rules use specialization, skills, tools, aspect ratio, content type, creative style, usage rights, trust and budget. Applicable signals are normalized to 100. Successful AI assessment contributes 30% and rules 70%; rights and evidence caps are applied afterward. AI failure retains the rules ranking.

- Scores at least 75 are strong, 50–74 possible, and below 50 weak.
- Declared rights conflicts cap fit at 49. Unknown rights or absent portfolio evidence cap it at 74.
- Structured rights compare usage types, duration, territory and exclusivity. Uncovered rights block selection.
- Trust contributes up to five rule points: three for portfolio review, one for approved engagement history and one for qualifying positive completed-project feedback.
- Documentation completeness is visible but cannot grant an independent-review badge.

A fit score is not measured recommendation accuracy. Licensing is checked against declared terms, not independently certified copyright. See [trust signals](docs/trust-signals.md) and [the data model](docs/data-model.md).

## Delivery checks and limits

The server inspects actual PNG, JPEG, WebP and MP4 bytes, up to 50 MB, for content type, requested file format, aspect ratio and video duration. Duration tolerance is ±0.5 seconds. Failed checks produce corrective guidance and no submission token. Passed checks, file hashes and metadata stay attached to the version.

Visual quality, exact colors/logos, arbitrary requirements in prose, originality and underlying tool/asset rights require human review. Style matching uses textual evidence; version comparison uses hashes and metadata rather than visual differences. Unsupported deliverable types use HTTPS links with explicit manual review.

The brief budget is USD; the project quote is separately agreed in INR. Payment processing, escrow, automatic currency conversion and revision billing are outside the current interface.

## Verify

```powershell
npm test
npm run build
cd backend
python -m pytest -q
```

Latest verification on 24 October 2026: **52 backend tests, 8 frontend tests and the production build passed**. A temporary live journey passed **19 checks**, including concurrent dashboard/inbox reads, AI-assisted matching, shortlist proposals, invitation response, agreed rights, failed and successful uploads, revision, approval, trust-history updates and private downloads. Temporary records/files were removed and the existing engagement state was preserved.

Dependency inputs live in `backend/requirements.in` and `requirements-dev.in`; their `.txt` files are hash-locked. Regenerate a reviewed runtime lock with `uv pip compile backend/requirements.in --universal --python-version 3.11 --generate-hashes -o backend/requirements.txt` and the equivalent command for the development input.

Tests use isolated SQLite data and do not call paid AI services. Actual MP4 fixtures cover ratio/duration failures. Connection regressions cover terminated upstream connections, bounded read retries, write replay prevention and session preservation.

## Deploy to Render

1. Connect this repository's branch to the Docker service described in [render.yaml](render.yaml).
2. Enter Supabase credentials and any enabled AI/Firebase settings as private environment values. The Blueprint requires Supabase for hosted operation.
3. Wait until Render reports the deployment is live, then check `/api/health`, account sign-in and the end-to-end workflow.
4. Configure Supabase/Firebase origins for the deployed HTTPS address.

The image uses digest-pinned base images, hash-locked Python runtime dependencies and a non-root user. Tests, seeding scripts, local exports and credentials are excluded from the production context. Render's container filesystem is not used for hosted persistent data.

Supabase requests use HTTP/1.1 with verified TLS, bounded connection pooling and one retry for reads. Writes are not automatically repeated after uncertain failures. Temporary upstream outages return a useful 503 response rather than an unexplained 500 or invalid-session response.

## Repository structure

```text
backend/             API, workflow rules, schema, locked dependencies and tests
backend/fixtures/    Technical MP4 files used by tests
src/                 React screens, components, styles and frontend tests
public/category-photos/  Category artwork with in-app attribution
public/portfolio/    Original Cobalt/Citrus concepts, studio marks and provenance
docs/                Workflow, architecture, security and presentation notes
Dockerfile           Frontend build and non-root FastAPI runtime
render.yaml          Existing single-service deployment definition
```

Private `.env` files, databases, operator backups, caches, QA output and presentation/video working folders are excluded from Git. Tests, lockfiles, source assets and environment templates are committed. Retired demo galleries, unused creator portraits and obsolete seeding entry points have been removed.

## Documentation and current data

- [Documentation index](docs/README.md)
- [Complete Round 1 and Round 2 workflow](docs/rounds-one-and-two-workflow.md)
- [Presentation guide](docs/demo-guide.md)
- [Project delivery and revisions](docs/project-workflow.md)
- [Trust signals and connection recovery](docs/trust-signals.md)
- [Security hardening](docs/security-hardening.md)
- [Portfolio provenance](docs/portfolio-provenance.md)

The live marketplace currently uses one curated creator and one brand. Earlier records remain disabled/archived at the owner's request. Cobalt and Citrus are original independent concepts with documented tools and workflow; no commissioned campaign, client review or independent approval is invented. `/demo` redirects to discovery, and startup never seeds live marketplace records.
