"""Replace only unowned fictional Crevo demos with fresh, clearly labeled samples.

Real creator accounts, their portfolios, and completed project reviews are never edited.
Run with backend Supabase environment configured.
"""

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')
import store  # noqa: E402

if not store.REMOTE:
    raise SystemExit('Supabase configuration is required for public demo seeding')

BASE = 'https://crevo-hackathon.onrender.com/demo'
SAMPLES = [
    {
        'name': '[Demo] Aria Vale', 'title': 'AI filmmaker & campaign director',
        'bio': 'Fictional Crevo demo profile. The visual below is original AI-generated concept art, not a real client project or a claim about a real creator.',
        'location': 'Creative studio · worldwide',
        'categories': ['AI Filmmaking', 'Advertising Creative', 'Product Visualization'],
        'skills': ['Creative Direction', 'Storyboarding', 'Campaign Concepts'],
        'platforms': ['Instagram', 'YouTube'], 'image': 'night-drive.png',
        'work_title': 'After Dark / launch film concept',
        'work_description': 'Illustrative automotive campaign keyframe created for the Crevo demo. No real brand or creator engagement is represented.',
        'workflow': 'Generated a fictional city-at-dusk automotive scene, then selected a final visual direction for this static concept.',
        'format': '16:9 campaign keyframe',
    },
    {
        'name': '[Demo] Kian Mercer', 'title': '3D motion & generative artist',
        'bio': 'Fictional Crevo demo profile featuring an original AI-generated motion-design still. This is an illustrative sample, not a completed client project.',
        'location': 'Creative studio · worldwide',
        'categories': ['Motion Design', '3D & CGI', 'Generative Art'],
        'skills': ['3D Art Direction', 'Material Studies', 'Motion Concepts'],
        'platforms': ['Instagram', 'YouTube'], 'image': 'glass-motion.png',
        'work_title': 'Glass Orbit / motion concept',
        'work_description': 'Illustrative glass-and-light visual study for the Crevo demo. It is a static concept image, not an animated deliverable.',
        'workflow': 'Generated a sculptural glass and light composition as a possible keyframe for a fictional motion sequence.',
        'format': '16:9 motion keyframe',
    },
    {
        'name': '[Demo] Solana Park', 'title': 'AI product & beauty visual artist',
        'bio': 'Fictional Crevo demo profile with original AI-generated product imagery. The brand and product are imaginary.',
        'location': 'Creative studio · worldwide',
        'categories': ['Beauty', 'AI Photography', 'Product Visualization'],
        'skills': ['Product Imagery', 'Still Life', 'Art Direction'],
        'platforms': ['Instagram', 'TikTok'], 'image': 'skincare-still.png',
        'work_title': 'Soft Light / skincare still life',
        'work_description': 'Illustrative beauty product concept with an unbranded fictional bottle, made for the Crevo demo.',
        'workflow': 'Generated an unbranded skincare still life with warm paper forms and selected the final composition.',
        'format': '16:9 product image',
    },
    {
        'name': '[Demo] Niko Lane', 'title': 'Fashion editorial & social creator',
        'bio': 'Fictional Crevo demo profile showing original AI-generated fashion concept art. No real campaign or model booking is represented.',
        'location': 'Creative studio · worldwide',
        'categories': ['Fashion', 'Social Media Content', 'AI Photography'],
        'skills': ['Fashion Concepts', 'Editorial Imagery', 'Social Campaigns'],
        'platforms': ['Instagram', 'TikTok'], 'image': 'fashion-editorial.png',
        'work_title': 'Electric Blue / fashion editorial',
        'work_description': 'Illustrative fashion campaign concept created for the Crevo demo, not commissioned client work.',
        'workflow': 'Generated a fictional studio fashion scene with geometric color blocking and selected the final frame.',
        'format': '16:9 editorial image',
    },
]

new_names = {sample['name'] for sample in SAMPLES}
removed = 0
for creator in store.all_rows('creators'):
    if creator.get('owner_id') is not None or creator.get('portfolio_source') != 'demo' or creator['name'] in new_names:
        continue
    if store.one('projects', {'creator_id': creator['id']}) or store.one('applications', {'creator_id': creator['id']}):
        print(f"Kept referenced legacy demo: {creator['name']}")
        continue
    store.admin.table('creators').delete().eq('id', creator['id']).execute()
    removed += 1

for sample in SAMPLES:
    creator = store.one('creators', {'name': sample['name']})
    profile = {
        'owner_id': None, 'name': sample['name'], 'title': sample['title'],
        'bio': sample['bio'], 'location': sample['location'],
        'categories': sample['categories'], 'skills': sample['skills'],
        'platforms': sample['platforms'], 'audience': 0, 'rate': 0,
        'avatar_url': None, 'contact_email': None,
        'portfolio': 'Illustrative sample portfolio for the Crevo hackathon. Image and feedback examples are fictional and should not be interpreted as real client work.',
        'portfolio_source': 'demo',
    }
    if creator:
        if creator.get('owner_id') is not None or creator.get('portfolio_source') != 'demo':
            raise SystemExit(f"Refusing to overwrite a non-demo profile: {sample['name']}")
        creator = store.update('creators', creator['id'], profile)
        store.admin.table('portfolio_items').delete().eq('creator_id', creator['id']).execute()
    else:
        creator = store.insert('creators', profile)
    store.insert('portfolio_items', {
        'creator_id': creator['id'], 'title': sample['work_title'],
        'description': sample['work_description'],
        'media_url': f"{BASE}/{sample['image']}", 'media_type': 'image',
        'tools': ['OpenAI image generation'], 'workflow': sample['workflow'],
        'format': sample['format'],
        'commercial_use': 'Illustrative demo only; no client license is represented.',
        'verification': 'illustrative demo',
    })

from demo_gigs import ensure_demo_gigs  # noqa: E402

ensure_demo_gigs()
print(f'Removed {removed} legacy demo profiles and installed {len(SAMPLES)} new illustrative portfolios')
