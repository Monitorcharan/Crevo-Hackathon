import concurrent.futures
import time
from types import SimpleNamespace
import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
import main
import store
import rate_limits
from security_config import signing_keys


def test_signing_keys_reject_defaults_and_separate_token_purposes(monkeypatch):
    monkeypatch.delenv('ASSET_SIGNING_SECRET', raising=False)
    monkeypatch.delenv('RENDER', raising=False)
    monkeypatch.delenv('CREVO_REQUIRE_SUPABASE', raising=False)
    monkeypatch.setenv('LOCAL_JWT_SECRET', 'replace-me-for-any-shared-environment')
    with pytest.raises(RuntimeError):
        signing_keys(False, '')
    first, asset = signing_keys(True, 'a-server-only-credential-' + 'x' * 40)
    assert first != 'replace-me-for-any-shared-environment' and first != asset
    monkeypatch.delenv('LOCAL_JWT_SECRET')
    one, a = signing_keys(False, '')
    two, b = signing_keys(False, '')
    assert one != two and one != a and two != b
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(jwt.encode({'sub': 'victim', 'exp': time.time() + 60}, 'replace-me-for-any-shared-environment', algorithm='HS256'), one, algorithms=['HS256'])


def test_hosted_admin_requires_a_configured_id_and_verified_identity(monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(main, 'ADMIN_USER_IDS', {'trusted-id'})
    assert not main.is_admin({'id': 'attacker', 'email': 'admin@example.com', '_identity_verified': True})
    assert not main.is_admin({'id': 'trusted-id', 'email': 'admin@example.com', '_identity_verified': False})
    assert main.is_admin({'id': 'trusted-id', 'email': 'admin@example.com', '_identity_verified': True})
    assert not main.auth_result({'id': 'trusted-id', 'email': 'admin@example.com'}, None)['is_admin']


def test_existing_firebase_account_cannot_skip_verified_email(monkeypatch):
    monkeypatch.setattr(main.firebase_identity, 'verify_id_token', lambda _: {'sub': 'existing', 'email': 'admin@example.com', 'email_verified': False})
    monkeypatch.setattr(store, 'one', lambda *args: pytest.fail('Must reject before looking up a privileged account'))
    with pytest.raises(HTTPException) as result:
        main.firebase_sign_in(main.FirebaseExchange(id_token='x' * 120))
    assert result.value.status_code == 422


def test_pending_signup_does_not_reserve_a_marketplace_profile(monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(store, 'one', lambda *a, **k: None)
    monkeypatch.setattr(store, 'insert', lambda *a, **k: pytest.fail('Unverified signup must not create public records'))
    identity = SimpleNamespace(id='pending-id', email='new@example.com', identities=[{}], email_confirmed_at=None)
    monkeypatch.setattr(main, 'public_auth_client', lambda: SimpleNamespace(auth=SimpleNamespace(
        sign_up=lambda credentials: SimpleNamespace(user=identity, session=None))))
    result = main.register(main.Register(email=identity.email, name='New Member', password='A-long-test-password!', role='creator'))
    assert result['email_confirmation_required'] and result['user'] is None and not result['is_admin']
    with pytest.raises(HTTPException) as error:
        main.hosted_profile(identity)
    assert error.value.status_code == 401


def test_verified_first_login_materializes_only_a_normal_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'verified-profile.db')
    store.init_local()
    identity = SimpleNamespace(id='new-verified-id', email='confirmed@example.com', email_confirmed_at='2026-10-24',
        user_metadata={'crevo_profile': {'name': 'Confirmed Member', 'role': 'creator', 'company_name': ''}})
    # SQLite fixtures require a password column; hosted profiles do not store one.
    original_insert = store.insert
    def insert(table, fields):
        return original_insert(table, {**fields, **({'password_hash': 'not-a-local-password'} if table == 'users' else {})})
    monkeypatch.setattr(store, 'insert', insert)
    user = main.hosted_profile(identity)
    assert user['role'] == 'creator' and user['id'] == identity.id
    assert store.one('creators', {'owner_id': identity.id})
    assert main.hosted_profile(identity)['id'] == user['id']
    assert not main.is_admin(user)


def test_public_profile_and_nested_gig_do_not_expose_identity_or_email(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'privacy.db')
    with TestClient(main.app) as client:
        def register(name, role):
            result = client.post('/api/auth/register', json={'name': name, 'email': name.lower() + '@example.com', 'password': 'A-long-test-password!', 'role': role, 'company_name': 'Test Brand'})
            assert result.status_code == 200
            return {'Authorization': 'Bearer ' + result.json()['access_token']}
        creator = register('Creator', 'creator')
        brand = register('Brand', 'brand')
        profile = client.get('/api/me', headers=creator).json()['creator']
        store.update('creators', profile['id'], {'contact_email': 'private-contact@example.com'})
        for url in ('/api/creators', '/api/creators/' + profile['id']):
            result = client.get(url).json()
            entries = result if isinstance(result, list) else [result]
            assert all('owner_id' not in item and 'contact_email' not in item for item in entries)
        gig = store.insert('portfolio_items', {'creator_id': profile['id'], 'title': 'Test service', 'description': 'Test offer',
                   'media_url': 'https://example.com/cover.png', 'media_type': 'gig', 'tools': [], 'workflow': '', 'format': '',
                   'commercial_use': '', 'verification': 'self-reported'})
        nested = client.get('/api/gigs/' + gig['id']).json()['creator']
        assert 'owner_id' not in nested and 'contact_email' not in nested
        contact = '/api/creators/' + profile['id'] + '/contact-details'
        assert client.get(contact).status_code == 401
        assert client.get(contact, headers=creator).status_code == 403
        assert client.get(contact, headers=brand).json()['contact_email'] == 'private-contact@example.com'


def test_persistent_quota_is_atomic_under_concurrent_requests(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'quotas.db')
    monkeypatch.setattr(rate_limits, 'ENABLED', True)
    store.init_local()
    def attempt(_):
        try:
            rate_limits.consume('test', 'same-identity', 3, 3600)
            return 200
        except HTTPException as error:
            assert error.headers.get('Retry-After')
            return error.status_code
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(attempt, range(12)))
    assert statuses.count(200) == 3 and statuses.count(429) == 9


