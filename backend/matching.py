"""Evidence-based matching and deterministic commercial-use comparisons."""
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class LicenseTerms(BaseModel):
    usage_types: list[Literal['organic_social', 'paid_social', 'web', 'broadcast', 'print']] = Field(min_length=1, max_length=5)
    territory: str = Field(min_length=2, max_length=100)
    duration_months: int = Field(ge=0, le=1200)  # Zero explicitly means perpetual.
    exclusive: bool = False

    @field_validator('territory')
    @classmethod
    def clean_territory(cls, value):
        if len(value.strip()) < 2:
            raise ValueError('Enter Worldwide or one or more countries.')
        return value.strip()


def license_check(required, offered):
    if not required or not offered:
        return {'status': 'unconfirmed', 'issues': ['Structured usage rights must be confirmed with the creator.']}
    issues = []
    missing = sorted(set(required['usage_types']) - set(offered['usage_types']))
    if missing:
        issues.append('Usage not offered: ' + ', '.join(x.replace('_', ' ') for x in missing))
    territories = lambda value: {x.strip().casefold() for x in value.split(',') if x.strip()}
    if offered['territory'].strip().casefold() != 'worldwide' and not territories(required['territory']).issubset(territories(offered['territory'])):
        issues.append(f"Territory: needs {required['territory']}; creator offers {offered['territory']}.")
    if offered['duration_months'] != 0 and (required['duration_months'] == 0 or offered['duration_months'] < required['duration_months']):
        issues.append(f"Duration: needs {required['duration_months'] or 'perpetual'} months; creator offers {offered['duration_months']}.")
    if required.get('exclusive') and not offered.get('exclusive'):
        issues.append('Exclusive rights are required but not offered.')
    return {'status': 'mismatch' if issues else 'compatible', 'issues': issues}


def ratios(value):
    return re.findall(r'\b\d+\s*:\s*\d+\b', (value or '').replace(' ', ''))


def words(value):
    return set(re.findall(r'[a-z0-9]+', (value or '').lower())) - {'a', 'an', 'the', 'and', 'for', 'with', 'of', 'to', 'ai'}


def brief_conflicts(brief):
    content = (brief.get('content_type') or '').lower()
    format = (brief.get('format') or '').lower()
    image = any(x in content for x in ('image', 'photo', 'still'))
    video = any(x in content for x in ('video', 'film', 'motion', 'animation'))
    issues = []
    if image and not video and brief.get('duration_seconds'):
        issues.append('A still-image brief cannot require video duration. Choose video or clear the duration.')
    if image and not video and 'mp4' in format:
        issues.append('The content type requests a still image but the output format requests MP4 video.')
    if video and any(x in format for x in ('jpg', 'jpeg', 'png', 'webp')):
        issues.append('The content type requests video but the output format requests a still image.')
    return issues


def eligible(creator):
    return bool(creator.get('owner_id')) and creator.get('portfolio_source') != 'demo' and not creator.get('name', '').lower().startswith('[demo]') and creator.get('name') != 'Crevo Demo Creator'


def profile_readiness(creator, portfolio):
    """Existing members keep their data; missing evidence is an owner setup task."""
    work = [item for item in portfolio if item.get('media_type') != 'gig']
    rights = False
    if creator.get('licensing'):
        try:
            LicenseTerms.model_validate(creator['licensing'])
            rights = True
        except ValueError:
            pass
    checks = [
        {'key': 'categories', 'label': 'Choose your creative categories', 'complete': bool(creator.get('categories')), 'href': '/profile/edit'},
        {'key': 'skills', 'label': 'Add the skills you can demonstrate', 'complete': bool(creator.get('skills')), 'href': '/profile/edit'},
        {'key': 'portfolio', 'label': 'Add an AI work sample with tools, workflow and format', 'complete': bool(work), 'href': '/portfolio/edit'},
        {'key': 'workflow', 'label': 'Describe the tools, workflow and output format on your samples', 'complete': any(item.get('tools') and item.get('workflow') and item.get('format') for item in work), 'href': '/portfolio/edit'},
        {'key': 'licensing', 'label': 'Confirm the usage rights you can offer', 'complete': rights, 'href': '/profile/edit'},
    ]
    return {'checks': checks, 'work_samples': len(work), 'ready': all(item['complete'] for item in checks)}


