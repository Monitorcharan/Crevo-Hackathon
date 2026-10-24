from types import SimpleNamespace
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError, AuthRetryableError
import main
import store
from supabase_transport import SupabaseHTTPClient, client_options


@pytest.mark.parametrize('failure', [httpx.RemoteProtocolError, httpx.ReadTimeout])
def test_transient_reads_retry_once_including_response_body(failure):
    calls = []
    class BrokenBody(httpx.SyncByteStream):
        def __iter__(self):
            raise failure('PRIVATE upstream details')
            yield b''
    def handler(request):
        calls.append(request.method)
        return httpx.Response(200, stream=BrokenBody()) if len(calls) == 1 else httpx.Response(200, json={'ok': True})
    with SupabaseHTTPClient(transport=httpx.MockTransport(handler)) as client:
        assert client.get('https://example.com/rest/v1/briefs').json() == {'ok': True}
        assert calls == ['GET', 'GET']


@pytest.mark.parametrize('method', ['POST', 'PATCH', 'PUT', 'DELETE'])
def test_uncertain_writes_are_never_replayed(method):
    calls = []
    def handler(request):
        calls.append(request.method)
        raise httpx.RemoteProtocolError('Server disconnected after possible commit')
    with SupabaseHTTPClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.request(method, 'https://example.com/rest/v1/projects', json={'action': 'submit'})
    assert calls == [method]


def test_retry_exhaustion_is_bounded_and_http2_is_disabled():
    calls = []
    def handler(request):
        calls.append(request.method)
        raise httpx.RemoteProtocolError('Connection terminated')
    with SupabaseHTTPClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.get('https://example.com/rest/v1/briefs')
    assert len(calls) == 2
    options = client_options()
    assert options.httpx_client._transport._pool._http2 is False
    assert not options.auto_refresh_token and not options.persist_session
    options.httpx_client.close()


def test_upstream_disconnect_is_503_and_never_clears_a_valid_session(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'connection.db')
    with TestClient(main.app) as client:
        def fail(*args, **kwargs):
            raise httpx.RemoteProtocolError('PRIVATE connection metadata')
        monkeypatch.setattr(store, 'all_rows', fail)
        response = client.get('/api/creators')
        assert response.status_code == 503 and response.headers['Retry-After'] == '2'
        assert 'PRIVATE' not in response.text and 'try again' in response.json()['detail']
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(store, 'admin', SimpleNamespace(auth=SimpleNamespace(get_user=fail)))
    with pytest.raises(HTTPException) as error:
        main.current_user(authorization='Bearer opaque-session-token')
    assert error.value.status_code == 503
    assert 'PRIVATE' not in error.value.detail


def test_public_auth_connections_are_closed_even_on_failure(monkeypatch):
    closed = []
    def fail(_):
        raise httpx.RemoteProtocolError('Server disconnected')
    client = SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=fail), options=SimpleNamespace(httpx_client=SimpleNamespace(close=lambda: closed.append(True))))
    monkeypatch.setattr(main, 'public_auth_client', lambda: client)
    with pytest.raises(httpx.RemoteProtocolError):
        main.public_auth_request('sign_in_with_password', {'email': 'brand@example.com'})
    assert closed == [True]


@pytest.mark.parametrize('failure', [AuthRetryableError('PRIVATE upstream failure', 503), AuthApiError('PRIVATE upstream failure', 502, None)])
def test_temporary_auth_service_errors_preserve_sessions(monkeypatch, failure):
    def fail(_):
        raise failure
    monkeypatch.setattr(store, 'REMOTE', True)
    monkeypatch.setattr(store, 'admin', SimpleNamespace(auth=SimpleNamespace(get_user=fail)))
    with pytest.raises(HTTPException) as error:
        main.current_user(authorization='Bearer valid-session-token')
    assert error.value.status_code == 503 and 'PRIVATE' not in error.value.detail
