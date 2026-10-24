"""Limit interactive fictional scenarios to the existing shared demo identities."""
import store
from matching import eligible

BRAND_EMAIL = 'brand.demo.crevo@example.com'
CREATOR_EMAIL = 'creator.demo.crevo@example.com'


def demo_creator_for_brief(brief):
    if not brief.get('title', '').startswith('[Demo]'):
        return None
    owner = store.one('users', {'id': brief['owner_id']})
    if not owner or owner['email'].lower() != BRAND_EMAIL or owner['role'] != 'brand':
        return None
    account = store.one('users', {'email': CREATOR_EMAIL})
    if not account or account['role'] != 'creator':
        return None
    creator = store.one('creators', {'owner_id': account['id']})
    return creator['id'] if creator else None


def can_match(creator, demo_creator_id=None):
    if demo_creator_id:
        return creator.get('id') == demo_creator_id and bool(creator.get('owner_id'))
    return eligible(creator)
