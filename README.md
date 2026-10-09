# Crevo

**Live app:** https://crevo-hackathon.onrender.com

A React and FastAPI MVP for AI creator discovery and brand collaboration. The landing page uses a five-dot wave that transforms into the CREVO wordmark. The app includes creator profiles, AI work portfolios with tools and workflows, structured briefs, skill/tool/content-type discovery, applications, explainable matching, and project messages. Brands can close briefs, decline or accept applications, and mark projects complete.

![Crevo landing page](docs/preview.png)

[Hackathon demo guide](docs/demo-guide.md) · [Challenge slides](docs/challenge-deck.pptx) · [Data model note](docs/data-model.md)

The public directory includes six explicitly labeled fictional demo creators. Their audience figures and rates are illustrative; they cannot sign in or apply to briefs. Create your own creator and brand accounts to try the full workflow.

## Run locally

Requires Node.js 20+ and Python 3.11+.

In one terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload
```

In a second terminal, from the project root:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The API is at `http://localhost:8000`, with interactive API docs at `/docs`. Local mode creates `backend/crevo.db` and six sample creator profiles on first launch. Create one brand account and one creator account to try the full workflow.

Demo path: create a creator account → complete the profile → add an AI work sample with tools and usage terms → create a brand account → publish a structured brief → review ranked matches → return as the creator and apply → accept the application as the brand → exchange project messages → mark the project complete.

## Supabase mode

1. Create a Supabase project and run [`backend/schema.sql`](backend/schema.sql) in its SQL editor.
2. Copy `backend/.env.example` to `backend/.env` and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Legacy anon and service-role variable names remain supported for existing projects.
3. Restart FastAPI. `/api/health` will report `database: supabase`.
4. Add creator accounts or data in Supabase. For a hackathon walkthrough, run `python backend/seed_demo.py` from the project root to add six clearly labeled fictional sample profiles. Their audience and rates are illustrative; they have no login accounts and cannot apply to briefs. Run the script again safely; it skips existing samples.
5. In Supabase Auth URL configuration, set your app URL as the site URL. If email confirmation is enabled, users must confirm their email before logging in.

The secret key stays in the backend only. All data mutations and reads go through FastAPI, which checks the user's role and ownership. The SQL enables RLS, revokes direct table access from browser roles, and explicitly grants the service role Data API access. Profile photo uploads use the public `portfolios` bucket created by the schema. Local mode has no storage substitute and displays an explicit upload error.

## Firebase social sign-in

Crevo supports Google, Apple, and Facebook via Firebase Authentication while retaining Supabase email/password sign-in and Supabase project data. Social buttons appear only for providers listed in `FIREBASE_AUTH_PROVIDERS` after they are configured. Existing email users sign in normally and use **Connect a sign-in method** on the dashboard before using a social button. A social account with an existing Crevo email is not linked automatically.

