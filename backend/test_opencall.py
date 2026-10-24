"""Real uploads, visitor voting, immutable rules and the existing delivery flow."""
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main
import opencall
import store
from postgrest.exceptions import APIError

LICENSE = {'usage_types': ['paid_social', 'web'], 'territory': 'Worldwide', 'duration_months': 12, 'exclusive': False}


@pytest.fixture
def floor(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'opencall.db')
    with TestClient(main.app) as client:
        people = {}
        for key, role in [('brand', 'brand'), ('other', 'brand'), ('creator', 'creator'), ('second', 'creator')]:
            result = client.post('/api/auth/register', json={'name': key.title(), 'email': f'{key}@opencall.example', 'password': 'private-test-password', 'role': role, 'company_name': key.title() if role == 'brand' else ''})
            assert result.status_code == 200, result.text
            data = result.json()
            headers = {'Authorization': 'Bearer ' + data['access_token']}
            me = client.get('/api/me', headers=headers).json()
            people[key] = {'headers': headers, **me}
            if role == 'creator':
                client.put('/api/me/licensing', headers=headers, json=LICENSE)
        brief = client.post('/api/briefs', headers=people['brand']['headers'], json={'title': 'Cobalt open creative challenge', 'description': 'Create an original product image concept for a thoughtful campaign launch.', 'category': 'Product Visualization', 'skills': ['Art Direction'], 'platforms': ['Instagram'], 'budget': 1500, 'location': '', 'content_type': 'Image', 'format': 'PNG · 4:5', 'licensing': LICENSE}).json()
        yield client, people, brief


def launch(floor, mode='brand'):
    client, people, brief = floor
    response = client.post('/api/opencall', headers=people['brand']['headers'], json={
        'brief_id': brief['id'], 'mode': mode, 'submission_deadline': (opencall.now() + timedelta(days=2)).isoformat(),
        'voting_deadline': (opencall.now() + timedelta(days=4)).isoformat(), 'public_consent': True,
        'rules': 'Unpaid concept participation. The selected creator discusses the final scope and project budget before production.'})
    assert response.status_code == 200, response.text
    return response.json()


def image():
    buffer = io.BytesIO()
    Image.new('RGB', (80, 100), '#193523').save(buffer, 'PNG')
    return buffer.getvalue()


def submit(floor, call, who='creator'):
    client, people, _ = floor
    response = client.post(f'/api/opencall/{call["id"]}/entries', headers=people[who]['headers'],
                           data={'title': who + ' product concept', 'description': 'An original concept answering the product image campaign brief.', 'tools': 'OpenAI Image Generation', 'workflow': 'Concept development, image generation and careful refinement for the brief.', 'consent': 'true'},
                           files={'file': ('concept.png', image(), 'image/png')})
    assert response.status_code == 200, response.text
    return response.json()


def act(floor, call, action, entry_id='', note='A thoughtful public reason for this action and creative decision.', score=80, who='brand'):
    client, people, _ = floor
    return client.post(f'/api/opencall/{call["id"]}/actions', headers=people[who]['headers'], json={'revision': call['revision'], 'action': action, 'entry_id': entry_id, 'note': note, 'score': score})


def visitor_vote(floor, call, entry_id, new=False):
    client, _, _ = floor
    if new:
        client.cookies.clear()
    client.get(f'/api/opencall/{call["id"]}')
    return client.post(f'/api/opencall/{call["id"]}/vote', headers={'X-Crevo-Vote': '1'}, json={'entry_id': entry_id})


def test_public_launch_privacy_permissions_and_fixed_rules(floor):
    client, people, brief = floor
    call = launch(floor)
    listing = client.get('/api/opencall').json()
    assert len(listing) == 1 and not listing[0]['owned']
    public = client.get(f'/api/opencall/{call["id"]}').json()
    text = str(public)
    for field in ('owner_id', 'contact_email', 'password_hash', people['brand']['user']['email']):
        assert field not in text
    assert public['brief']['licensing'] == LICENSE
    assert client.put(f'/api/opencall/{call["id"]}', json={'mode': 'community'}).status_code == 405
    assert client.post('/api/opencall', headers=people['creator']['headers'], json={**{'brief_id': brief['id'], 'mode': 'brand', 'submission_deadline': (opencall.now()+timedelta(days=1)).isoformat(), 'voting_deadline': (opencall.now()+timedelta(days=2)).isoformat(), 'rules': 'Participation is unpaid and requires original creative work.', 'public_consent': True}}).status_code == 403
    assert act(floor, call, 'close_submissions', who='other').status_code == 403
    assert act(floor, call, 'close_submissions', who='creator').status_code == 403


