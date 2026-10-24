"""Create a repeatable Round 2 demo in an explicitly named local SQLite file.

Never writes to the configured Supabase project. All accounts are fictional,
sign-in-capable shared demo accounts; sample media is a technical placeholder.
"""
import argparse
import os
import shutil
from pathlib import Path
import main
import store


def seed(path):
    password = os.getenv('CREVO_LOCAL_DEMO_PASSWORD', '')
    if len(password) < 12:
        raise RuntimeError('Set CREVO_LOCAL_DEMO_PASSWORD to a private password of at least 12 characters.')
    store.REMOTE = False
    store.DB_PATH = Path(path).resolve()
    store.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    store.init_local()
    main.ensure_demo_gigs()
    license = {'usage_types': ['organic_social', 'paid_social', 'web'], 'territory': 'Worldwide', 'duration_months': 12, 'exclusive': False}
    def account(name, email, role):
        user = store.one('users', {'email': email})
        if not user:
            user = main.register(main.Register(name=name, email=email, password=password, role=role, company_name='Sola Coffee · Shared Demo' if role == 'brand' else ''))['user']
        return user
    brand = account('Sola Demo Brand', 'brand.demo.crevo@example.com', 'brand')
    people = [
        ('Maya · Round 2 demo', 'creator.demo.crevo@example.com', ['AI Filmmaking'], ['Editing', 'Storyboarding'], ['Runway', 'After Effects'], '9:16', license),
        ('Arjun · Round 2 demo', 'arjun.round2@example.com', ['AI Filmmaking'], ['Editing'], ['Runway'], '9:16', license),
        ('Nia · Round 2 demo', 'nia.round2@example.com', ['AI Filmmaking'], ['Editing', 'Storyboarding'], ['Runway'], '9:16', {**license, 'territory': 'India', 'duration_months': 3}),
        ('Sol · Round 2 demo', 'sol.round2@example.com', ['AI Photography'], [], [], '', None),
    ]
    root = Path(__file__).resolve().parents[1]
    assets = root / 'public' / 'round-two-samples'
    assets.mkdir(exist_ok=True)
    for filename in ('round2-vertical.mp4', 'round2-landscape.mp4'):
        shutil.copyfile(Path(__file__).parent / 'fixtures' / filename, assets / filename)
    for name, email, categories, skills, tools, format, terms in people:
        user = account(name, email, 'creator')
        creator = store.one('creators', {'owner_id': user['id']})
        store.update('creators', creator['id'], {'title': 'AI campaign creator · fictional shared demo', 'bio': 'A fictional shared account for the Round 2 walkthrough. Work, tool and skill claims are demo scenarios, not completed client campaigns.',
                     'categories': categories, 'skills': skills, 'platforms': ['Instagram'], 'location': 'Mumbai', 'rate': 600, 'licensing': terms})
        if tools and not store.all_rows('portfolio_items', {'creator_id': creator['id']}):
            store.insert('portfolio_items', {'creator_id': creator['id'], 'title': 'Cinematic coffee concept · format demonstration',
                         'description': 'Fictional cinematic workflow example. The playable media is a 15-second solid-color technical placeholder, not a commissioned film.',
                         'media_url': '/round-two-samples/round2-vertical.mp4', 'media_type': 'video', 'tools': tools,
                         'workflow': 'Illustrative cinematic planning, generation, editing and revision handoff.', 'format': format,
                         'commercial_use': 'Fictional declared offer for this demo account; not a license to real client work.', 'verification': 'shared demo; creator reported'})
    brief = store.one('briefs', {'owner_id': brand['id'], 'title': 'Sola Coffee / the first sip'})
    if not brief:
        brief = main.create_brief(main.BriefIn(title='Sola Coffee / the first sip', description='Create one cinematic 15-second vertical video for the launch of our new coffee brand. Show the first sip in a warm, inviting visual direction.',
                                category='AI Filmmaking', skills=['Editing', 'Storyboarding'], platforms=['Instagram'], budget=2500, location='',
                                content_type='Video', style='Cinematic', format='MP4 · 9:16', commercial_use='Worldwide organic and paid social plus website, for 12 months; non-exclusive.',
                                licensing=license, required_tools=['Runway'], duration_seconds=15, deliverables='One 15-second vertical MP4, with generation and handoff notes.', deadline='2026-11-10', revision_rounds=2), user=brand)
    print('Local demo database:', store.DB_PATH)
    print('Brief:', brief['id'])
    print('Log in locally with the shared demo email addresses and the private password you configured.')
    print('Sample media: public/round-two-samples (solid-color technical demonstrations).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, help='Explicit local SQLite file; never a remote database')
    seed(parser.parse_args().db)
