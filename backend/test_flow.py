from fastapi.testclient import TestClient

import store
import main
from main import app


def test_brand_creator_collaboration(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'test.db')
    monkeypatch.setattr(main, 'AI_KEY', '')
    with TestClient(app) as client:
        brand = client.post('/api/auth/register', json={'name': 'Mira Patel', 'company_name': 'Acme Studio', 'email': 'brand@example.com', 'password': 'a-strong-password', 'role': 'brand'})
        creator = client.post('/api/auth/register', json={'name': 'Alex Rivera', 'email': 'creator@example.com', 'password': 'a-strong-password', 'role': 'creator'})
        assert brand.status_code == 200, brand.text
        assert creator.status_code == 200, creator.text
        brand_headers = {'Authorization': f"Bearer {brand.json()['access_token']}"}
        assert brand.json()['user']['company_name'] == 'Acme Studio'
        assert client.post('/api/auth/register', json={'name': 'Missing Brand', 'email': 'missing@example.com', 'password': 'a-strong-password', 'role': 'brand'}).status_code == 422
        updated_brand = client.put('/api/me/brand', headers=brand_headers, json={'name': 'Mira Patel', 'company_name': 'Acme Creative'})
        assert updated_brand.status_code == 200 and updated_brand.json()['company_name'] == 'Acme Creative'
        assert client.get('/api/me', headers=brand_headers).json()['user']['company_name'] == 'Acme Creative'
        creator_headers = {'Authorization': f"Bearer {creator.json()['access_token']}"}
        profile = client.put('/api/me/creator', headers=creator_headers, json={'title': 'Food filmmaker', 'bio': 'I film thoughtful food stories for growing brands.', 'location': 'London', 'categories': ['Food'], 'skills': ['Video', 'Editing'], 'platforms': ['Instagram'], 'audience': 25000, 'rate': 1000, 'social_links': {'instagram': 'https://www.instagram.com/alex', 'youtube': 'https://www.youtube.com/@alex'}})
        assert profile.status_code == 200, profile.text
        assert profile.json()['social_links']['instagram'] == 'https://www.instagram.com/alex'
        assert client.get(f"/api/creators/{profile.json()['id']}").json()['social_links']['youtube'] == 'https://www.youtube.com/@alex'
        bad_profile = client.put('/api/me/creator', headers=creator_headers, json={**profile.json(), 'social_links': {'instagram': 'https://instagram.com.evil.test/alex'}})
        assert bad_profile.status_code == 422
        work = client.post('/api/me/portfolio/items', headers=creator_headers, json={'title': 'Food stories', 'description': 'A short food film.', 'media_url': 'https://example.com/food-film', 'media_type': 'link', 'tools': ['Runway', 'After Effects'], 'workflow': 'Storyboard, generate, edit and color grade.', 'format': '9:16 video', 'commercial_use': 'Ask for license terms'})
        assert work.status_code == 200, work.text
        assert client.get(f"/api/creators/{profile.json()['id']}/portfolio").json()[0]['tools'] == ['Runway', 'After Effects']
        filtered = client.get('/api/creators', params={'skill': 'Video', 'tool': 'Runway', 'content_type': 'link'})
        assert filtered.status_code == 200 and any(c['id'] == profile.json()['id'] for c in filtered.json())
        assert client.get('/api/creators', params={'tool': 'No such tool'}).json() == []
        assert client.get('/api/creators', params={'q': 'Runway'}).json()[0]['id'] == profile.json()['id']

        brief = client.post('/api/briefs', headers=brand_headers, json={'title': 'Restaurant launch films', 'description': 'Create three short films for our new restaurant opening in London.', 'category': 'Food', 'skills': ['Video'], 'platforms': ['Instagram'], 'budget': 2000, 'location': 'London', 'content_type': 'AI-assisted film', 'style': 'Warm and cinematic', 'format': '9:16 vertical', 'commercial_use': 'Paid social for six months'})
        assert brief.status_code == 200, brief.text
        brief_id = brief.json()['id']
        assert brief.json()['commercial_use'] == 'Paid social for six months'
        assert client.get(f'/api/briefs/{brief_id}', headers=creator_headers).json()['brand']['company_name'] == 'Acme Creative'
        assert client.put('/api/me/brand', headers=creator_headers, json={'name': 'Alex Rivera', 'company_name': 'Wrong Role'}).status_code == 403
        assert client.post('/api/me/brand/logo', headers=brand_headers, files={'file': ('logo.png', b'not-an-image', 'image/png')}).status_code == 503
        matches = client.get(f'/api/briefs/{brief_id}/matches', headers=brand_headers)
        assert matches.status_code == 200, matches.text
        assert any(m['creator']['id'] == profile.json()['id'] for m in matches.json())
        application = client.post(f'/api/briefs/{brief_id}/apply', headers=creator_headers, json={'note': 'I would make three inviting films focused on the food and people behind it.'})
        assert application.status_code == 200, application.text
        assert client.post(f'/api/briefs/{brief_id}/apply', headers=creator_headers, json={'note': 'I would make three inviting films focused on the food and people behind it.'}).status_code == 409
        project = client.post(f"/api/applications/{application.json()['id']}/accept", headers=brand_headers)
        assert project.status_code == 200, project.text
        project_id = project.json()['id']
        assert client.post(f'/api/projects/{project_id}/messages', headers=brand_headers, json={'body': 'Welcome to the project!'}).status_code == 200
        messages = client.get(f'/api/projects/{project_id}/messages', headers=creator_headers)
        assert [m['body'] for m in messages.json()] == ['Welcome to the project!']
        assert client.post('/api/briefs', headers=creator_headers, json={'title': 'Wrong role', 'description': 'This action should be forbidden to creator accounts.', 'category': 'Food', 'skills': [], 'platforms': [], 'budget': 0, 'location': ''}).status_code == 403

        other_brand = client.post('/api/auth/register', json={'name': 'Other Manager', 'company_name': 'Other Studio', 'email': 'other-brand@example.com', 'password': 'a-strong-password', 'role': 'brand'}).json()
        other_brand_headers = {'Authorization': f"Bearer {other_brand['access_token']}"}
        assert client.get(f'/api/briefs/{brief_id}', headers=other_brand_headers).status_code == 404
        assert client.post(f'/api/briefs/{brief_id}/close', headers=other_brand_headers).status_code == 404
        assert client.post(f'/api/projects/{project_id}/complete', headers=other_brand_headers).status_code == 404

        second_creator = client.post('/api/auth/register', json={'name': 'Sam Lee', 'email': 'sam@example.com', 'password': 'a-strong-password', 'role': 'creator'}).json()
        second_headers = {'Authorization': f"Bearer {second_creator['access_token']}"}
        second_application = client.post(f'/api/briefs/{brief_id}/apply', headers=second_headers, json={'note': 'I would plan and edit three distinctive short films for the launch.'}).json()
        declined = client.post(f"/api/applications/{second_application['id']}/decline", headers=brand_headers)
        assert declined.status_code == 200 and declined.json()['status'] == 'declined'
        assert client.post(f"/api/applications/{second_application['id']}/accept", headers=brand_headers).status_code == 409

        completed = client.post(f'/api/projects/{project_id}/complete', headers=brand_headers)
        assert completed.status_code == 200 and completed.json()['status'] == 'completed'
        assert client.post(f'/api/projects/{project_id}/complete', headers=brand_headers).status_code == 200
        closed = client.post(f'/api/briefs/{brief_id}/close', headers=brand_headers)
        assert closed.status_code == 200 and closed.json()['status'] == 'closed'
        assert client.get(f'/api/briefs/{brief_id}', headers=creator_headers).status_code == 404
        assert client.post(f'/api/briefs/{brief_id}/apply', headers=creator_headers, json={'note': 'I would love to join this project and help make it happen.'}).status_code == 404