def test_upload_actual_bytes_and_one_entry_and_consent(floor):
    client, people, _ = floor
    call = launch(floor)
    common = {'title': 'Original image', 'description': 'A public creative concept for this campaign.', 'tools': 'Image tool', 'workflow': 'A documented workflow for this original product image.'}
    url = f'/api/opencall/{call["id"]}/entries'
    assert client.post(url, headers=people['creator']['headers'], data=common, files={'file': ('a.png', image(), 'image/png')}).status_code == 422
    assert client.post(url, headers=people['creator']['headers'], data={**common, 'consent': 'true'}, files={'file': ('a.png', b'not an image', 'image/png')}).status_code == 422
    call = submit(floor, call)
    entry = call['entries'][0]
    assert entry['media']['width'] == 80 and entry['media']['height'] == 100
    assert client.get(entry['media']['url']).content == image()
    assert client.post(url, headers=people['creator']['headers'], data={**common, 'consent': 'true'}, files={'file': ('a.png', image(), 'image/png')}).status_code == 409
    assert client.post(url, headers=people['brand']['headers'], data={**common, 'consent': 'true'}, files={'file': ('a.png', image(), 'image/png')}).status_code == 403


def test_visitor_vote_is_idempotent_can_move_and_never_exposes_voters(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor, 'community'))
    call = submit(floor, call, 'second')
    first, second = [e['id'] for e in call['entries']]
    assert visitor_vote(floor, call, first).status_code == 409
    call = act(floor, call, 'close_submissions').json()
    for _ in range(2):
        response = visitor_vote(floor, call, first)
        assert response.status_code == 200, response.text
        assert response.json()['vote_count'] == 1
    moved = visitor_vote(floor, call, second).json()
    assert moved['vote_count'] == 1 and moved['my_vote'] == second
    assert [e['votes'] for e in moved['entries']] == [0, 1]
    assert all(isinstance(e['votes'], int) for e in moved['entries'])
    public = client.get(f'/api/opencall/{call["id"]}').json()
    assert not any(k in public for k in ('votes', 'owner_id'))
    assert client.post(f'/api/opencall/{call["id"]}/vote', json={'entry_id': first}).status_code == 403
    assert client.post(f'/api/opencall/{call["id"]}/vote', headers={**people['creator']['headers'], 'X-Crevo-Vote': '1'}, json={'entry_id': second}).status_code == 403


