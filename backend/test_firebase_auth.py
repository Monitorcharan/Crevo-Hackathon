import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient

import firebase_identity
import main
import store


def test_firebase_exchange_and_account_link(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'REMOTE', False)
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'firebase.db')
    monkeypatch.setattr(firebase_identity, 'PROJECT_ID', 'crevo-test')

    def make_token(uid, email):
        return jwt.encode({'iss': 'https://securetoken.google.com/crevo-test', 'sub': uid,
                           'email': email, 'email_verified': True, 'name': 'Social Creator',
                           'firebase': {'sign_in_provider': 'google.com'},
                           'padding': 'a' * 150}, 'test-secret-long-enough-for-hs256-key-material', algorithm='HS256')

    monkeypatch.setattr(firebase_identity, 'verify_id_token', lambda token: jwt.decode(token, options={'verify_signature': False}))
    existing_token = make_token('firebase-existing', 'existing@example.com')
    new_token = make_token('firebase-new', 'new@example.com')
    with TestClient(main.app) as client:
        existing = client.post('/api/auth/register', json={'name': 'Email User', 'company_name': 'Existing Studio', 'email': 'existing@example.com', 'password': 'strong-password', 'role': 'brand'}).json()
        assert client.post('/api/auth/firebase', json={'id_token': existing_token, 'role': 'brand'}).status_code == 409
        linked = client.post('/api/auth/firebase/link', headers={'Authorization': f"Bearer {existing['access_token']}"}, json={'id_token': existing_token})
        assert linked.status_code == 200 and linked.json()['linked']
        me = client.get('/api/me', headers={'Authorization': f'Bearer {existing_token}'})
        assert me.status_code == 200 and me.json()['user']['id'] == existing['user']['id']
        created = client.post('/api/auth/firebase', json={'id_token': new_token, 'role': 'creator'})
        assert created.status_code == 200, created.text
        assert created.json()['user']['firebase_uid'] == 'firebase-new'
        assert client.get('/api/me', headers={'Authorization': f'Bearer {new_token}'}).json()['creator']['owner_id'] == created.json()['user']['id']
        assert client.post('/api/auth/firebase', json={'id_token': new_token}).status_code == 200


def test_firebase_signature_audience_and_provider(monkeypatch):
    monkeypatch.setattr(firebase_identity, 'PROJECT_ID', 'crevo-test')
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'test')])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
            .not_valid_after(datetime.now(timezone.utc) + timedelta(days=1)).sign(key, hashes.SHA256()))
    monkeypatch.setattr(firebase_identity, '_certs', {'test-key': cert.public_bytes(serialization.Encoding.PEM).decode()})
    monkeypatch.setattr(firebase_identity, '_expires', time.time() + 3600)
    claims = {'iss': 'https://securetoken.google.com/crevo-test', 'aud': 'crevo-test',
              'sub': 'uid-123', 'iat': int(time.time()), 'exp': int(time.time()) + 300,
              'auth_time': int(time.time()), 'email': 'person@example.com', 'email_verified': True,
              'firebase': {'sign_in_provider': 'google.com'}}
    token = jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'test-key'})
    assert firebase_identity.verify_id_token(token)['sub'] == 'uid-123'
    with pytest.raises(firebase_identity.FirebaseIdentityError):
        firebase_identity.verify_id_token(jwt.encode({**claims, 'aud': 'other-project'}, key, algorithm='RS256', headers={'kid': 'test-key'}))
    with pytest.raises(firebase_identity.FirebaseIdentityError):
        firebase_identity.verify_id_token(jwt.encode({**claims, 'firebase': {'sign_in_provider': 'anonymous'}}, key, algorithm='RS256', headers={'kid': 'test-key'}))