def test_local_login_ip_limit_runs_before_password_checks(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'ip-limit.db')
    monkeypatch.setattr(rate_limits, 'ENABLED', True)
    with TestClient(main.app) as client:
        results = [client.post('/api/auth/login', json={}) for _ in range(41)]
        assert results[-1].status_code == 429 and results[-1].headers['Retry-After']


def test_ai_quota_is_shared_between_endpoints_and_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'ai-limit.db')
    monkeypatch.setattr(rate_limits, 'ENABLED', True)
    store.init_local()
    for index in range(6):
        request = Request({'type': 'http', 'method': 'POST', 'path': '/api/assistant/chat' if index % 2 else '/api/briefs/draft', 'headers': []})
        rate_limits.ai_request(request, {'id': 'paid-user'})
    with pytest.raises(HTTPException) as result:
        rate_limits.ai_request(request, {'id': 'paid-user'})
    assert result.value.status_code == 429
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(store, 'admin', SimpleNamespace(rpc=lambda *a, **k: (_ for _ in ()).throw(RuntimeError('offline'))))
    with pytest.raises(HTTPException) as result:
        rate_limits.consume('ai', 'another-user', 3, 60)
    assert result.value.status_code == 503


def test_hosted_demo_credentials_and_existing_tokens_are_rejected(monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', True)
    for email in ('brand.demo.crevo@example.com', 'creator.demo.crevo@example.com'):
        with pytest.raises(HTTPException) as result:
            main.login(main.Credentials(email=email, password='A-former-public-password!'))
        assert result.value.status_code == 403
        with pytest.raises(HTTPException):
            main.ensure_active({'email': email})
