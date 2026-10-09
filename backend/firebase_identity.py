"""Verify Firebase client ID tokens using Google's published signing certificates."""

import os
import re
import time

import httpx
import jwt
from cryptography import x509

CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', '')
_certs = {}
_expires = 0


class FirebaseIdentityError(ValueError):
    pass


def configured():
    return bool(PROJECT_ID and os.getenv('FIREBASE_API_KEY') and os.getenv('FIREBASE_APP_ID'))


def public_config():
    if not configured():
        return {'enabled': False, 'providers': []}
    providers = [x.strip() for x in os.getenv('FIREBASE_AUTH_PROVIDERS', '').split(',') if x.strip() in {'google', 'apple', 'facebook'}]
    return {'enabled': bool(providers), 'providers': providers, 'firebase': {
        'apiKey': os.environ['FIREBASE_API_KEY'],
        'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN') or f'{PROJECT_ID}.firebaseapp.com',
        'projectId': PROJECT_ID,
        'appId': os.environ['FIREBASE_APP_ID'],
    }}


def verify_id_token(token):
    global _certs, _expires
    if not PROJECT_ID:
        raise FirebaseIdentityError('Firebase sign-in is not configured')
    try:
        header = jwt.get_unverified_header(token)
        if header.get('alg') != 'RS256' or not header.get('kid'):
            raise FirebaseIdentityError('Invalid Firebase token header')
        if time.time() >= _expires or header['kid'] not in _certs:
            response = httpx.get(CERT_URL, timeout=10)
            response.raise_for_status()
            _certs = response.json()
            match = re.search(r'max-age=(\d+)', response.headers.get('cache-control', ''))
            _expires = time.time() + (int(match.group(1)) if match else 300)
        certificate = _certs.get(header['kid'])
        if not certificate:
            raise FirebaseIdentityError('Unknown Firebase signing key')
        key = x509.load_pem_x509_certificate(certificate.encode()).public_key()
        claims = jwt.decode(token, key, algorithms=['RS256'], audience=PROJECT_ID,
                            issuer=f'https://securetoken.google.com/{PROJECT_ID}',
                            options={'require': ['exp', 'iat', 'aud', 'iss', 'sub', 'auth_time']})
        if (not claims.get('sub') or len(claims['sub']) > 128 or
                claims.get('auth_time', 0) > time.time() or
                claims.get('firebase', {}).get('sign_in_provider') not in {'google.com', 'facebook.com', 'apple.com'}):
            raise FirebaseIdentityError('Unsupported Firebase identity')
        return claims
    except FirebaseIdentityError:
        raise
    except (jwt.PyJWTError, ValueError, KeyError, httpx.HTTPError) as exc:
        raise FirebaseIdentityError('Invalid or expired Firebase session') from exc
