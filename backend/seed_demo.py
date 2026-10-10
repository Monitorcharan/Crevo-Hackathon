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
        'platforms': ['Instagram', 'YouTube'], 'image': 'night-drive.png', 'rate': 850,
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
        'platforms': ['Instagram', 'YouTube'], 'image': 'glass-motion.png', 'rate': 700,
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
        'platforms': ['Instagram', 'TikTok'], 'image': 'skincare-still.png', 'rate': 550,
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
        'platforms': ['Instagram', 'TikTok'], 'image': 'fashion-editorial.png', 'rate': 500,
        'work_title': 'Electric Blue / fashion editorial',
        'work_description': 'Illustrative fashion campaign concept created for the Crevo demo, not commissioned client work.',
        'workflow': 'Generated a fictional studio fashion scene with geometric color blocking and selected the final frame.',
        'format': '16:9 editorial image',
    },
    {
        'name': '[Demo] Imani Sol', 'title': 'Food & beverage campaign designer',
        'bio': 'Fictional Crevo demo profile. The citrus bottle artwork is an original illustrative SVG concept, not a commissioned campaign.',
        'location': 'Creative studio · worldwide',
        'categories': ['Food', 'Product Visualization', 'Advertising Creative'],
        'skills': ['Product Imagery', 'Campaign Concepts', 'Art Direction'],
        'platforms': ['Instagram', 'TikTok'], 'image': 'citrus-campaign.svg', 'rate': 450,
        'work_title': 'Sola / citrus launch concept',
        'work_description': 'Original illustrative vector concept for a fictional beverage launch. No brand engagement is represented.',
        'workflow': 'Composed a fictional product scene with vector shapes, warm gradients, packaging and a citrus motif.',
        'format': '3:2 campaign image', 'tools': ['Vector SVG illustration'],
    },
    {
        'name': '[Demo] Theo Grant', 'title': 'Brand identity & motion art director',
        'bio': 'Fictional Crevo demo profile with an original typography concept frame. No real client work is claimed.',
        'location': 'Creative studio · worldwide',
        'categories': ['Brand Identity', 'Graphic Design', 'Motion Design'],
        'skills': ['Typography', 'Creative Direction', 'Motion Concepts'],
        'platforms': ['Instagram', 'YouTube'], 'image': 'type-signal.svg', 'rate': 600,
        'work_title': 'Move With It / identity frame',
        'work_description': 'Original illustrative vector frame for a fictional kinetic identity, not a finished animation.',
        'workflow': 'Built a high-contrast type composition and directional shapes as a motion-system starting frame.',
        'format': '3:2 identity keyframe', 'tools': ['Vector SVG illustration'],
    },
    {
        'name': '[Demo] Mira Chen', 'title': 'AR worldbuilder & VFX concept artist',
        'bio': 'Fictional Crevo demo profile. The AR city illustration is an original static concept, not a working augmented-reality experience.',
        'location': 'Creative studio · worldwide',
        'categories': ['AR & VFX', '3D & CGI', 'Technology'],
        'skills': ['Worldbuilding', 'Environment Design', 'VFX Concepts'],
        'platforms': ['Instagram', 'YouTube'], 'image': 'signal-world.svg', 'rate': 800,
        'work_title': 'Signal City / AR environment concept',
        'work_description': 'Original illustrative vector environment for a fictional AR city experience.',
        'workflow': 'Layered a city silhouette, interface rings and light beam into a speculative concept frame.',
        'format': '3:2 environment image', 'tools': ['Vector SVG illustration'],
    },
    {
        'name': '[Demo] Ezra Quinn', 'title': 'AI filmmaker & narrative visualist',
        'bio': 'Fictional Crevo demo profile featuring a static film keyframe. It is an original concept illustration, not a completed film.',
        'location': 'Creative studio · worldwide',
        'categories': ['AI Filmmaking', 'AI Animation', 'Travel'],
        'skills': ['Storyboarding', 'Visual Narrative', 'Creative Direction'],
        'platforms': ['Instagram', 'YouTube'], 'image': 'film-frame.svg', 'rate': 650,
        'work_title': 'The Long Way Home / film keyframe',
        'work_description': 'Original illustrative vector frame for a fictional travel film treatment.',
        'workflow': 'Designed a warm dusk landscape and cinematic framing for a possible film sequence.',
        'format': '3:2 film keyframe', 'tools': ['Vector SVG illustration'],
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
        'platforms': sample['platforms'], 'audience': 0, 'rate': sample['rate'],
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
        'tools': sample.get('tools', ['OpenAI image generation']), 'workflow': sample['workflow'],
        'format': sample['format'],
        'commercial_use': 'Illustrative demo only; no client license is represented.',
        'verification': 'illustrative demo',
    })

from demo_gigs import ensure_demo_gigs  # noqa: E402

ensure_demo_gigs()
print(f'Removed {removed} legacy demo profiles and installed {len(SAMPLES)} new illustrative portfolios')
