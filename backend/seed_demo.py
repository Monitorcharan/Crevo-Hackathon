"""Seed optional, explicitly labeled sample creators for a public demo."""

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')
import store  # noqa: E402

if not store.REMOTE:
    raise SystemExit('Supabase configuration is required for demo seeding')

SAMPLES = [
    ('Maya Chen', 'Visual storyteller & creative director', 'Brooklyn, NY', ['Lifestyle', 'Fashion'], ['Video', 'Art Direction', 'Photography'], ['Instagram', 'TikTok'], 128000, 1800),
    ('Jordan Rivera', 'Motion designer & 3D artist', 'Austin, TX', ['Design', 'Technology'], ['3D', 'Motion', 'Animation'], ['Instagram', 'YouTube'], 82000, 1500),
    ('Amara Okafor', 'Beauty creator & photographer', 'London, UK', ['Beauty', 'Lifestyle'], ['Photography', 'UGC', 'Video'], ['Instagram', 'TikTok'], 245000, 2300),
    ('Leo Martínez', 'Food filmmaker', 'Los Angeles, CA', ['Food', 'Lifestyle'], ['Video', 'Photography', 'Editing'], ['TikTok', 'YouTube'], 97000, 1400),
    ('Priya Shah', 'Travel writer & creator', 'Mumbai, India', ['Travel', 'Lifestyle'], ['Writing', 'Video', 'Photography'], ['Instagram', 'YouTube'], 161000, 1900),
    ('Noah Brooks', 'Culture & streetwear creator', 'New York, NY', ['Fashion', 'Culture'], ['UGC', 'Video', 'Art Direction'], ['Instagram', 'TikTok'], 114000, 1700),
]

added = 0
for name, title, location, categories, skills, platforms, audience, rate in SAMPLES:
    display_name = f'[Demo] {name}'
    if store.one('creators', {'name': display_name}):
        continue
    store.insert('creators', {
        'owner_id': None,
        'name': display_name,
        'title': title,
        'bio': 'Fictional sample profile for the Crevo hackathon. Audience and rates are illustrative. Join Crevo to publish a real profile and apply to briefs.',
        'location': location,
        'categories': categories,
        'skills': skills,
        'platforms': platforms,
        'audience': audience,
        'rate': rate,
        'avatar_url': None,
        'portfolio': '',
        'portfolio_source': 'demo',
    })
    added += 1

print(f'Added {added} demo creators')


# One original AI-generated image gives public visitors a real portfolio example.
demo_creator = store.one('creators', {'name': '[Demo] Leo Martínez'})
if demo_creator:
    title = '[Demo] Golden-hour café concept'
    existing = store.one('portfolio_items', {'creator_id': demo_creator['id'], 'title': title})
    if not existing:
        store.insert('portfolio_items', {
            'creator_id': demo_creator['id'],
            'title': title,
            'description': 'Illustrative concept artwork generated for the Crevo hackathon demo, not a real client campaign.',
            'media_url': 'https://crevo-hackathon.onrender.com/demo/cafe-concept.png',
            'media_type': 'image',
            'tools': ['OpenAI image generation'],
            'workflow': 'Prompted a café scene, reviewed the generated result, and selected this concept still for demonstration.',
            'format': '16:9 landscape',
            'commercial_use': 'Demo only; licensing for client use has not been established.',
            'verification': 'illustrative demo',
        })
        print('Added one original demo portfolio item')
