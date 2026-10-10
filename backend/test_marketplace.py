from fastapi.testclient import TestClient

import main
import store


def test_gig_editor_public_view_and_owner_access(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'gigs.db')
    with TestClient(main.app) as client:
        demo_creators = [creator for creator in client.get('/api/creators').json() if creator['portfolio_source'] == 'demo']
        assert len(demo_creators) >= 4
        assert all(client.get(f"/api/creators/{creator['id']}/gigs").json() for creator in demo_creators)

        first = client.post('/api/auth/register', json={'name': 'Gig Creator', 'email': 'gig-creator@example.com', 'password': 'strong-password', 'role': 'creator'}).json()
        second = client.post('/api/auth/register', json={'name': 'Other Creator', 'email': 'other-gig@example.com', 'password': 'strong-password', 'role': 'creator'}).json()
        brand = client.post('/api/auth/register', json={'name': 'Brand', 'company_name': 'Brand Studio', 'email': 'gig-brand@example.com', 'password': 'strong-password', 'role': 'brand'}).json()
        headers = {'Authorization': 'Bearer ' + first['access_token']}
        other_headers = {'Authorization': 'Bearer ' + second['access_token']}
        brand_headers = {'Authorization': 'Bearer ' + brand['access_token']}
        creator_id = client.get('/api/me', headers=headers).json()['creator']['id']
        payload = {'title': 'I will create AI product visuals', 'description': 'I develop a visual concept and deliver polished product images for a new campaign.',
                   'media_url': 'https://example.com/cover.jpg', 'tools': ['Runway', 'Photoshop'],
                   'workflow': 'Moodboard, visual concepts, revisions and final image files.',
                   'format': 'Still image · 4:5', 'commercial_use': 'Paid social use after agreed licensing terms.'}
        created = client.post('/api/me/gigs', headers=headers, json=payload)
        assert created.status_code == 200, created.text
        gig_id = created.json()['id']
        assert client.get(f'/api/gigs/{gig_id}').json()['creator']['id'] == creator_id
        assert len(client.get(f'/api/creators/{creator_id}/gigs').json()) == 1
        assert client.get(f'/api/creators/{creator_id}/portfolio').json() == []
        assert client.put(f'/api/me/gigs/{gig_id}', headers=other_headers, json=payload).status_code == 404
        assert client.delete(f'/api/me/gigs/{gig_id}', headers=brand_headers).status_code == 403
        updated = client.put(f'/api/me/gigs/{gig_id}', headers=headers, json={**payload, 'title': 'I will create campaign product visuals'})
        assert updated.status_code == 200 and updated.json()['title'] == 'I will create campaign product visuals'
        assert client.delete(f'/api/me/gigs/{gig_id}', headers=headers).status_code == 200
        assert client.get(f'/api/gigs/{gig_id}').status_code == 404


