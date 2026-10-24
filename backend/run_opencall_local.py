"""Isolated OpenCall preview. Never writes to the configured Supabase project."""
import argparse
import getpass
import json
import os
from datetime import timedelta
from pathlib import Path

import uvicorn
import main
import opencall
import store


def seed(path, password):
    if len(password) < 8:
        raise ValueError('Choose a local password of at least eight characters.')
    store.REMOTE = False
    store.DB_PATH = Path(path).resolve()
    store.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    store.init_local()
    main.AI_PROVIDER = None
    content = json.loads((Path(__file__).resolve().parents[1] / 'docs' / 'curated-marketplace.json').read_text(encoding='utf-8'))
    for role, email, name in [('brand', 'brand@gmail.com', content['brand']['name']), ('creator', 'creator@gmail.com', content['creator']['name'])]:
        user = store.one('users', {'email': email})
        created = not user
        if not user:
            main.register(main.Register(name=name, email=email, password=password, role=role, company_name=content['brand']['company_name'] if role == 'brand' else ''))
        user = store.one('users', {'email': email})
        if role == 'creator':
            creator = store.one('creators', {'owner_id': user['id']})
            if created:
                store.update('creators', creator['id'], content['creator'])
            if not store.all_rows('portfolio_items', {'creator_id': creator['id']}):
                for work in content['portfolio']:
                    store.insert('portfolio_items', {'creator_id': creator['id'], **work})
        else:
            if created:
                store.update('users', user['id'], content['brand'])
            if not store.all_rows('briefs', {'owner_id': user['id']}):
                payload = {**content['brief'], 'deadline': (opencall.now() + timedelta(days=20)).date().isoformat()}
                payload.pop('status', None)
                main.create_brief(main.BriefIn(**payload), user=user)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=str(Path(__file__).resolve().parents[1] / 'tmp' / 'opencall-preview.db'))
    parser.add_argument('--port', type=int, default=8011)
    args = parser.parse_args()
    password = os.environ.get('CREVO_LOCAL_DEMO_PASSWORD') or getpass.getpass('Choose the password for both isolated preview accounts: ')
    seed(args.db, password)
    print(f'Local OpenCall preview: http://127.0.0.1:{args.port}/opencall')
    print('Local-only accounts: brand@gmail.com and creator@gmail.com. Use the password you configured.')
    uvicorn.run(main.app, host='127.0.0.1', port=args.port)
