import json
from fastapi.testclient import TestClient
import main
import store
from trust_signals import build_trust
from matching import score_match


def test_declared_metadata_cannot_create_verified_or_project_trust():
    creator = {'id': 'creator', 'licensing': {'territory': 'Worldwide'}}
    work = {'creator_id': 'creator', 'media_type': 'image', 'tools': ['Declared tool'], 'workflow': 'My process', 'format': '4:5', 'verification': 'verified'}
    request = {'creator_id': 'creator', 'status': 'pending', 'statement': 'PRIVATE statement', 'reviewed_by': 'PRIVATE reviewer', 'created_at': '2026-10-24'}
    result = build_trust(creator, [work, {**work, 'media_type': 'gig'}], requests=[request])
    assert result['portfolio_review']['status'] == 'pending'
    assert result['portfolio_review']['evidence_url'] is None
    assert result['evidence']['work_samples'] == result['evidence']['documented_samples'] == 1
    assert result['matching']['points'] == 0 and result['history']['rating_average'] is None
    assert 'PRIVATE' not in json.dumps(result)
    assert result['rights']['declared']


def test_only_approved_engagements_and_their_brand_feedback_count():
    creator = {'id': 'creator', 'verified_at': '2026-10-24T10:00:00Z'}
    project = {'id': 'p1', 'creator_id': 'creator', 'brand_id': 'brand', 'status': 'completed',
               'workflow': {'terms': {'accepted_at': '2026-10-24'}, 'deliveries': [{'status': 'approved', 'checks': {'passed': True, 'source': 'server inspected uploaded bytes'}}]}}
    review = {'project_id': 'p1', 'creator_id': 'creator', 'brand_id': 'brand', 'rating': 5}
    others = [{**project, 'id': 'active', 'status': 'active'}, {**project, 'id': 'other', 'creator_id': 'other'},
              {**project, 'id': 'no-approval', 'workflow': {}}, {**project, 'id': 'no-agreement', 'workflow': {'terms': None, 'deliveries': [{'status': 'approved'}]}}]
    reviews = [review, review, {**review, 'project_id': 'active'}, {**review, 'brand_id': 'intruder'}, {**review, 'creator_id': 'other'}]
    requests = [{'creator_id': 'creator', 'status': 'approved', 'created_at': '2026-10-23', 'reviewed_at': '2026-10-24', 'evidence_url': 'https://example.com/work', 'decision_note': 'PRIVATE review notes'}]
    result = build_trust(creator, projects=[project, *others], reviews=reviews, requests=requests)
    assert result['history'] == {'completed_projects': 1, 'checked_deliveries': 1, 'review_count': 1, 'rating_average': 5.0}
    assert result['matching']['points'] == 5
    assert result['portfolio_review']['evidence_url'] == 'https://example.com/work'
    assert 'PRIVATE' not in json.dumps(result)
    low_rating = build_trust(creator, projects=[project], reviews=[{**review, 'rating': 1}])
    assert low_rating['matching']['points'] == 4  # Negative feedback never increases this score.
    requests[0]['evidence_url'] = 'https://user:password@example.com/work'
    assert build_trust(creator, requests=requests)['portfolio_review']['evidence_url'] is None
    # Project history can improve matching without pretending portfolio evidence was reviewed.
    fresh = {'id': 'creator', 'categories': ['Design'], 'licensing': None}
    brief = {'category': 'Design'}
    history_trust = build_trust(fresh, projects=[project], reviews=[review])
    baseline = score_match(fresh, brief, [])
    improved = score_match(fresh, brief, [], history_trust)
    assert improved['score'] > baseline['score']
    assert improved['trust']['portfolio_review']['status'] == 'not_reviewed'


def test_trust_endpoint_privacy_and_verification_requires_documented_work(tmp_path, monkeypatch, complete_workflow):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'trust.db')
    with TestClient(main.app) as client:
        def register(role):
            response = client.post('/api/auth/register', json={'name': 'Trust ' + role, 'company_name': 'Trust Brand', 'email': role + '@example.com', 'password': 'private-test-password', 'role': role})
            assert response.status_code == 200
            result = response.json()
            return {'Authorization': 'Bearer ' + result['access_token']}, result['user']
        creator, creator_user = register('creator')
        brand, brand_user = register('brand')
        cid = client.get('/api/me', headers=creator).json()['creator']['id']
        url = f'/api/creators/{cid}/trust'
        assert client.get(url).json()['portfolio_review']['status'] == 'not_reviewed'
        request_body = {'evidence_url': 'https://example.com/evidence', 'statement': 'Private explanation of original tools, production workflow and my role.'}
        item = {'creator_id': cid, 'title': 'Service listing', 'description': '', 'media_url': 'https://example.com/work', 'media_type': 'gig', 'tools': ['Tool'], 'workflow': 'A workflow', 'format': '4:5', 'commercial_use': '', 'verification': 'self-reported'}
        store.insert('portfolio_items', item)
        assert client.post('/api/me/verification', headers=creator, json=request_body).status_code == 422
        incomplete = store.insert('portfolio_items', {**item, 'media_type': 'image', 'workflow': ''})
        assert client.post('/api/me/verification', headers=creator, json=request_body).status_code == 422
        store.update('portfolio_items', incomplete['id'], {'workflow': 'Direction, generation, inspection and export.'})
        request = client.post('/api/me/verification', headers=creator, json=request_body)
        assert request.status_code == 200
        assert client.get(url).json()['portfolio_review']['status'] == 'pending'
        monkeypatch.setattr(main, 'ADMIN_USER_IDS', {brand_user['id']})
        decision_url = '/api/admin/verifications/' + request.json()['id'] + '/decision'
        assert client.post(decision_url, headers=creator, json={'approve': True, 'note': 'A creator cannot approve their own request.'}).status_code == 403
        assert client.post(decision_url, headers=brand, json={'approve': True, 'note': ''}).status_code == 422
        assert client.post(decision_url, headers=brand, json={'approve': True, 'note': 'Reviewed original work and workflow. Tool license verification is outside this review.'}).status_code == 200
        summary = client.get(url).json()
        assert summary['matching']['points'] == 3
        assert summary['portfolio_review']['status'] == 'reviewed'
        serialized = json.dumps(summary)
        for private in (creator_user['id'], brand_user['id'], request_body['statement'], 'decision_note', 'password', '@example.com'):
            assert private not in serialized
        brief = client.post('/api/briefs', headers=brand, json={'title': 'Trust workflow example', 'description': 'A simple image project for checking approved engagement history.', 'category': 'Design', 'skills': [], 'platforms': [], 'budget': 100, 'location': ''}).json()
        application = client.post(f"/api/briefs/{brief['id']}/apply", headers=creator, json={'note': 'I can provide the original image and documented workflow.'}).json()
        project = client.post(f"/api/applications/{application['id']}/accept", headers=brand).json()
        assert client.get(url).json()['history']['completed_projects'] == 0
        complete_workflow(client, project['id'], brand, creator)
        assert client.get(url).json()['matching']['points'] == 4
        assert client.post(f"/api/projects/{project['id']}/review", headers=brand, json={'rating': 5, 'body': 'The final deliverable matched our agreed requirements.'}).status_code == 200
        summary = client.get(url).json()
        assert summary['matching']['points'] == 5 and summary['history']['checked_deliveries'] == 1
        store.update('creators', cid, {'archived_at': '2026-10-24'})
        assert client.get(url).status_code == 404
        assert client.get('/api/creators/does-not-exist/trust').status_code == 404
