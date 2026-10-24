"""Regressions for provider signup failures and expiring hosted sessions."""
import logging
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from supabase_auth.errors import AuthApiError

import main
import store


def hosted(monkeypatch, auth):
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(main, 'public_auth_client', lambda: SimpleNamespace(auth=auth))


@pytest.mark.parametrize('code,status,fragment', [
    ('over_email_send_rate_limit', 429, 'email service limit'),
    ('email_address_invalid', 422, 'real email address'),
    ('email_address_not_authorized', 503, 'not available for this address'),
    ('email_provider_disabled', 503, 'temporarily unavailable'),
    ('weak_password', 422, 'stronger password'),
    ('user_already_exists', 409, 'already registered'),
])
def test_signup_provider_errors_do_not_write_profiles(monkeypatch, caplog, code, status, fragment):
    def fail(_):
        raise AuthApiError('PRIVATE-email@example.com PRIVATE-password PRIVATE-token', status, code)
    hosted(monkeypatch, SimpleNamespace(sign_up=fail))
    monkeypatch.setattr(store, 'one', lambda *args: None)
    monkeypatch.setattr(store, 'insert', lambda *args: pytest.fail('Provider failure must not write a profile'))
    with caplog.at_level(logging.WARNING), pytest.raises(HTTPException) as error:
        main.register(main.Register(email='new@example.com', password='Strong-password-123!', name='New Creator', role='creator'))
    assert error.value.status_code == status
    assert fragment in error.value.detail
    assert 'PRIVATE' not in caplog.text + error.value.detail
    if status == 429:
        assert error.value.headers['Retry-After'] == '3600'


def test_confirmed_signup_redirect_and_session_are_preserved(monkeypatch):
    session = SimpleNamespace(access_token='access', refresh_token='refresh', expires_at=2000000000)
    received = []
    def signup(data):
        received.append(data)
        return SimpleNamespace(user=SimpleNamespace(id='new-user', identities=['email']), session=session)
    hosted(monkeypatch, SimpleNamespace(sign_up=signup))
    monkeypatch.setattr(store, 'one', lambda *args: None)
    writes = []
    def insert(table, values):
        writes.append((table, values))
        return {'id': 'new-user', **values}
    monkeypatch.setattr(store, 'insert', insert)
    monkeypatch.setenv('RENDER_EXTERNAL_URL', 'https://crevo-hackathon.onrender.com')
    monkeypatch.delenv('PUBLIC_APP_URL', raising=False)
    result = main.register(main.Register(email='New@example.com', password='Strong-password-123!', name='New Creator', role='creator'))
    assert received[0]['options']['email_redirect_to'] == 'https://crevo-hackathon.onrender.com/login'
    assert received[0]['email'] == 'new@example.com'
    assert [t for t, _ in writes] == ['users', 'creators']
    assert result['refresh_token'] == 'refresh' and result['expires_at'] == 2000000000
    assert result['email_confirmation_required'] is False


def test_email_verification_remains_required_and_fake_users_are_rejected(monkeypatch):
    identity = SimpleNamespace(id='new-user', identities=['email'])
    hosted(monkeypatch, SimpleNamespace(sign_up=lambda data: SimpleNamespace(user=identity, session=None)))
    monkeypatch.setattr(store, 'one', lambda *args: None)
    monkeypatch.setattr(store, 'insert', lambda table, values: {'id': 'new-user', **values})
    data = main.Register(email='new@example.com', password='Strong-password-123!', name='New Brand', company_name='New Studio', role='brand')
    result = main.register(data)
    assert result['email_confirmation_required'] is True and result['access_token'] is None
    assert 'refresh_token' not in result
    identity.identities = []
    monkeypatch.setattr(store, 'insert', lambda *args: pytest.fail('Never create profiles for obfuscated Auth identities'))
    with pytest.raises(HTTPException) as error:
        main.register(data)
    assert error.value.status_code == 409


def test_unconfirmed_login_and_rotating_refresh_tokens(monkeypatch):
    user = {'id': 'hosted-user', 'role': 'brand', 'email': 'brand@example.com'}
    def unconfirmed(_):
        raise AuthApiError('Email not confirmed', 400, 'email_not_confirmed')
    auth = SimpleNamespace(sign_in_with_password=unconfirmed)
    hosted(monkeypatch, auth)
    monkeypatch.setattr(store, 'one', lambda *args: user)
    with pytest.raises(HTTPException) as error:
        main.login(main.Credentials(email=user['email'], password='Strong-password-123!'))
    assert error.value.status_code == 403 and 'Confirm your email' in error.value.detail
    session = SimpleNamespace(access_token='new-access', refresh_token='rotated-refresh', expires_at=2000000000)
    def refresh(value):
        assert value == 'original-refresh'
        return SimpleNamespace(user=SimpleNamespace(id=user['id'], email=user['email'], email_confirmed_at='2026-10-24'), session=session)
    auth.refresh_session = refresh
    result = main.refresh_auth(main.RefreshSession(refresh_token='original-refresh'))
    assert result['access_token'] == 'new-access' and result['refresh_token'] == 'rotated-refresh'
    monkeypatch.setattr(store, 'one', lambda *args: None)
    with pytest.raises(HTTPException) as error:
        main.refresh_auth(main.RefreshSession(refresh_token='original-refresh'))
    assert error.value.status_code == 409 and 'marketplace profile' in error.value.detail


def test_auth_clients_do_not_persist_or_auto_refresh_server_sessions(monkeypatch):
    seen = {}
    def create(url, key, options):
        seen['options'] = options
        return 'client'
    monkeypatch.setattr(main, 'create_client', create)
    assert main.public_auth_client() == 'client'
    assert seen['options'].auto_refresh_token is False
    assert seen['options'].persist_session is False
    assert seen['options'].flow_type == 'implicit'


@pytest.mark.parametrize('code', ['validation_failed', 'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found'])
def test_invalid_refresh_is_not_reported_as_a_temporary_outage(monkeypatch, code):
    def refresh(_):
        raise AuthApiError('Private upstream diagnostic', 400, code)
    hosted(monkeypatch, SimpleNamespace(refresh_session=refresh))
    with pytest.raises(HTTPException) as error:
        main.refresh_auth(main.RefreshSession(refresh_token='invalid-test-refresh'))
    assert error.value.status_code == 401
    assert 'log in again' in error.value.detail
