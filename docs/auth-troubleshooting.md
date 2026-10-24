# Signup and session troubleshooting

## Findings from 24 October 2026

The earlier signup investigation confirmed that application profiles could be created and the backend service role could access users and creators. That investigation preceded the curated-account cleanup; its account counts are not a current inventory. The live marketplace now keeps one active creator and one active brand, with earlier identities disabled rather than deleted.

The Auth logs showed six signup failures with `over_email_send_rate_limit` and four with `email_address_invalid`. Email signup was enabled, new registrations were allowed, and email confirmation was required. These failures occurred in Auth before application profile creation. They were hidden by the previous generic configuration-error message.

The live API uses a relative `/api` origin, so devices visiting the Render URL use the hosted backend. A device does not need access to the developer's localhost. Auth also logged expired JWTs; the previous frontend saved only access tokens and could not renew sessions.

## Application fixes

- Translate provider error codes into specific, safe messages and appropriate status codes. Preserve email verification and distinguish unconfirmed login from invalid credentials.
- Log only operation, provider code, and exception type; never credentials, tokens, addresses, or raw provider messages.
- Use request-specific public Auth clients without SDK persistence or automatic background renewal.
- Return session expiry and refresh tokens on successful hosted login. Renew sessions in the frontend, share concurrent renewal, coordinate across tabs when Web Locks are available, and retry an unauthorized request once.
- Clear invalid sessions and notify the interface. Preserve credentials through temporary provider failures. A late renewal must not restore a logged-out account.
- Do not let an old session block a new signup or login.
- Request confirmation redirects to the trusted `PUBLIC_APP_URL` or Render's `RENDER_EXTERNAL_URL`, followed by `/login`. The corresponding URL must be allowed in Supabase.

## Email configuration still required

Supabase's built-in email sender restricts recipients and has a small project-wide quota. The owner confirmed that no custom email provider is configured yet. Code changes cannot remove that provider restriction.

1. Choose an SMTP provider and configure its verified sender or domain.
2. Enter its SMTP host, port, username, password, sender address, and sender name in the Supabase Auth email configuration. Keep credentials out of source control and chat.
3. Keep email confirmation enabled.
4. In [Auth URL configuration](https://supabase.com/dashboard/project/fzaumqvuoqbcawnabjus/auth/url-configuration), set the Site URL to `https://crevo-hackathon.onrender.com` and allow `https://crevo-hackathon.onrender.com/login`.
5. Test an actual new inbox: signup, receive the email, confirm on another device, then log in.

See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) and [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).

Google is enabled in the live Firebase sign-in configuration and uses a separate identity-provider flow. New users can choose a role on Join and use Continue with Google. Existing email users should log in normally and connect Google from the dashboard; identity linking is deliberate.

## Verification

Run `npm test`, `npm run build`, and `python -m pytest -q` from backend. Hosted verification should check login, refresh, account isolation, and safe provider errors. A successful admin-created test identity does not prove public confirmation-email delivery works.

## Intermittent connection errors

Terminated shared HTTP/2 connections caused intermittent 500 responses on notifications, inbox and project reads. The backend now uses HTTP/1.1 with bounded pooling and one read retry. Temporary Auth outages preserve sessions; uncertain writes are never automatically repeated. See [trust signals and connection recovery](trust-signals.md).