def test_structured_brief_draft(tmp_path, monkeypatch):
    import json
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'draft.db')
    monkeypatch.setattr(main, 'AI_PROVIDER', 'gemini')
    async def fake_generate(prompt, json_mode=False):
        assert json_mode and 'commercial_use' in prompt
        return json.dumps({'title': 'Café launch film', 'description': 'Create a short film for a café launch.', 'category': 'Food', 'content_type': 'Film', 'style': 'Warm', 'format': '9:16', 'commercial_use': '', 'skills': ['Video'], 'platforms': ['Instagram'], 'location': ''})
    monkeypatch.setattr(main, 'generate_ai_text', fake_generate)
    with TestClient(app) as client:
        brand = client.post('/api/auth/register', json={'name': 'Brand Manager', 'company_name': 'Brand Studio', 'email': 'draft-brand@example.com', 'password': 'a-strong-password', 'role': 'brand'}).json()
        headers = {'Authorization': 'Bearer ' + brand['access_token']}
        result = client.post('/api/briefs/draft', headers=headers, json={'idea': 'A warm 9:16 café launch film for Instagram.'})
        assert result.status_code == 200, result.text
        assert result.json()['title'] == 'Café launch film'
        assert result.json()['format'] == '9:16'
        assert result.json()['commercial_use'] == ''
        assert result.json()['skills'] == ['Video']


def test_ai_assistant_requires_login_and_uses_provider(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'assistant.db')
    monkeypatch.setattr(main, 'AI_PROVIDER', 'gemini')
    async def fake_generate(prompt, json_mode=False):
        assert not json_mode
        assert 'Which aspect ratio' in prompt
        return 'For a vertical social video, choose 9:16.'
    monkeypatch.setattr(main, 'generate_ai_text', fake_generate)
    with TestClient(app) as client:
        payload = {'messages': [{'role': 'user', 'content': 'Which aspect ratio should I use?'}]}
        assert client.post('/api/assistant/chat', json=payload).status_code == 401
        brand = client.post('/api/auth/register', json={'name': 'Brand Manager', 'company_name': 'Brand Studio', 'email': 'chat-brand@example.com', 'password': 'a-strong-password', 'role': 'brand'}).json()
        headers = {'Authorization': 'Bearer ' + brand['access_token']}
        reply = client.post('/api/assistant/chat', headers=headers, json=payload)
        assert reply.status_code == 200, reply.text
        assert reply.json() == {'reply': 'For a vertical social video, choose 9:16.', 'source': 'gemini'}
        assert client.post('/api/assistant/chat', headers=headers, json={'messages': [{'role': 'assistant', 'content': 'Hello'}]}).status_code == 422
