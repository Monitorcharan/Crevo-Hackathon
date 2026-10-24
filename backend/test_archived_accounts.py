"""Retired accounts retain data while leaving the active marketplace."""
from fastapi.testclient import TestClient
import main
import store


def test_archived_records_are_preserved_and_inaccessible(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'archived.db')
    with TestClient(main.app) as client:
        def account(name, role):
            response = client.post('/api/auth/register', json={'name':name, 'email':name+'@example.com',
                'password':'A-private-test-password!', 'role':role, 'company_name':'Brand Studio'})
            assert response.status_code == 200
            data = response.json()
            return data['user'], {'Authorization':'Bearer '+data['access_token']}
        old, old_headers = account('retired', 'creator')
        brand, brand_headers = account('active', 'brand')
        profile = client.get('/api/me', headers=old_headers).json()['creator']
        brief = store.insert('briefs', {'owner_id':brand['id'], 'title':'Retired campaign', 'description':'Earlier campaign retained for the owner.',
            'category':'Product Visualization', 'skills':[], 'platforms':[], 'budget':100, 'location':'Remote', 'status':'open'})
        store.insert('portfolio_items', {'creator_id':profile['id'], 'title':'Retained work', 'description':'Existing portfolio record.',
            'media_url':'https://example.com/image.png', 'media_type':'image', 'tools':[], 'workflow':'', 'format':'', 'commercial_use':'', 'verification':'self-reported'})
        store.update('creators', profile['id'], {'archived_at':'2026-10-24T12:00:00Z'})
        store.update('briefs', brief['id'], {'archived_at':'2026-10-24T12:00:00Z'})
        store.update('users', old['id'], {'disabled_at':'2026-10-24T12:00:00Z'})
        assert client.get('/api/creators').json() == []
        for suffix in ('', '/portfolio', '/gigs', '/reviews'):
            assert client.get('/api/creators/'+profile['id']+suffix).status_code == 404
        assert client.get('/api/creators/'+profile['id']+'/contact-details', headers=brand_headers).status_code == 404
        assert client.get('/api/briefs', headers=brand_headers).json() == []
        assert client.get('/api/briefs/'+brief['id'], headers=brand_headers).status_code == 404
        assert client.get('/api/me', headers=old_headers).status_code == 403
        assert client.post('/api/auth/login', json={'email':old['email'], 'password':'A-private-test-password!'}).status_code == 403
        with store.connect() as db:
            assert db.execute('select count(*) from creators').fetchone()[0] == 1
            assert db.execute('select count(*) from portfolio_items').fetchone()[0] == 1
            assert db.execute('select count(*) from briefs').fetchone()[0] == 1
