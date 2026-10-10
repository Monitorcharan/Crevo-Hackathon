"""Install illustrative service listings for the known demo creators only."""

import store


SAMPLES = {
    '[Demo] Aria Vale': ('AI launch film concept and visual direction', 'night-drive.png',
        'I will shape your early campaign idea into an AI-assisted launch film concept. We will define the story, visual references, key scenes and a production plan before any final deliverables are agreed. This is an illustrative Crevo demo listing, not a claim of completed client work.',
        'Discovery call; moodboard and story direction; sample keyframes; review and revision plan.',
        '16:9 film concept', ['AI filmmaking', 'Storyboarding', 'Creative direction']),
    '[Demo] Kian Mercer': ('3D motion concept for your next campaign', 'glass-motion.png',
        'I will explore a distinctive 3D visual direction for a campaign, product launch or social sequence. The gig covers concept development, material and lighting studies, and a clear path toward motion production. The cover is a static illustrative demo image.',
        'Creative brief review; style frames; material and lighting study; delivery plan and feedback round.',
        '16:9 motion concept', ['3D design', 'Motion direction', 'Generative art']),
    '[Demo] Solana Park': ('AI product imagery and beauty art direction', 'skincare-still.png',
        'I will develop a visual concept for your product with carefully directed lighting, composition and brand mood. We can plan still images for a launch, social campaign or e-commerce use. The pictured product is fictional demo artwork.',
        'Product and audience review; visual references; still-life concepts; selected final direction.',
        '1:1 or 4:5 imagery', ['AI photography', 'Product imagery', 'Art direction']),
    '[Demo] Niko Lane': ('Fashion editorial concepts for social campaigns', 'fashion-editorial.png',
        'I will plan an editorial visual direction for a fashion or lifestyle campaign, from mood and composition to final concept frames. The image shown is fictional AI-generated demo art and does not represent a commissioned campaign.',
        'Moodboard; editorial style exploration; campaign concept frames; feedback and selection.',
        '4:5 social imagery', ['Fashion concepts', 'Editorial imagery', 'Social creative']),
    '[Demo] Imani Sol': ('Food and beverage launch imagery concept', 'citrus-campaign.svg',
        'I will explore a visual direction for a fictional food or beverage launch. This SVG cover is original illustrative art and is not a commissioned campaign.',
        'Brief review; product moodboard; composition studies; concept frame; revision plan.',
        '3:2 concept image', ['Product imagery', 'Art direction', 'Vector concept']),
    '[Demo] Theo Grant': ('Brand identity and motion style frame', 'type-signal.svg',
        'I will develop a type-led identity direction and a static frame that could guide motion design. This listing is an illustrative service example.',
        'Brand discovery; type and color system; static style frame; motion notes.',
        '3:2 style frame', ['Typography', 'Creative direction', 'Motion concepts']),
    '[Demo] Mira Chen': ('AR environment concept direction', 'signal-world.svg',
        'I will explore a speculative AR environment direction through static concept art. The cover is not a working AR experience.',
        'Experience brief; environment sketches; interface motifs; concept frame.',
        '3:2 environment image', ['Worldbuilding', 'VFX concepts', 'Vector concept']),
    '[Demo] Ezra Quinn': ('Film story treatment and keyframe', 'film-frame.svg',
        'I will turn a narrative idea into a visual treatment with story beats and illustrative keyframes. This static cover is not a finished film.',
        'Story discovery; visual treatment; storyboard beats; selected keyframe.',
        '3:2 film keyframe', ['Storyboarding', 'Creative direction', 'Visual narrative']),
    '[Demo] Crevo Creator': ('AI campaign concept from idea to visual storyboard', 'night-drive.png',
        'I can turn a rough brand idea into a clear AI-assisted campaign concept. Share your audience, goal and references; I will outline a story, develop a visual direction and prepare illustrative frames for review. This shared account is for hackathon evaluation, and its artwork is demo content.',
        'Brief discovery; concept and moodboard; storyboard outline; sample visual frames; one review round.',
        '9:16 or 16:9 concept', ['Creative direction', 'Storyboarding', 'AI filmmaking']),
}


def ensure_demo_gigs():
    for creator in store.all_rows('creators'):
        sample = SAMPLES.get(creator['name'])
        if not sample:
            continue
        owner = store.one('users', {'id': creator['owner_id']}) if creator.get('owner_id') else None
        if owner:
            if owner['email'] != 'creator.demo.crevo@example.com':
                continue
        elif creator.get('portfolio_source') != 'demo':
            continue
        if any(item['media_type'] == 'gig' for item in store.all_rows('portfolio_items', {'creator_id': creator['id']})):
            continue
        title, image, description, workflow, output_format, tools = sample
        store.insert('portfolio_items', {
            'creator_id': creator['id'], 'title': f'[Demo] {title}', 'description': description,
            'media_url': f'https://crevo-hackathon.onrender.com/demo/{image}', 'media_type': 'gig',
            'tools': tools, 'workflow': workflow, 'format': output_format,
            'commercial_use': 'Illustrative demo only. Licensing, scope and price are agreed before a real engagement.',
            'verification': 'illustrative demo',
        })
