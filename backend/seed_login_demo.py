"""Create two intentionally public, shared hackathon demo accounts.

These credentials also appear in the frontend. Never use them for real users or
grant either account administrator access. Re-running preserves demo activity.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')
import store  # noqa: E402


DEMO_PASSWORD = 'CrevoDemo2026!'
DEMO_USERS = (
    ('creator.demo.crevo@example.com', 'Crevo Demo Creator', 'creator', ''),
    ('brand.demo.crevo@example.com', 'Crevo Demo Brand', 'brand', 'Crevo Demo Studio'),
)


def ensure_user(email, name, role, company_name):
    existing = store.one('users', {'email': email})
    if existing:
        if existing['name'] != name or existing['role'] != role:
            raise RuntimeError(f'Refusing to reuse an unexpected account: {email}')
        return existing

    auth_user = store.admin.auth.admin.create_user({
        'email': email, 'password': DEMO_PASSWORD, 'email_confirm': True,
    }).user
    if not auth_user:
        raise RuntimeError(f'Could not create demo Auth user: {email}')
    try:
        return store.insert('users', {
            'id': str(auth_user.id), 'email': email, 'name': name,
            'role': role, 'company_name': company_name,
        })
    except Exception:
        store.admin.auth.admin.delete_user(str(auth_user.id))
        raise


def main():
    if not store.REMOTE:
        raise SystemExit('Set the Supabase environment before seeding public demo accounts')

    creator_user = ensure_user(*DEMO_USERS[0])
    brand_user = ensure_user(*DEMO_USERS[1])
    creator = store.one('creators', {'owner_id': creator_user['id']})
    if not creator:
        creator = store.insert('creators', {
            'owner_id': creator_user['id'], 'name': '[Demo] Crevo Creator',
            'title': 'AI filmmaker & visual storyteller',
            'bio': 'Shared hackathon demo account. All work shown here is illustrative concept art, not a real client commission.',
            'location': 'Worldwide',
            'categories': ['AI Filmmaking', 'Advertising Creative', 'Product Visualization'],
            'skills': ['Creative Direction', 'Storyboarding', 'Campaign Concepts'],
            'platforms': ['Instagram', 'YouTube'], 'audience': 0, 'rate': 250,
            'avatar_url': None, 'portfolio_source': 'manual',
            'portfolio': 'I turn early campaign ideas into visual directions using AI and traditional editing tools. This shared profile demonstrates how a creator can explain tools, workflow, formats, and usage terms on Crevo. The artwork is illustrative.',
        })
    if not any(item['title'] == '[Demo] After Dark launch concept' for item in store.all_rows('portfolio_items', {'creator_id': creator['id']})):
        store.insert('portfolio_items', {
            'creator_id': creator['id'], 'title': '[Demo] After Dark launch concept',
            'description': 'Illustrative campaign keyframe for an imaginary automotive launch. No real client work or license is represented.',
            'media_url': 'https://crevo-hackathon.onrender.com/demo/night-drive.png',
            'media_type': 'image', 'tools': ['OpenAI image generation'],
            'workflow': 'Developed a fictional launch concept, generated a dusk city scene, and selected a final keyframe direction.',
            'format': '16:9 campaign keyframe',
            'commercial_use': 'Demo only. No real client commercial license is represented.',
            'verification': 'illustrative demo',
        })

    if not any(brief['title'] == '[Demo] Launch film for a new café' for brief in store.all_rows('briefs', {'owner_id': brand_user['id']})):
        store.insert('briefs', {
            'owner_id': brand_user['id'], 'title': '[Demo] Launch film for a new café',
            'description': 'Create a 15-second vertical launch film showing the café space, signature drinks, and the people behind it. This is an illustrative brief for the shared Crevo demo accounts.',
            'category': 'AI Filmmaking', 'skills': ['Creative Direction', 'Storyboarding'],
            'platforms': ['Instagram'], 'budget': 1200, 'location': 'Remote',
            'content_type': 'Short-form video', 'style': 'Warm, cinematic, welcoming',
            'format': '9:16 vertical, 15 seconds',
            'commercial_use': 'Brand social media and paid ads; terms to be agreed before production.',
            'status': 'open',
        })
    print('Two shared demo accounts and sample creator/brand content are ready.')


if __name__ == '__main__':
    main()
