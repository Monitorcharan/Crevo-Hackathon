# Project delivery and payment demo

## What works

Open an accepted engagement from the dashboard as either participant.

1. The brand proposes a separate INR amount and scope, including usage rights, deadlines and revisions.
2. The creator accepts the proposal. Accepted terms cannot be edited.
3. The brand opens sample checkout, chooses UPI/Card/Netbanking and simulates success, failure or cancellation. Failed and cancelled attempts can be retried. A successful simulation closes the demo checkout.
4. The creator submits an HTTPS delivery link with production and handoff notes.
5. The brand requests changes with feedback. The creator submits a new numbered version; the prior version stays visible.
6. The brand approves the latest version, completing the project and enabling the existing review flow.

Payment and delivery are independent: simulated payment is not a requirement for final approval. Existing completed projects stay completed.

## Payment limits

This is a Crevo-owned Razorpay-style checkout simulation, not Razorpay Test Mode or a real integration. It requires no payment credentials, does not load Razorpay, collects no payment details, and never charges, escrows, refunds or pays out money. Every receipt and status is explicitly marked demo. It cannot be used as evidence of payment. A production gateway still needs merchant onboarding, order creation, signature validation and authenticated webhooks.

Original brief budgets are USD. They are preserved; INR project terms are independently agreed rather than converted or relabeled.

## Data model and deployment

`projects.workflow` contains the proposed/accepted terms, numbered delivery history, current simulated payment and payment-attempt history. `projects.workflow_revision` increments for each mutation. The server requires the expected revision and updates the workflow and completion status in one conditional write, preventing concurrent requests from overwriting history. Identity and role come from the authenticated participant, not request fields. Delivery versions and attempts are capped at 100 per project.

The additive columns are included in `backend/schema.sql` and have been applied to the connected crevo Supabase project. Existing project RLS and backend-only grants apply. Local SQLite receives equivalent columns during normal startup. Restart the backend after updating code. No new environment variables or payment keys are needed.

## Demo presentation

Use separate brand and creator sessions. Show revision 1, request a change, submit revision 2, and approve it. Explain that payment is a UI simulation and that delivery approval is a real persisted workflow. Do not describe it as paid escrow or a settled creator payout.

Automated tests and provider transactions were not run for this change.

## Database advisory

The existing backend-only tables have RLS enabled without direct-client policies, consistent with service-role access through authenticated API routes. The database advisor also reports the existing disabled [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this change does not modify account security settings.
