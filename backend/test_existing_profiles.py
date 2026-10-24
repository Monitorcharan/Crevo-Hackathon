"""Compatibility for older member records and the existing shared demo accounts."""
from fastapi.testclient import TestClient
import main
import store
from demo_accounts import BRAND_EMAIL, CREATOR_EMAIL
from prepare_round_two_demo import prepare, BRIEF_TITLE


def test_existing_profiles_and_shared_demo_are_separate(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'older-profiles.db')
    with TestClient(main.app) as client:
        def account(name, email, role):
            response = client.post('/api/auth/register', json={'name': name, 'email': email, 'role': role,
                'password': 'Old-profile-strong-password!', 'company_name': 'Example Studio' if role == 'brand' else ''})
            assert response.status_code == 200, response.text
            return {'Authorization': 'Bearer ' + response.json()['access_token']}
        brand = account('Shared Brand', BRAND_EMAIL, 'brand')
        creator = account('[Demo] Crevo Creator', CREATOR_EMAIL, 'creator')
        member = account('Existing Member', 'older-member@example.com', 'creator')
        real_brand = account('Real Brand', 'older-brand@example.com', 'brand')
        before = client.get('/api/me', headers=member).json()
        assert before['round_two_readiness']['ready'] is False
        assert before['round_two_readiness']['work_samples'] == 0
        assert before['creator']['licensing'] is None
        shared_profile = {'title': 'Fictional campaign creator', 'bio': 'Shared test account with fictional creative direction and storyboarding metadata.',
                          'location': '', 'categories': ['AI Filmmaking'], 'skills': ['Creative Direction', 'Storyboarding'],
                          'platforms': ['Instagram'], 'audience': 0, 'rate': 250}
        assert client.put('/api/me/creator', headers=creator, json=shared_profile).status_code == 200
        old = store.insert('briefs', {'owner_id': client.get('/api/me', headers=brand).json()['user']['id'],
                  'title': '[Demo] Earlier campaign', 'description': 'An earlier closed campaign.', 'category': 'AI Filmmaking',
                  'skills': [], 'platforms': [], 'budget': 500, 'location': '', 'status': 'closed'})
        brief = prepare(apply=True)
        assert brief['title'] == BRIEF_TITLE
        count = len(store.all_rows('portfolio_items'))
        assert prepare(apply=True)['id'] == brief['id']
        assert len(store.all_rows('portfolio_items')) == count
        assert store.one('briefs', {'id': old['id']})['status'] == 'closed'
        after = client.get('/api/me', headers=member).json()
        assert after['creator'] == before['creator'], 'Preparing demos must not change existing member claims'
        readiness = client.get('/api/me', headers=creator).json()['round_two_readiness']
        assert readiness['ready'] is True
        ranked = client.get(f"/api/briefs/{brief['id']}/matches", headers=brand).json()
        shared_id = client.get('/api/me', headers=creator).json()['creator']['id']
        assert len(ranked) == 1 and ranked[0]['creator']['id'] == shared_id
        assert ranked[0]['demo_scenario'] is True and ranked[0]['licensing']['status'] == 'compatible'
        proposed = client.post(f"/api/briefs/{brief['id']}/agent", headers=brand)
        assert proposed.status_code == 200 and proposed.json()['proposed'] == 1
        assert client.post(f"/api/briefs/{brief['id']}/candidates", headers=brand,
                           json={'action': 'shortlist', 'creator_id': before['creator']['id']}).status_code == 422
        ordinary = store.insert('briefs', {**{k: v for k, v in brief.items() if k not in ('id', 'created_at')},
                    'owner_id': client.get('/api/me', headers=real_brand).json()['user']['id']})
        real_matches = client.get(f"/api/briefs/{ordinary['id']}/matches", headers=real_brand).json()
        assert shared_id not in [match['creator']['id'] for match in real_matches]
        assert any(match['creator']['id'] == before['creator']['id'] for match in real_matches)
        assert all(match['demo_scenario'] is False for match in real_matches)
