# Crevo Round 2 demonstration

## What improved since Round 1

- Compare two or three creators using published tools, skills, formats, workflow notes and commercial-use statements. Missing metadata stays labeled; no invented rating or compatibility claim.
- Brief readiness checks twelve details. New briefs collect explicit deliverables, a target date and included revision rounds. Existing briefs remain readable with unspecified fields clearly labeled.
- Hiring suggestions exclude fictional demo and unowned profiles. Public guest matching remains illustrative.
- Acceptance and project creation now run as a single database transaction. Repeated acceptance returns the existing project. Decline and acceptance serialize on the same application.
- Creator delivery versions, brand revision requests and exact-version final approval persist in the shared workspace. Conditional revision writes prevent lost updates.
- INR payment simulation includes failure, cancellation, success and attempt history. It never moves money or collects payment credentials.
- Restored the three missing original portfolio illustrations.

## Five-minute demo

1. **0:00–0:40 — Need and discovery.** Explain why brands need tools, process and rights alongside creative work. Filter the directory and compare two creators. Clearly identify fictional samples.
2. **0:40–1:30 — A complete brief.** Use an ordinary brand account. Start with a rough idea, optionally draft with AI, then review every suggested field. Add deliverables, date, revisions and commercial-use needs. Show the readiness checklist.
3. **1:30–2:15 — Engagement.** In a separate creator session, apply with a concrete approach. The brand accepts and opens the project, proposes INR terms, and the creator accepts them.
4. **2:15–3:45 — Delivery.** The creator submits an HTTPS link with notes. Brand requests a change. Creator submits version 2. Brand approves it. Point to the retained history and enabled project review.
5. **3:45–4:20 — Payment demo.** Using the terms agreed earlier, simulate a failure, then success. State: this is a keyless simulation, not Razorpay Test Mode, escrow, or payout.
6. **4:20–5:00 — Technical depth.** Explain authentication and project membership, database transactions, optimistic concurrency and the AI fallback. Close with the strongest remaining gaps.

Use clearly named demo engagements or consenting team accounts. Do not modify unrelated users' projects. Never show secrets, private messages or personal account details to judges.

## Jury questions

**Where is AI useful?** Drafting structured brief fields from supplied ideas and assisting matching when configured. Brands still review the draft. Guest matching is weighted rules, not an AI prediction.

**What prevents unauthorized approvals?** Authenticated API membership checks and brand-only review actions. The server checks the latest delivery version and expected workflow revision.

**How do you avoid duplicate projects?** The acceptance transaction locks the application and uses the existing unique brief/creator constraint. Existing accepted projects are returned on retry.

**What does verified mean?** Manual portfolio-evidence review, not automatic proof of every model, identity or commercial license.

**What is still a prototype?** Payment settlement, large-scale portfolio storage/streaming and independent license verification. Do not promise proven scale or real revenue.

## Data model additions

`briefs.deliverables` is text, `deadline` is an optional date for legacy compatibility, and `revision_rounds` is a nullable integer from 0–20. The frontend requires them on new briefs. `projects.workflow` retains accepted INR terms, deliveries and simulated payment history. `workflow_revision` supports a conditional update. `transition_application` is executable only by the service role and uses invoker security.

Existing marketplace budgets remain USD. INR project terms are a separate agreement; no silent conversion occurs.

## Deployment

Existing service: https://crevo-hackathon.onrender.com/ . Render deploys pushes to the repository's main branch automatically. Schema changes are additive and included in backend/schema.sql. Do not expose backend secrets to the frontend. Confirm the deployment reaches live before relying on the updated UI.

## Remaining priorities

Obtain substantial playable portfolio examples with creator consent and accurate production notes. Improve verification granularity. Replace payment simulation only after merchant setup and a secure real gateway integration. Keep one reliable demonstration path ready for October 24–25 evaluation.
