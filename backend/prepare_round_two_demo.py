"""Upgrade only the existing shared demo accounts; preserve real member data.

Dry run by default. Pass --apply to save the fictional demo offer, a technical
work sample, and a new brief. No Auth account is created and no email is sent.
"""
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
import store
from demo_accounts import BRAND_EMAIL, CREATOR_EMAIL

BRIEF_TITLE = '[Demo] Round 2 / Cafe launch walkthrough'
WORK_TITLE = '[Demo] Vertical delivery / technical workflow sample'
TERMS = {'usage_types': ['organic_social', 'paid_social', 'web'], 'territory': 'Worldwide', 'duration_months': 12, 'exclusive': False}


def prepare(apply=False):
    brand = store.one('users', {'email': BRAND_EMAIL})
    user = store.one('users', {'email': CREATOR_EMAIL})
    if not brand or brand['role'] != 'brand' or not user or user['role'] != 'creator':
        raise RuntimeError('Existing shared demo identities are required. No real accounts will be reused.')
    creator = store.one('creators', {'owner_id': user['id']})
    if not creator or not (creator['name'].startswith('[Demo]') or creator['name'] == 'Crevo Demo Creator'):
        raise RuntimeError('Expected the existing labeled shared demo profile; refusing to change another profile.')
    planned = []
    if not creator.get('licensing'):
        planned.append('Add a fictional usage-rights offer to the shared creator')
        if apply:
            store.update('creators', creator['id'], {'licensing': TERMS})
    if not store.one('portfolio_items', {'creator_id': creator['id'], 'title': WORK_TITLE}):
        planned.append('Add one labeled technical video sample to the shared creator')
        if apply:
            store.insert('portfolio_items', {
                'creator_id': creator['id'], 'title': WORK_TITLE,
                'description': 'Fictional shared-account walkthrough. A 15-second solid-color video tests vertical delivery and revisions; this is not creative campaign evidence.',
                'media_url': 'https://crevo-hackathon.onrender.com/round-two-samples/round2-vertical.mp4',
                'media_type': 'video', 'tools': ['Technical MP4 fixture'],
                'workflow': 'Technical demonstration of a vertical video export, production handoff, review and revised delivery. Creative direction and storyboarding are fictional scenario metadata.',
                'format': 'MP4 · 9:16', 'commercial_use': 'Fictional demo offer: worldwide organic/paid social and website use for 12 months, non-exclusive. No real client rights are represented.',
                'verification': 'shared demo; technical placeholder',
            })
    brief = store.one('briefs', {'owner_id': brand['id'], 'title': BRIEF_TITLE})
    if not brief:
        planned.append('Create a new open Round 2 brief for the shared brand; keep the older closed brief unchanged')
        if apply:
            brief = store.insert('briefs', {
                'owner_id': brand['id'], 'title': BRIEF_TITLE,
                'description': 'Fictional shared-account test: create one 15-second vertical cafe launch video. Use the technical sample to try matching, invitations, agreed usage rights, file checks, revisions and approval. This is not a real commission.',
                'category': 'AI Filmmaking', 'skills': ['Creative Direction', 'Storyboarding'], 'platforms': ['Instagram'],
                'budget': 1200, 'location': '', 'content_type': 'Video', 'style': 'Minimal vertical video',
                'format': 'MP4 · 9:16', 'duration_seconds': 15, 'required_tools': [],
                'deliverables': 'One 15-second vertical MP4 and production notes, using labeled technical test media.',
                'deadline': (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat(),
                'revision_rounds': 2, 'commercial_use': 'Fictional demo requirement: worldwide organic/paid social and website use for 12 months, non-exclusive.',
                'licensing': TERMS, 'status': 'open',
            })
    print(('Applied' if apply else 'Planned') + ': ' + ('; '.join(planned) if planned else 'Shared demo already prepared; no changes'))
    if brief:
        print('Demo brief: /briefs/' + brief['id'])
    return brief


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    prepare(parser.parse_args().apply)
