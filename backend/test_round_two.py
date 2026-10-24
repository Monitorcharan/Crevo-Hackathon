import io
import json
from types import SimpleNamespace
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from fastapi import HTTPException
import main
import store
from matching import license_check, score_match
from delivery_checks import inspect_bytes, check_delivery

LICENSE = {'usage_types': ['paid_social', 'web'], 'territory': 'Worldwide', 'duration_months': 12, 'exclusive': False}


def image(width=90, height=160, color='#b4cf73'):
    output = io.BytesIO()
    Image.new('RGB', (width, height), color).save(output, 'PNG')
    return output.getvalue()


def test_license_conflicts_and_unknowns():
    assert license_check(LICENSE, None)['status'] == 'unconfirmed'
    assert license_check(None, LICENSE)['status'] == 'unconfirmed'
    offered = {**LICENSE, 'territory': 'India', 'duration_months': 3, 'usage_types': ['web']}
    result = license_check({**LICENSE, 'exclusive': True}, offered)
    assert result['status'] == 'mismatch' and len(result['issues']) == 4
    assert license_check({**LICENSE, 'duration_months': 0}, LICENSE)['status'] == 'mismatch'
    assert license_check(LICENSE, {**LICENSE, 'duration_months': 0})['status'] == 'compatible'
    assert license_check({**LICENSE, 'territory': 'India, UK'}, {**LICENSE, 'territory': 'UK, India'})['status'] == 'compatible'


def test_matching_uses_portfolio_and_caps_unsafe_or_sparse_matches():
    creator = {'id': 'one', 'name': 'Creator', 'categories': ['AI Filmmaking'], 'skills': ['Editing'], 'rate': 500, 'licensing': LICENSE, 'verified_at': '2026-10-24'}
    brief = {'category': 'AI Filmmaking', 'skills': ['Editing'], 'budget': 1000, 'content_type': 'Video', 'format': '9:16', 'style': 'cinematic', 'required_tools': ['Runway'], 'licensing': LICENSE}
    work = {'id': 'work', 'title': 'Cinematic launch video', 'description': '', 'workflow': 'Cinematic editing', 'format': '9:16', 'tools': ['Runway'], 'media_url': 'https://example.com/work', 'media_type': 'video'}
    result = score_match(creator, brief, [work])
    assert result['score'] == 100 and result['strength'] == 'strong' and result['evidence'][0]['id'] == 'work'
    missing = score_match({**creator, 'licensing': None}, brief, [work])
    assert missing['score'] <= 74 and missing['strength'] != 'strong'
    mismatch = score_match({**creator, 'licensing': {**LICENSE, 'territory': 'India'}}, brief, [work])
    assert mismatch['score'] <= 49 and mismatch['licensing']['status'] == 'mismatch'
    sparse = score_match({'id': 'sparse', 'name': 'New creator'}, brief, [])
    assert sparse['strength'] == 'weak' and sparse['weaknesses']
    without_work = score_match(creator, {'category': 'AI Filmmaking', 'skills': ['Editing'], 'budget': 1000, 'licensing': LICENSE}, [])
    assert without_work['score'] <= 74 and without_work['strength'] != 'strong'
    assert score_match(creator, brief, [{**work, 'media_type': 'gig'}])['portfolio_count'] == 0
    conflicting = score_match(creator, {**brief, 'content_type': 'Image', 'duration_seconds': 15}, [work])
    assert conflicting['score'] <= 49 and conflicting['conflicts']


def test_real_mp4_dimensions_duration_and_delivery_requirements():
    fixtures = Path(__file__).parent / 'fixtures'
    vertical = inspect_bytes((fixtures / 'round2-vertical.mp4').read_bytes())
    assert (vertical['width'], vertical['height']) == (90, 160)
    assert abs(vertical['duration_seconds'] - 15) < .1
    brief = {'format': '9:16', 'content_type': 'Video', 'duration_seconds': 15}
    assert check_delivery(vertical, brief)['passed']
    landscape = inspect_bytes((fixtures / 'round2-landscape.mp4').read_bytes())
    failed = check_delivery(landscape, brief)
    assert not failed['passed'] and any(not x['passed'] and x['name'] == 'Aspect ratio' for x in failed['checks'])
    assert not check_delivery(vertical, {**brief, 'duration_seconds': 30})['passed']
    assert not check_delivery(inspect_bytes(image()), {'format': 'MP4 · 9:16'})['passed']


def test_private_hosted_download_checks_membership_before_storage(monkeypatch):
    calls = []
    class PrivateStorage:
        def from_(self, bucket):
            assert bucket == 'crevo-deliveries'
            return self
        def download(self, path):
            calls.append(path)
            return b'private creative file'
    project = {'id': 'project', 'brand_id': 'brand', 'creator_id': 'creator'}
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(store, 'admin', SimpleNamespace(storage=PrivateStorage()))
    monkeypatch.setattr(store, 'one', lambda table, filters: project if table == 'projects' else None)
    endpoint = next(route.endpoint for route in main.app.routes if getattr(route, 'path', '') == '/api/projects/{project_id}/files/{asset_id}')
    asset_id = 'a' * 32
    response = endpoint('project', asset_id, user={'id': 'brand', 'role': 'brand'})
    assert response.body == b'private creative file' and calls == ['project/' + asset_id]
    with pytest.raises(HTTPException) as error:
        endpoint('project', asset_id, user={'id': 'another-brand', 'role': 'brand'})
    assert error.value.status_code == 404 and len(calls) == 1


