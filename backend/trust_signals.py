"""Public trust facts derived from marketplace records, never creator-written badges."""
from urllib.parse import urlsplit


def safe_evidence_url(value):
    parsed = urlsplit(value or '')
    return value if parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password else None


def build_trust(creator, portfolio=(), projects=(), reviews=(), requests=()):
    cid = creator['id']
    work = [p for p in portfolio if p.get('creator_id', cid) == cid and p.get('media_type') != 'gig']
    documented = [p for p in work if p.get('tools') and str(p.get('workflow') or '').strip() and str(p.get('format') or '').strip()]
    completed = {}
    for project in projects:
        workflow = project.get('workflow') or {}
        versions = workflow.get('deliveries') or []
        if (project.get('creator_id') == cid and project.get('status') == 'completed'
                and (workflow.get('terms') or {}).get('accepted_at') and versions and versions[-1].get('status') == 'approved'):
            completed[project['id']] = project
    feedback = {}
    for review in reviews:
        project = completed.get(review.get('project_id'))
        rating = review.get('rating')
        if (project and review.get('creator_id') == cid and review.get('brand_id') == project.get('brand_id')
                and isinstance(rating, int) and 1 <= rating <= 5):
            feedback.setdefault(project['id'], review)
    raw_average = sum(r['rating'] for r in feedback.values()) / len(feedback) if feedback else None
    average = round(raw_average, 1) if raw_average is not None else None
    requests = sorted([r for r in requests if r.get('creator_id') == cid], key=lambda r: str(r.get('created_at') or ''))
    reviewed = bool(creator.get('verified_at'))
    approved = next((r for r in reversed(requests) if r.get('status') == 'approved' and r.get('reviewed_at')), None)
    review_status = 'reviewed' if reviewed else 'pending' if any(r.get('status') == 'pending' for r in requests) else 'not_reviewed'
    reasons, gaps = [], []
    points = 0
    if reviewed:
        points += 3
        reasons.append('Submitted portfolio evidence reviewed by Crevo')
    else:
        gaps.append('Independent portfolio review is pending.' if review_status == 'pending' else 'No independent portfolio review yet.')
    if completed:
        points += 1
        reasons.append(f'{len(completed)} brand-approved engagement(s) completed on Crevo')
    else:
        gaps.append('No brand-approved engagement history on Crevo yet.')
    if raw_average is not None and raw_average >= 4:
        points += 1
        reasons.append(f'{average:.1f}/5 brand feedback from {len(feedback)} completed engagement(s)')
    else:
        gaps.append('No completed-project feedback rated 4/5 or higher on average.' if feedback else 'No completed-project brand feedback yet.')
    checked = sum(1 for p in completed.values() if (p['workflow']['deliveries'][-1].get('checks') or {}).get('passed') is True
                  and (p['workflow']['deliveries'][-1].get('checks') or {}).get('source') == 'server inspected uploaded bytes')
    return {
        'portfolio_review': {'status': review_status, 'reviewed_at': creator.get('verified_at'),
                             'evidence_url': safe_evidence_url(approved.get('evidence_url')) if reviewed and approved else None,
                             'scope': 'Review applies to submitted portfolio evidence; it does not verify every tool, license or future deliverable.'},
        'evidence': {'work_samples': len(work), 'documented_samples': len(documented),
                     'tools': sorted({str(t) for p in work for t in (p.get('tools') or []) if t}, key=str.casefold),
                     'source': 'Creator-provided work and workflow notes; not independent tool verification.'},
        'history': {'completed_projects': len(completed), 'checked_deliveries': checked,
                    'review_count': len(feedback), 'rating_average': average},
        'rights': {'declared': bool(creator.get('licensing')), 'source': 'Creator-declared; confirm underlying rights in the project agreement.'},
        'matching': {'points': points, 'out_of': 5, 'reasons': reasons, 'gaps': gaps},
    }