def test_contact_reviews_and_verified_creator(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'marketplace.db')
    monkeypatch.setattr(main, 'ADMIN_EMAILS', {'admin@example.com'})

    with TestClient(main.app) as client:
        def register(name, email, role, company_name=''):
            response = client.post('/api/auth/register', json={
                'name': name, 'email': email, 'password': 'strong-password',
                'role': role, 'company_name': company_name,
            })
            assert response.status_code == 200, response.text
            return response.json()

        brand = register('Brand Owner', 'brand@example.com', 'brand', 'North Studio')
        another = register('Other Brand', 'other@example.com', 'brand', 'South Studio')
        admin = register('Admin', 'admin@example.com', 'brand', 'Crevo Team')
        creator = register('Creator', 'creator@example.com', 'creator')
        brand_headers = {'Authorization': f"Bearer {brand['access_token']}"}
        another_headers = {'Authorization': f"Bearer {another['access_token']}"}
        admin_headers = {'Authorization': f"Bearer {admin['access_token']}"}
        creator_headers = {'Authorization': f"Bearer {creator['access_token']}"}
        creator_id = client.get('/api/me', headers=creator_headers).json()['creator']['id']

        edit = client.put('/api/me/creator', headers=creator_headers, json={
            'title': 'AI filmmaker', 'bio': 'Films for thoughtful launches', 'location': 'Mumbai',
            'categories': ['AI Filmmaking'], 'skills': ['Video'], 'platforms': ['Instagram'],
            'audience': 0, 'rate': 500, 'social_links': {}, 'contact_email': 'hello@creator.example',
        })
        assert edit.status_code == 200, edit.text
        assert client.get(f'/api/creators/{creator_id}').json()['contact_email'] == 'hello@creator.example'

        quote = client.post(f'/api/creators/{creator_id}/contact', headers=brand_headers, json={
            'creator_id': creator_id, 'kind': 'quote', 'subject': 'Campaign film',
            'message': 'We need a cinematic vertical film for our product launch.',
            'budget': 1500, 'timeline': 'Within two weeks',
        })
        assert quote.status_code == 200, quote.text
        thread_id = quote.json()['id']
        brand_user = brand['user']
        creator_user = creator['user']
        other_user = another['user']
        before_reply = main.conversation_version('inbox', thread_id, brand_user)
        assert thread_id in main.conversation_version('inbox', '', creator_user)
        assert client.get('/api/conversations/live', params={'scope': 'inbox', 'id': thread_id}).status_code == 401
        assert client.get('/api/conversations/live', params={'scope': 'inbox', 'id': thread_id}, headers=another_headers).status_code == 404
        assert client.get('/api/contact/threads', headers=creator_headers).json()[0]['brand_name'] == 'North Studio'
        assert client.get(f'/api/contact/threads/{thread_id}', headers=another_headers).status_code == 404
        reply = client.post(f'/api/contact/threads/{thread_id}/messages', headers=creator_headers,
                            json={'body': 'I can share an approach tomorrow.'})
        assert reply.status_code == 200, reply.text
        assert main.conversation_version('inbox', thread_id, brand_user) != before_reply
        assert len(client.get(f'/api/contact/threads/{thread_id}', headers=brand_headers).json()['messages']) == 1
        assert client.get('/api/notifications').status_code == 401
        brand_alerts = client.get('/api/notifications', headers=brand_headers).json()
        creator_alerts = client.get('/api/notifications', headers=creator_headers).json()
        other_alerts = client.get('/api/notifications', headers=another_headers).json()
        assert any(item['kind'] == 'contact_reply' and item['href'] == f'/inbox/{thread_id}' for item in brand_alerts)
        assert any(item['kind'] == 'contact' and item['href'] == f'/inbox/{thread_id}' for item in creator_alerts)
        assert not other_alerts

        work = client.post('/api/me/portfolio/items', headers=creator_headers, json={
            'title': 'Launch film', 'description': 'A sample film', 'media_url': 'https://example.com/film',
            'media_type': 'video', 'tools': ['Runway'], 'workflow': 'Storyboard and edit',
            'format': '9:16', 'commercial_use': 'Available for paid social',
        })
        assert work.status_code == 200, work.text
        request = client.post('/api/me/verification', headers=creator_headers, json={
            'evidence_url': 'https://example.com/film',
            'statement': 'This is my original work. I created the storyboards and edited the final film.',
        })
        assert request.status_code == 200, request.text
        request_id = request.json()['id']
        assert client.get('/api/admin/verifications', headers=brand_headers).status_code == 403
        assert len(client.get('/api/admin/verifications', headers=admin_headers).json()) == 1
        approved = client.post(f'/api/admin/verifications/{request_id}/decision', headers=admin_headers,
                               json={'approve': True, 'note': 'Portfolio evidence reviewed.'})
        assert approved.status_code == 200, approved.text
        assert client.get(f'/api/creators/{creator_id}').json()['verified_at']
        assert client.post('/api/me/verification', headers=creator_headers, json={
            'evidence_url': 'https://example.com/film',
            'statement': 'I made this project and can show the full workflow and files.',
        }).status_code == 409

        brief = client.post('/api/briefs', headers=brand_headers, json={
            'title': 'Launch campaign', 'description': 'Create a new vertical campaign film for our launch.',
            'category': 'AI Filmmaking', 'skills': ['Video'], 'platforms': ['Instagram'],
            'budget': 1500, 'location': 'Mumbai',
        }).json()
        application = client.post(f"/api/briefs/{brief['id']}/apply", headers=creator_headers,
                                  json={'note': 'I can make a cinematic vertical film for this launch.'}).json()
        project = client.post(f"/api/applications/{application['id']}/accept", headers=brand_headers).json()
        assert any(item['kind'] == 'application' for item in client.get('/api/notifications', headers=brand_headers).json())
        assert any(item['kind'] == 'project' and item['href'] == f"/projects/{project['id']}" for item in client.get('/api/notifications', headers=creator_headers).json())
        before_project_message = main.conversation_version('project', project['id'], brand_user)
        assert main.conversation_version('project', project['id'], creator_user) == before_project_message
        assert client.get('/api/conversations/live', params={'scope': 'project', 'id': project['id']}, headers=another_headers).status_code == 404
        client.post(f"/api/projects/{project['id']}/messages", headers=creator_headers, json={'body': 'The first cut is ready for review.'})
        assert main.conversation_version('project', project['id'], brand_user) != before_project_message
        review_url = f"/api/projects/{project['id']}/review"
        review_data = {'rating': 5, 'body': 'Thoughtful process, clear communication, and a strong final film.'}
        assert client.post(review_url, headers=brand_headers, json=review_data).status_code == 409
        client.post(f"/api/projects/{project['id']}/complete", headers=brand_headers)
        assert client.post(review_url, headers=another_headers, json=review_data).status_code == 404
        review = client.post(review_url, headers=brand_headers, json=review_data)
        assert review.status_code == 200, review.text
        assert client.post(review_url, headers=brand_headers, json=review_data).status_code == 409
        public = client.get(f'/api/creators/{creator_id}').json()
        assert public['review_count'] == 1 and public['rating_average'] == 5.0
        assert client.get(f'/api/creators/{creator_id}/reviews').json()[0]['brand_name'] == 'North Studio'