def test_brand_selection_continues_through_actual_delivery(floor, complete_workflow):
    client, people, brief = floor
    call = submit(floor, launch(floor))
    entry_id = call['entries'][0]['id']
    assert act(floor, call, 'select', entry_id).status_code == 409
    call = act(floor, call, 'close_submissions').json()
    assert act(floor, call, 'select', entry_id).status_code == 409
    call = act(floor, call, 'evaluate', entry_id).json()
    assert client.get(f'/api/opencall/{call["id"]}').json()['entries'][0]['evaluation'] is None
    selected = act(floor, call, 'select', entry_id)
    assert selected.status_code == 200, selected.text
    selected = selected.json()
    assert selected['phase'] == 'selected' and selected['project_id']
    project_id = selected['project_id']
    assert len(client.get('/api/projects', headers=people['brand']['headers']).json()) == 1
    assert act(floor, call, 'select', entry_id).json()['project_id'] == project_id  # Retry is safe.
    public = client.get(f'/api/opencall/{call["id"]}').json()
    assert public['project_id'] is None and public['entries'][0]['evaluation']['score'] == 80
    creator = client.get(f'/api/opencall/{call["id"]}', headers=people['creator']['headers']).json()
    assert creator['project_id'] == project_id
    workspace = client.get(f'/api/projects/{project_id}/workspace', headers=people['brand']['headers']).json()
    assert workspace['workflow']['opencall']['entry_id'] == entry_id
    assert client.get(f'/api/briefs/{brief["id"]}', headers=people['brand']['headers']).json()['status'] == 'closed'
    # The reusable helper submits 9:16 images, so use an explicit 4:5 delivery here.
    base = f'/api/projects/{project_id}'
    def workflow(who, action, **kwargs):
        headers = people[who]['headers']
        revision = client.get(base+'/workspace', headers=headers).json()['workflow_revision']
        response = client.post(base+'/workflow', headers=headers, json={'action': action, 'revision': revision, **kwargs})
        assert response.status_code == 200, response.text
        return response.json()
    workflow('brand', 'terms', amount_paise=10000, licensing=LICENSE, notes='One approved image with the agreed worldwide usage and handoff.')
    workflow('creator', 'accept_terms')
    asset = client.post(base+'/assets', headers=people['creator']['headers'], files={'file': ('final.png', image(), 'image/png')}).json()
    workflow('creator', 'submit', title='OpenCall concept refined', notes='Final image with the agreed handoff and licensing requirements.', asset_token=asset['asset_token'])
    workflow('brand', 'revise', version=1, notes='Please clarify the production and handoff details for this image.')
    workflow('creator', 'start_revision', version=1)
    workflow('creator', 'submit', title='Refined handoff version', notes='Handoff notes expanded; the image itself remains unchanged.', asset_token=asset['asset_token'])
    workflow('brand', 'approve', version=2)
    assert client.get(base+'/workspace', headers=people['brand']['headers']).json()['status'] == 'completed'


def test_community_must_select_top_votes_and_rights_must_fit(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor, 'community'))
    call = submit(floor, call, 'second')
    first, second = [e['id'] for e in call['entries']]
    call = act(floor, call, 'close_submissions').json()
    call = visitor_vote(floor, call, first).json()
    call = act(floor, call, 'close_voting').json()
    assert act(floor, call, 'select', second).status_code == 409
    client.put('/api/me/licensing', headers=people['creator']['headers'], json={**LICENSE, 'territory': 'India'})
    assert act(floor, call, 'select', first).status_code == 409
    assert not client.get('/api/projects', headers=people['brand']['headers']).json()
    client.put('/api/me/licensing', headers=people['creator']['headers'], json=LICENSE)
    assert act(floor, call, 'select', first).status_code == 200


def test_hybrid_requires_all_evaluations_uses_actual_votes(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor, 'hybrid'))
    call = submit(floor, call, 'second')
    first, second = [e['id'] for e in call['entries']]
    call = act(floor, call, 'close_submissions').json()
    call = visitor_vote(floor, call, second).json()
    call = act(floor, call, 'close_voting').json()
    call = act(floor, call, 'evaluate', first, score=90).json()
    assert act(floor, call, 'select', first).status_code == 409
    call = act(floor, call, 'evaluate', second, score=70).json()
    assert [e['score'] for e in call['entries']] == [45, 85]
    assert act(floor, call, 'select', first).status_code == 409
    assert act(floor, call, 'select', second).status_code == 200


def test_stale_writes_fail_without_overwriting(floor):
    client, people, _ = floor
    call = launch(floor)
    submitted = submit(floor, call)
    assert act(floor, call, 'close_submissions').status_code == 409
    current = client.get(f'/api/opencall/{call["id"]}').json()
    assert current['entry_count'] == 1 and current['phase'] == 'submissions'
    stale_row = store.one('opencalls', {'id': call['id']})
    assert act(floor, submitted, 'close_submissions').status_code == 200
    with pytest.raises(Exception) as failure:
        opencall.save(stale_row, {**stale_row['state'], 'votes': {'fake': 'lost'}})
    assert failure.value.status_code == 409
    assert not store.one('opencalls', {'id': call['id']})['state']['votes']


def test_withdraw_hide_and_cancel_remove_public_access(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor))
    first = call['entries'][0]
    assert act(floor, call, 'withdraw', first['id'], who='second').status_code == 404
    call = act(floor, call, 'withdraw', first['id'], who='creator').json()
    assert client.get(first['media']['url']).status_code == 404
    assert client.get(f'/api/opencall/{call["id"]}').json()['entries'] == []
    call = submit(floor, call, 'second')
    second = next(e for e in call['entries'] if e['status'] == 'submitted')
    call = act(floor, call, 'hide', second['id']).json()
    assert client.get(second['media']['url']).status_code == 404
    call = act(floor, call, 'cancel').json()
    assert call['phase'] == 'cancelled'
    assert act(floor, call, 'close_submissions').status_code == 409


