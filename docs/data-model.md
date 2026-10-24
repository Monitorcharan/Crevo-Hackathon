# Crevo data model

Supabase Auth stores hosted identities. PostgreSQL stores marketplace records. FastAPI verifies identity, role and ownership before private reads and writes. Local tests use equivalent SQLite records.

## Accounts and discovery

- `users`: Auth UUID, role, name, company name/logo, optional linked Firebase UID and `disabled_at`.
- `creators`: one profile per creator account, categories, skills, platforms, rate, avatar, introduction, optional social/contact fields, structured offered licensing, `verified_at` and `archived_at`.
- `portfolio_items`: work media, type, tools/models, workflow, format, commercial-use description and creator-reported verification label. The `gig` media type represents a service offer and does not count as portfolio work evidence.
- `briefs`: brand owner, description, category, skills, content/style/format, tools, duration, deliverables, deadline, revision allowance, USD budget, structured required licensing, open/closed status and archive state.

## Engagement and collaboration

- `brief_candidates`: one creator per brief, proposal/shortlist/invitation state, source, actor/timestamp activity history and optional private contact thread.
- `applications`: creator proposal or accepted invitation, pending/accepted/declined status and a unique brief/creator pair.
- `contact_threads` and `contact_messages`: private pre-selection discussion between the brand and creator.
- `projects`: selected brief, creator and brand; project status; workflow JSON; optimistic `workflow_revision` counter. A unique brief/creator pair prevents duplicate engagements.
- `messages`: private project conversation.

The project workflow retains the selected requirements and offered-rights snapshot, proposed/accepted scope and INR quote, confirmed licensing snapshot, production updates, versioned deliveries, technical checks, feedback, revision state and activity timeline. Historical simulation fields can remain in old records; the live interface has no payment checkout.

## Trust and operation

- `reviews`: one brand review per completed project, with rating and written feedback.
- `verification_requests`: submitted public evidence URL, creator statement, pending/approved/rejected status, decision note, reviewer and review timestamp.
- `request_limits`: persistent atomic quota counters. Browser roles cannot consume the quota RPC directly.
- Notifications are derived from applications, invitations, conversations, workflow events and review decisions. Read state is saved on the device.
- Public trust summaries are derived from portfolio documentation, review status, accepted-and-approved projects and qualifying brand reviews. Private IDs, verification statements and decision notes are excluded.

## Files and access

Public profile images use Supabase Storage's `portfolios` bucket. Public portfolio samples have accessible media URLs. Project uploads use the private `crevo-deliveries` bucket; only project members can download them through the API. Local development stores checked deliveries beside its selected SQLite database.

Hosted tables have RLS enabled, direct browser access revoked and server-role access granted. Public creator responses omit account owner UUIDs and opted-in email addresses. Disabled accounts cannot sign in or refresh; archived creators/briefs are excluded by the shared data-access layer.

See [schema.sql](../backend/schema.sql), [workflow](project-workflow.md), [trust signals](trust-signals.md) and [security](security-hardening.md).
