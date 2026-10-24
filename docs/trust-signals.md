# Trust signals and connection recovery

## Public creator evidence

`GET /api/creators/{id}/trust` returns a deliberately limited summary of existing records:

- Portfolio review: not reviewed, pending or reviewed; review date and the approved public evidence link where available.
- Documentation: work samples with declared tools, workflow notes and output format. Service listings are excluded.
- Engagement history: projects with accepted scope and a brand-approved final version. An arbitrary completed status is insufficient.
- Technical delivery history: final files inspected by the server and approved by the brand.
- Brand feedback: one review per qualifying completed engagement, written by that project's brand. New creators have no rating.
- Rights: explicitly creator-declared, with project-specific agreement still required.

The response excludes private account/project identifiers, contact addresses, review notes and verification statements. Archived creators return 404. A text label such as “verified” on a portfolio item cannot grant independent review status.

The creator profile, comparison view and match explanation show these distinctions. The badge says “Portfolio evidence reviewed” and explains its scope. The current Crevo Studio request remains pending; no approval, project history or review is fabricated.

## Matching contribution

Trust contributes up to five rule points:

- Three for a recorded portfolio evidence review.
- One for brand-approved completed engagement history.
- One for completed-project feedback averaging at least 4/5 before display rounding.

Documentation completeness is shown separately and cannot create verification points. Normalization and the existing licensing/evidence caps still apply. The AI assessment receives the same trust summary and its limitations.

## Review process

A verification request needs a real portfolio sample with tools, workflow and format. Administrators inspect the work, compare its declared process and record the review's scope/limits. Every approval or rejection requires a saved note of at least 20 characters. Notes are visible to the creator, while public responses expose only the limited review summary.

## Reported 500 errors

Render logs on 24 October 2026 showed `httpx.RemoteProtocolError` caused by terminated shared HTTP/2 connections to Supabase. Affected requests included notifications, brief candidates, inbox threads and project reads.

The shared Supabase client now uses HTTP/1.1 with TLS verification, bounded connections and short idle connection lifetimes. GET/HEAD requests retry once after a transient connection/protocol failure, including interrupted response-body reads. POST/PATCH/PUT/DELETE requests are never automatically replayed because the server may already have saved the action.

An exhausted upstream connection failure produces a clear 503 response. Temporary Auth transport/service failures also produce 503, preserving the user's session rather than incorrectly returning 401. Per-request email Auth clients close their connections after use. Rate-limit storage still fails closed.

Regression tests cover recovery, bounded retries, write protection, session preservation, privacy, real engagement/feedback counts and verification requirements. No schema migration or fabricated production data is needed.