def test_deadlines_enforced_on_server_and_regular_accept_blocked(floor):
    client, people, brief = floor
    call = launch(floor, 'community')
    applied = client.post(f'/api/briefs/{brief["id"]}/apply', headers=people['creator']['headers'], json={'note': 'I am interested in this product image campaign.'}).json()
    response = client.post(f'/api/applications/{applied["id"]}/accept', headers=people['brand']['headers'])
    assert response.status_code == 409 and 'OpenCall' in response.json()['detail']
    row = store.one('opencalls', {'id': call['id']})
    state = row['state']
    state['submission_deadline'] = (opencall.now()-timedelta(hours=1)).isoformat()
    opencall.save(row, state)
    assert client.get(f'/api/opencall/{call["id"]}').json()['phase'] == 'voting'
    response = client.post(f'/api/opencall/{call["id"]}/entries', headers=people['creator']['headers'], data={'title': 'Too late', 'description': 'A concept submitted after the deadline.', 'tools': 'Image', 'workflow': 'A documented original production workflow.', 'consent': 'true'}, files={'file': ('a.png', image(), 'image/png')})
    assert response.status_code == 409


def test_selection_rolls_back_if_project_creation_fails(floor, monkeypatch):
    client, people, brief = floor
    call = submit(floor, launch(floor))
    entry_id = call['entries'][0]['id']
    call = act(floor, call, 'close_submissions').json()
    call = act(floor, call, 'evaluate', entry_id).json()
    def fail(*args):
        raise ValueError('Simulated database failure')
    monkeypatch.setattr(opencall, 'transition_local', fail)
    with pytest.raises(ValueError):
        act(floor, call, 'select', entry_id)
    assert not store.all_rows('projects') and not store.all_rows('applications')
    assert store.one('opencalls', {'id': call['id']})['state']['status'] == 'judging'


def test_two_simultaneous_winner_selections_create_only_one_project(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor))
    call = submit(floor, call, 'second')
    first, second = [e['id'] for e in call['entries']]
    call = act(floor, call, 'close_submissions').json()
    call = act(floor, call, 'evaluate', first).json()
    call = act(floor, call, 'evaluate', second).json()
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda entry_id: act(floor, call, 'select', entry_id), [first, second]))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert len(store.all_rows('projects')) == 1
    assert len([a for a in store.all_rows('applications') if a['status'] == 'accepted']) == 1
    saved = store.one('opencalls', {'id': call['id']})['state']
    assert saved['project_id'] == store.all_rows('projects')[0]['id']


def test_community_ties_allow_either_leader_with_recorded_reason(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor, 'community'))
    call = submit(floor, call, 'second')
    first, second = [e['id'] for e in call['entries']]
    call = act(floor, call, 'close_submissions').json()
    call = visitor_vote(floor, call, first, new=True).json()
    call = visitor_vote(floor, call, second, new=True).json()
    call = act(floor, call, 'close_voting').json()
    assert act(floor, call, 'select', second, note='Too short').status_code == 422
    result = act(floor, call, 'select', second, note='Both concepts received one vote; this composition best supports our campaign direction.')
    assert result.status_code == 200, result.text
    assert result.json()['winner_id'] == second


def test_launch_rejects_wrong_owner_missing_consent_and_invalid_dates(floor):
    client, people, brief = floor
    payload = {'brief_id': brief['id'], 'mode': 'brand', 'submission_deadline': (opencall.now()+timedelta(days=1)).isoformat(),
               'voting_deadline': (opencall.now()+timedelta(days=2)).isoformat(), 'rules': 'Unpaid concept participation. A final scope and license will be agreed with the selected creator.', 'public_consent': True}
    assert client.post('/api/opencall', headers=people['other']['headers'], json=payload).status_code == 404
    assert client.post('/api/opencall', headers=people['brand']['headers'], json={**payload, 'public_consent': False}).status_code == 422
    assert client.post('/api/opencall', headers=people['brand']['headers'], json={**payload, 'voting_deadline': payload['submission_deadline']}).status_code == 422
    assert client.post('/api/opencall', headers=people['brand']['headers'], json={**payload, 'submission_deadline': '2020-01-01T12:00:00+00:00'}).status_code == 422
    call = launch(floor)
    assert client.post('/api/opencall', headers=people['brand']['headers'], json=payload).status_code == 409


