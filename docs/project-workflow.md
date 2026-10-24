# Project workflow: agreement to final delivery

Open the shared engagement from either participant's dashboard. Use separate brand and creator browser sessions.

## Agreement

1. The brand proposes an INR amount, scope, deadline/revision expectations and structured usage rights.
2. Proposed rights must cover the brief's required usage, territory, duration and exclusivity.
3. The creator chooses **Confirm scope & license**. The agreement and licensing snapshot stay attached to the project; accepted terms cannot be silently edited.

The brief's USD budget and project's INR quote are distinct. There is no automatic conversion or active payment checkout.

## Production and delivery

1. The creator posts production updates and discusses questions in the private conversation.
2. The creator uploads the actual PNG/JPEG/WebP/MP4 file. The server checks bytes, format, ratio and requested duration; a failed file receives corrective guidance before it becomes a submitted version.
3. A successful check creates a short-lived, project-bound submission token. The creator adds a title and production/handoff notes and submits version 1.
4. The brand reviews/downloads the private file, then requests changes or approves the latest version.

Other deliverable types can use an HTTPS link with explicit manual review. Technical checks do not judge visual quality, originality or the legal validity of underlying rights.

## Revisions

Brand feedback belongs to a particular submitted version. The creator chooses **Start revision**, uploads the revised work and describes changes. Revision states are requested, in progress, submitted and approved. Version 2 retains the relationship to version 1 feedback. File comparison reports changed hashes, dimensions, format or duration; it does not claim to detect visual edits.

Only the latest version awaiting review can be approved. Approval completes the project, preserves all history and blocks additional submissions. A genuine brand review becomes available after completion.

## Consistency and privacy

Every action supplies the expected `workflow_revision`. A conditional update increments it and prevents stale clients from overwriting newer state. Roles and membership come from the authenticated account. Uploaded submission tokens are purpose-, project- and audience-bound and expire after 24 hours; saved deliveries remain downloadable afterward.

Transient upstream reads retry once. Writes are not automatically replayed after uncertain failures; refresh the workspace to check the saved state before retrying an action. See [connection recovery](trust-signals.md).

For exact buttons and example files, use the [complete walkthrough](rounds-one-and-two-workflow.md).