def test_shortlist_invitation_revision_and_delivery_journey(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'round-two.db')
    with TestClient(main.app) as client:
        def register(name, role):
            r = client.post('/api/auth/register', json={'name': name, 'company_name': name + ' Studio', 'email': name.lower().replace(' ', '') + '@example.com', 'password': 'round-two-strong-password', 'role': role})
            assert r.status_code == 200, r.text
            return {'Authorization': 'Bearer ' + r.json()['access_token']}
        brand, creator, other = register('Brand', 'brand'), register('Creator', 'creator'), register('Other', 'brand')
        cid = client.get('/api/me', headers=creator).json()['creator']['id']
        edit = client.put('/api/me/creator', headers=creator, json={'title': 'Product image creator', 'bio': 'Cinematic product imagery', 'categories': ['Product Visualization'], 'skills': ['Editing'], 'platforms': ['Instagram'], 'location': 'Mumbai', 'rate': 100, 'audience': 0})
        assert edit.status_code == 200, edit.text
        assert client.put('/api/me/licensing', headers=creator, json=LICENSE).status_code == 200
        work = client.post('/api/me/portfolio/items', headers=creator, json={'title': 'Cinematic product image', 'description': 'Cinematic product work', 'media_url': 'https://example.com/visual.png', 'media_type': 'image', 'tools': ['Midjourney'], 'workflow': 'Cinematic art direction and editing', 'format': '9:16', 'commercial_use': 'Worldwide paid social and web, 12 months'})
        assert work.status_code == 200, work.text
        payload = {'title': 'Product launch imagery', 'description': 'Create cinematic product launch images for a new coffee brand.', 'category': 'Product Visualization', 'skills': ['Editing'], 'platforms': ['Instagram'], 'budget': 1000, 'location': '', 'content_type': 'Image', 'style': 'cinematic', 'format': '9:16', 'commercial_use': 'Worldwide paid social and website for one year', 'licensing': LICENSE, 'required_tools': ['Midjourney'], 'deliverables': 'One final product image', 'deadline': '2026-11-10', 'revision_rounds': 2}
        brief = client.post('/api/briefs', headers=brand, json=payload).json()
        root = f"/api/briefs/{brief['id']}"
        assert client.post('/api/briefs', headers=brand, json={**payload, 'duration_seconds': 15}).status_code == 422
        ranked = client.get(root + '/matches', headers=brand).json()
        assert ranked[0]['creator']['id'] == cid and ranked[0]['strength'] == 'strong'
        assert all(m['creator'].get('owner_id') for m in ranked)
        assert client.get(root + '/candidates', headers=other).status_code == 404
        proposals = client.post(root + '/agent', headers=brand).json()
        assert proposals['proposed'] == 1
        assert client.post(root + '/agent', headers=brand).json()['proposed'] == 0
        assert client.get('/api/contact/threads', headers=creator).json() == []
        candidate = proposals['candidates'][0]
        url = '/api/candidates/' + candidate['id']
        assert client.post(url, headers=creator, json={'action': 'contact', 'message': 'I should not be able to invite myself.'}).status_code == 403
        rejected = client.post(root + '/agent/decision', headers=brand, json={'decision': 'reject'}).json()
        assert rejected[0]['status'] == 'removed'
        assert client.post(root + '/candidates', headers=brand, json={'action': 'shortlist', 'creator_id': cid}).status_code == 200
        invited = client.post(url, headers=brand, json={'action': 'contact', 'message': 'We would love your approach to this cinematic coffee campaign. Please review the brief.'})
        assert invited.status_code == 200 and invited.json()['thread_id']
        assert client.post(url, headers=brand, json={'action': 'contact', 'message': 'A second invitation should not be sent.'}).status_code == 409
        assert client.get(root + '/candidates', headers=creator).json()[0]['status'] == 'invited'
        assert any(n['kind'] == 'invitation' for n in client.get('/api/notifications', headers=creator).json())
        assert client.post(url, headers=creator, json={'action': 'interested'}).status_code == 200
        application = client.get('/api/applications', headers=brand).json()[0]
        client.put('/api/me/licensing', headers=creator, json={**LICENSE, 'territory': 'India'})
        async def optimistic_ai(prompt, json_mode=False):
            assert 'required_tools' in prompt and 'licensing' in prompt
            return json.dumps({'matches': [{'id': cid, 'score': 100, 'reason': 'A high creative fit; usage rights still need resolution.'}]})
        monkeypatch.setattr(main, 'AI_PROVIDER', 'openai')
        monkeypatch.setattr(main, 'generate_ai_text', optimistic_ai)
        hybrid = client.get(root + '/matches', headers=brand).json()[0]
        assert hybrid['score'] <= 49 and hybrid['licensing']['status'] == 'mismatch'
        assert 'AI assessment' in hybrid['method']
        async def unavailable_ai(*args, **kwargs):
            raise RuntimeError('AI service is unavailable')
        monkeypatch.setattr(main, 'generate_ai_text', unavailable_ai)
        fallback = client.get(root + '/matches', headers=brand).json()[0]
        assert fallback['method'] == 'portfolio evidence + weighted rules'
        monkeypatch.setattr(main, 'AI_PROVIDER', None)
        assert client.post(f"/api/applications/{application['id']}/accept", headers=brand).status_code == 409
        client.put('/api/me/licensing', headers=creator, json=LICENSE)
        selected = client.post(f"/api/applications/{application['id']}/accept", headers=brand)
        assert selected.status_code == 200, selected.text
        project = selected.json()
        assert project['workflow']['selection_snapshot']['creator_offer'] == LICENSE
        base = f"/api/projects/{project['id']}"
        def action(who, name, status=200, **values):
            current = client.get(base + '/workspace', headers=who).json()
            response = client.post(base + '/workflow', headers=who, json={'revision': current.get('workflow_revision', 0), 'action': name, **values})
            assert response.status_code == status, response.text
            return response.json()
        action(creator, 'submit', status=409, title='Too early', notes='Production before terms must be blocked.')
        action(brand, 'terms', amount_paise=250000, notes='One image, 10 November deadline, two revisions.', licensing=LICENSE)
        action(creator, 'accept_terms')
        action(brand, 'submit', status=403, title='Wrong role', notes='Brands cannot submit deliveries.')
        action(brand, 'status_update', status=403, notes='Brands cannot post production updates.')
        action(creator, 'status_update', status=422, notes='  ')
        updated = action(creator, 'status_update', notes='Moodboard approved, starting first generation pass.')
        assert updated['workflow']['updates'][0]['note'].startswith('Moodboard') and updated['workflow']['updates'][0]['actor_id']
        assert client.post(base + '/assets', headers=other, files={'file': ('bad.png', image(), 'image/png')}).status_code == 404
        failed = client.post(base + '/assets', headers=creator, files={'file': ('wrong.png', image(160, 90), 'image/png')}).json()
        assert failed['passed'] is False and failed['asset_token'] is None
        assert client.get(base + '/workspace', headers=brand).json()['workflow'].get('deliveries', []) == []
        assert client.post(base + '/assets', headers=creator, files={'file': ('fake.png', b'not an image', 'image/png')}).status_code == 422
        action(creator, 'submit', status=422, title='Unchecked link', url='https://example.com/work', notes='Cannot bypass the actual file checks.')
        upload = client.post(base + '/assets', headers=creator, files={'file': ('v1.png', image(), 'image/png')}).json()
        assert upload['passed'] and upload['asset_token']
        action(creator, 'submit', title='First direction', notes='Cinematic product composition, created with the agreed tool and rights.', asset_token=upload['asset_token'])
        assert client.post(base + '/workflow', headers=brand, json={'revision': 0, 'action': 'approve', 'version': 1}).status_code == 409
        action(creator, 'approve', status=403, version=1)
        action(brand, 'revise', version=1, notes='Move the product label higher and warm the lighting.')
        action(creator, 'start_revision', version=1)
        revised = client.post(base + '/assets', headers=creator, files={'file': ('v2.png', image(color='#d4b27b'), 'image/png')}).json()
        action(creator, 'submit', title='Refined composition', notes='Raised the label and warmed the light in response to version 1 feedback.', asset_token=revised['asset_token'])
        action(brand, 'approve', status=409, version=1)
        completed = action(brand, 'approve', version=2, notes='Approved for the campaign.')
        versions = completed['workflow']['deliveries']
        assert completed['status'] == 'completed' and len(versions) == 2
        assert versions[0]['feedback'].startswith('Move the product') and versions[1]['responds_to_version'] == 1
        assert versions[0]['asset']['checks']['metadata']['sha256'] != versions[1]['asset']['checks']['metadata']['sha256']
        assert versions[0]['revision_status'] == 'approved'
        assert versions[0]['changes'] is None
        assert versions[1]['changes']['from_version'] == 1 and versions[1]['changes']['comparable']
        assert versions[1]['changes']['items'] == ['A new file was uploaded.']
        assert versions[1]['checks']['source'] == 'server inspected uploaded bytes'
        assert completed['workflow']['licensing_snapshot']['agreed'] == LICENSE
        assert client.get(versions[0]['url'], headers=brand).content == image()
        assert client.get(versions[0]['url'], headers=other).status_code == 404
        action(creator, 'submit', status=409, title='After approval', notes='Cannot edit a completed project.', asset_token=upload['asset_token'])
