# Crevo security hardening — 24 October 2026

This update addresses the six reported findings. It preserves existing marketplace data and Round 2 engagements.

## Authentication and signing

Known development signing keys are rejected for local authentication. Private local development without a configured key uses a process-random key, so restarting the server signs out local sessions. Shared local deployments require a fresh random `LOCAL_JWT_SECRET` of at least 32 characters. Hosted Supabase deployments authenticate Supabase or verified Firebase identities; they do not accept local session tokens.

Delivery upload tokens use a separate purpose-derived key based on the server-only Supabase credential, or an explicit strong `ASSET_SIGNING_SECRET`. Tokens include their audience, purpose, project and expiry. Previously issued, unsubmitted upload tokens must be replaced by uploading the file again after this deployment. Saved deliveries remain intact.

## Public profile privacy

Public creator responses use a field allowlist and exclude contact email and Auth owner ID, including creators nested in gig responses. Public reviews exclude reviewer Auth IDs. Signed-in brands can fetch an optional creator contact email through a separate endpoint, limited to 30 requests per account per hour. Creators choose whether to provide that email; in-platform contact remains available.

## Administrator identity and signup

`CREVO_ADMIN_EMAILS` no longer grants privileges. Configure `CREVO_ADMIN_USER_IDS` with comma-separated UUIDs of existing, trusted accounts using server environment settings. Hosted administrators must additionally prove a verified identity with the same email as their account record. Registering an administrator's email cannot grant administrator access.

New pending email signups retain validated profile data in Supabase Auth metadata and create no public marketplace account until the email is verified and the member signs in. Supabase email confirmation remains enabled. Existing account records are preserved. Email delivery still needs an SMTP provider for reliable production signup; confirmation is not bypassed by this update.

## Shared demonstration identities

Both previously public hosted demo passwords have been replaced with private random values, both identities are banned, and their Auth sessions were revoked. The backend also rejects these identities on login, refresh and authenticated requests. Their marketplace records remain intact.

The frontend contains no shared demo password or shared sign-in buttons. `/demo` now redirects to discovery after the later curated marketplace update. Local interactive demos require an operator-chosen private password of at least 12 characters and use a separate SQLite database. Hosted shared-account seeding is disabled.

## Persistent request limits

Hosted quotas use an atomic, server-only PostgreSQL RPC and survive process restarts and multiple instances. Local quotas use atomic SQLite updates. Database failures reject quota-controlled actions with HTTP 503; exceeded limits return HTTP 429 and `Retry-After`. Identifiers are hashed before storage and expired buckets are removed.

- Signup: 12 attempts per IP per 10 minutes and 5 per email per hour.
- Login: 40 attempts per IP per 5 minutes and 10 per email per 10 minutes.
- Refresh: 120 attempts per IP per 5 minutes.
- All authentication actions together: 1,000 attempts per 10 minutes across the service.
- AI actions together: 6 per account per minute, 30 per account per hour and 120 per service per hour. The same budgets cover chat, portfolio drafting, brief drafting, recommendations and the shortlist assistant.
- Contact email retrieval: 30 per brand account per hour.

Outside Render, client IP comes from the socket, ignoring forwarding headers. On Render, the rightmost forwarding entry supplied at managed ingress is used. Account, email and global quotas apply independently of IP grouping. Deployments behind a different proxy must configure and test their ingress trust before changing this logic. These fixed-window limits constrain request counts, not an exact monetary budget.

Apply the additive quota migration in `backend/schema.sql` when upgrading another installation. The table has RLS enabled, browser roles have no table or RPC access, and only the backend service role can consume quotas.

## Production container

The final image runs as UID/GID 10001 with no login shell. Node 24 and Python 3.11 base images are pinned by digest. All direct and transitive Python production dependencies are pinned with hashes and installed using `--require-hashes`. Pytest and local seed/test files are excluded from production. Development dependencies have a separate lock file.

Review pinned packages and image digests when applying future security updates. Regenerate locks with `uv pip compile` as documented in the README. `/api/health` reports this security revision, whether the Linux process runs without root, and whether persistent request limits and local sessions are enabled.

## Verification

Regression coverage includes token-key separation, verified administrator identity, pending signup isolation, verified profile creation, public privacy, protected contact email access, atomic concurrent quotas, pre-authentication throttling, shared AI quotas, failure-closed storage handling and disabled hosted demos. Existing marketplace and delivery tests remain part of the same backend suite. Frontend tests and a production build are also run before deployment.