1. Create or select a Firebase project and register a Web app. Enable Google in Firebase Authentication. Add `crevo-hackathon.onrender.com` and `localhost` to Firebase Auth authorized domains.
2. In `backend/.env` locally and the Render service environment publicly, set `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, and `FIREBASE_APP_ID` from the Web app config. These are public web configuration values; the Supabase secret remains server only.
3. Set `FIREBASE_AUTH_PROVIDERS=google` after Google is enabled and tested. Add `facebook` only after configuring a Meta developer app ID, app secret, and Firebase OAuth redirect URI in Meta and Firebase. Add `apple` only after configuring a Sign in with Apple service ID, team ID, key ID, and private key in Apple Developer and Firebase. Keep unconfigured providers out of the list.
4. Run the idempotent `backend/schema.sql` migration for existing Supabase projects to add `public.users.firebase_uid`. Deploy the app, then test new creator and brand sign-in and linking with real accounts.

Firebase client ID tokens are verified on the server against Google's signing certificates, issuer, audience, expiry, and provider before an app user is loaded. A new Firebase user gets a matching Supabase Auth record because Crevo's existing project tables reference `auth.users`. Firebase sign-in requires a verified email from the identity provider. Google/Facebook/Apple provider setup and end-to-end OAuth testing require the corresponding external developer accounts; the UI intentionally hides providers that are not enabled.

## AI behavior

Set `GEMINI_API_KEY` or `OPENAI_API_KEY` in `backend/.env` to enable real portfolio introduction generation, AI assisted structured brief drafting, and AI assisted match assessment. Gemini takes priority when both keys are present. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; `OPENAI_MODEL` defaults to `gpt-4.1-mini`. These features use the providers' official text generation APIs. Match ranking gives 70% weight to transparent category, skill, platform, budget, and location rules and 30% to an AI assessment of the top eight candidates. If the AI service is unavailable, the rules ranking remains available. Google says free-tier Gemini content can be used to improve its products, so avoid putting confidential client details into AI drafts on the free tier. Without an AI API key, portfolio introductions are labeled template drafts, brief drafting returns an explicit configuration error, and match ranking is labeled weighted rules. No simulated AI response is presented as AI generated.

Creators can add Instagram, Facebook, X, YouTube, and Reddit profile URLs; their public profile shows clickable platform logos for saved accounts. Creators can add work samples with a media URL, AI tools/models, production workflow, output format, and commercial-use terms. Those claims are marked **creator reported**, since this MVP has no independent verification service. Briefs include content type, style, format/aspect ratio and commercial-use requirements. Media URLs must be publicly accessible; Supabase Storage currently handles profile photos only.

## Verify

```powershell
npm run build
cd backend
pytest -q
```

The tests cover Firebase identity verification and account linking, plus account creation, profile editing, AI work portfolio metadata, structured brief publishing, ranked discovery, applying, accepting, messaging, duplicate application handling, and role access. It uses an isolated local database.

**Validation status:** `npm run build` passes and `python -m pytest -q` passes (4 tests). The running frontend returns HTTP 200, and `/api/health` reports `database: supabase` when configured. A temporary live Supabase smoke test passed Auth login, profile updates, portfolio items, avatar Storage upload, briefs, matching, applications, messaging, and project completion; all temporary records and files were removed. Browser checks passed at desktop and mobile sizes, including navigation to discovery and signup. `npm audit --omit=dev` reports zero production dependency vulnerabilities. The hero uses lightweight CSS animation and does not require WebGL. The deployed Render service passed a temporary end-to-end test covering Supabase Auth, creator profiles, portfolio work and Gemini introduction generation, Storage upload, Gemini brief drafting, AI assessed matching, applications, project messages, and completion. Test accounts, records, and files were removed. A real-inbox signup, confirmation link, and login were verified by the project owner on 2026-10-09.

## Current scope

- Messages update after sending or page refresh; live subscriptions are not implemented.
- A project begins when a brand accepts an application. Milestones, payments, and file sharing are not yet part of this MVP.
- Local auth is for development. Use Supabase Auth and a strong server secret for shared deployments.
- The animated hero and logo respect reduced-motion settings and do not require WebGL.


## Public deployment

The repository includes a single-service Render Docker deployment. The container builds the Vite frontend and serves it with FastAPI from one public URL. Supabase remains the persistent database, Auth service, and avatar store; Render's free container filesystem is not used for saved data.

1. Push this folder as a public GitHub repository. Local `.env` files, build output, dependencies, and the earlier `marketplace-prototype/` are excluded from Git and Docker.
2. Import `render.yaml` as a Render Blueprint. Choose the Free web service plan. Enter `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` as private environment values. Enter `GEMINI_API_KEY` or `OPENAI_API_KEY` to enable actual AI portfolio introductions, brief drafting, and AI match assessment. Never commit or paste these values into a public page.
3. Once Render reports the service is live, set the Supabase Auth Site URL to the public `https://...onrender.com` URL. Add `http://localhost:5173/**` as an additional redirect URL if you still use local development.
4. Check `/api/health` for `database: supabase` and `ai_enabled: true` (when the AI key is set). Complete a real creator and brand signup, confirm emails, and walk through a brief, application, acceptance, and project message.

Render's Free web service spins down after idle time, so the first visit may take about a minute. Supabase's default email service is intended for testing; configure SMTP before broad public use.