def test_invalid_voter_cookie_cannot_vote_and_hidden_entries_cannot_win(floor):
    client, people, _ = floor
    call = submit(floor, launch(floor, 'community'))
    entry_id = call['entries'][0]['id']
    call = act(floor, call, 'close_submissions').json()
    client.cookies.clear()
    client.cookies.set(opencall.COOKIE, 'forged-cookie')
    assert client.post(f'/api/opencall/{call["id"]}/vote', headers={'X-Crevo-Vote': '1'}, json={'entry_id': entry_id}).status_code == 422
    call = visitor_vote(floor, call, entry_id, new=True).json()
    call = act(floor, call, 'hide', entry_id).json()
    assert call['vote_count'] == 0
    call = act(floor, call, 'close_voting').json()
    assert act(floor, call, 'select', entry_id).status_code == 409


def test_uninstalled_hosted_extension_keeps_regular_application_flow(floor, monkeypatch):
    client, people, brief = floor
    original = store.all_rows
    def uninstalled(table, filters=None, order=None):
        if table == 'opencalls':
            raise APIError({'code': 'PGRST205', 'message': 'Table missing', 'details': None, 'hint': None})
        return original(table, filters, order)
    monkeypatch.setattr(store, 'all_rows', uninstalled)
    response = client.get('/api/opencall')
    assert response.status_code == 503 and 'not enabled' in response.json()['detail']
    application = client.post(f'/api/briefs/{brief["id"]}/apply', headers=people['creator']['headers'], json={'note': 'I would like to create original imagery for this campaign.'}).json()
    response = client.post(f'/api/applications/{application["id"]}/accept', headers=people['brand']['headers'])
    assert response.status_code == 200, response.text


def test_upload_crossing_submission_deadline_is_not_published(floor, monkeypatch):
    client, people, _ = floor
    call = launch(floor)
    original = opencall.inspect_bytes
    def slow_inspection(raw):
        metadata = original(raw)
        monkeypatch.setattr(opencall, 'now', lambda: datetime.fromisoformat(call['voting_deadline']) + timedelta(seconds=1))
        return metadata
    monkeypatch.setattr(opencall, 'inspect_bytes', slow_inspection)
    response = client.post(f'/api/opencall/{call["id"]}/entries', headers=people['creator']['headers'],
                           data={'title': 'Late upload', 'description': 'A creative concept uploaded just before the deadline.', 'tools': 'Image tool', 'workflow': 'A documented workflow with original material and handoff.', 'consent': 'true'},
                           files={'file': ('a.png', image(), 'image/png')})
    assert response.status_code == 409 and 'uploading' in response.json()['detail']
    assert not store.one('opencalls', {'id': call['id']})['state']['entries']


def test_preview_restart_preserves_creator_offer_and_brand_edits(floor):
    from run_opencall_local import seed
    client, people, _ = floor
    creator = people['creator']['creator']
    store.update('creators', creator['id'], {'licensing': {**LICENSE, 'territory': 'India'}, 'title': 'My actual production studio'})
    # The launcher uses its own named accounts; create them once, then edit them.
    seed(store.DB_PATH, 'local-private-password')
    account = store.one('users', {'email': 'creator@gmail.com'})
    preview_creator = store.one('creators', {'owner_id': account['id']})
    store.update('creators', preview_creator['id'], {'licensing': {**LICENSE, 'territory': 'India'}, 'title': 'My actual production studio'})
    brand = store.one('users', {'email': 'brand@gmail.com'})
    store.update('users', brand['id'], {'company_name': 'My actual brand'})
    seed(store.DB_PATH, 'local-private-password')
    assert store.one('creators', {'id': preview_creator['id']})['licensing']['territory'] == 'India'
    assert store.one('creators', {'id': preview_creator['id']})['title'] == 'My actual production studio'
    assert store.one('users', {'id': brand['id']})['company_name'] == 'My actual brand'