def score_match(creator, brief, portfolio):
    portfolio = [p for p in portfolio if p.get('media_type') != 'gig']
    factors, weaknesses, breakdown, evidence = [], [], [], []
    def signal(name, weight, fit, reason, gap):
        breakdown.append({'signal': name, 'weight': weight, 'points': round(weight * fit, 1)})
        if fit > 0:
            factors.append(reason)
        if fit < 1:
            weaknesses.append(gap)

    signal('Specialization', 15, int(brief.get('category', '').casefold() in [x.casefold() for x in creator.get('categories', [])]),
           'Specializes in ' + brief.get('category', ''), 'Category specialization is not demonstrated.')
    wanted = [x.casefold() for x in brief.get('skills', [])]
    shown = {x.casefold() for x in creator.get('skills', [])}
    if wanted:
        hits = set(wanted) & shown
        signal('Skills', 15, len(hits) / len(wanted), 'Shared skills: ' + ', '.join(sorted(hits)), 'Missing skills: ' + ', '.join(sorted(set(wanted) - shown)))
    tools = {x.casefold() for p in portfolio for x in p.get('tools', [])}
    required_tools = {x.casefold() for x in brief.get('required_tools', [])}
    if required_tools:
        hits = required_tools & tools
        signal('AI tools', 10, len(hits) / len(required_tools), 'Portfolio uses ' + ', '.join(sorted(hits)), 'No portfolio evidence for tools: ' + ', '.join(sorted(required_tools - tools)))
    target_ratios = ratios(brief.get('format'))
    if target_ratios:
        hit = any(set(target_ratios) & set(ratios(p.get('format'))) for p in portfolio)
        signal('Aspect ratio', 15, int(hit), 'Portfolio includes ' + ', '.join(target_ratios) + ' work', 'Required aspect ratio is not shown in the portfolio.')
    content_words = words(brief.get('content_type'))
    if content_words:
        def content_fit(p):
            text = words(' '.join(str(p.get(k, '')) for k in ('title', 'description', 'media_type', 'format')))
            return bool(content_words & text) or ('video' in content_words and bool(text & {'film', 'filmmaking', 'motion'}))
        signal('Content type', 10, int(any(content_fit(p) for p in portfolio)), 'Portfolio demonstrates the requested content type', 'Requested content type has no portfolio evidence.')
    style_words = words(brief.get('style'))
    if style_words:
        hits = set().union(*(words(' '.join(str(p.get(k, '')) for k in ('title', 'description', 'workflow'))) for p in portfolio)) & style_words
        signal('Creative style', 10, min(1, len(hits) / len(style_words)), 'Portfolio style evidence: ' + ', '.join(sorted(hits)), 'Some visual direction needs discussion; text evidence is incomplete.')
    check = license_check(brief.get('licensing'), creator.get('licensing'))
    signal('Usage rights', 15, int(check['status'] == 'compatible'), 'Declared usage rights cover this brief', '; '.join(check['issues']))
    signal('Trust', 5, int(bool(creator.get('verified_at'))), 'Portfolio evidence reviewed by Crevo', 'Portfolio and tool claims remain creator reported.')
    if brief.get('budget', 0):
        rate = creator.get('rate', 0)
        signal('Budget', 5, int(0 < rate <= brief['budget']), 'Starting rate fits the budget', 'Starting rate is unknown or exceeds the budget; confirm the project quote.')
    for p in portfolio:
        overlap = len(words(' '.join(str(p.get(k, '')) for k in ('title', 'description', 'workflow', 'format'))) & words(' '.join(brief.get(k, '') for k in ('description', 'style', 'content_type', 'format'))))
        if overlap:
            evidence.append({'id': p['id'], 'title': p['title'], 'media_url': p['media_url'], 'format': p.get('format', ''), 'tools': p.get('tools', []), 'overlap': overlap})
    if not portfolio:
        weaknesses.append('No work samples yet. Request relevant examples before selecting.')
    total = sum(x['weight'] for x in breakdown)
    score = round(100 * sum(x['points'] for x in breakdown) / max(1, total))
    conflicts = brief_conflicts(brief)
    result = {'creator': creator, 'score': score, 'factors': factors, 'weaknesses': conflicts + weaknesses, 'conflicts': conflicts, 'portfolio_count': len(portfolio),
              'breakdown': breakdown, 'licensing': check, 'evidence': sorted(evidence, key=lambda p: -p['overlap'])[:3],
              'method': 'portfolio evidence + weighted rules', 'ai_reason': None}
    return finalize_match(result)


def finalize_match(result):
    cap = 49 if result['licensing']['status'] == 'mismatch' else 74 if result['licensing']['status'] == 'unconfirmed' else 100
    if result.get('conflicts'):
        cap = min(cap, 49)
    if result.get('portfolio_count') == 0:
        cap = min(cap, 74)
    result['score'] = min(result['score'], cap)
    result['strength'] = 'strong' if result['score'] >= 75 else 'possible' if result['score'] >= 50 else 'weak'
    return result
