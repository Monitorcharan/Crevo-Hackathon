"""Purpose-separated signing keys with no shared development default."""
import hashlib
import hmac
import os
import secrets

KNOWN_DEFAULTS = {'replace-me-for-any-shared-environment', 'changeme', 'secret', 'change-me'}


def strong_secret(value):
    return bool(value and len(value) >= 32 and value.lower() not in KNOWN_DEFAULTS and not value.lower().startswith('replace-me'))


def signing_keys(remote, server_secret):
    hosted = bool(os.getenv('RENDER') or os.getenv('CREVO_REQUIRE_SUPABASE') == '1')
    local = os.getenv('LOCAL_JWT_SECRET', '')
    if not remote and local and not strong_secret(local):
        raise RuntimeError('LOCAL_JWT_SECRET must be a fresh random secret of at least 32 characters')
    if not remote and hosted and not strong_secret(local):
        raise RuntimeError('A shared local deployment requires LOCAL_JWT_SECRET')
    session = local if strong_secret(local) else secrets.token_urlsafe(48)
    explicit = os.getenv('ASSET_SIGNING_SECRET', '')
    if explicit and not strong_secret(explicit):
        raise RuntimeError('ASSET_SIGNING_SECRET must be a fresh random secret of at least 32 characters')
    if explicit:
        asset = explicit
    elif remote:
        if not strong_secret(server_secret):
            raise RuntimeError('A strong server credential is required for private deliveries')
        asset = hmac.new(server_secret.encode(), b'crevo:delivery-assets:v2', hashlib.sha256).hexdigest()
    else:
        asset = hmac.new(session.encode(), b'crevo:delivery-assets:v2', hashlib.sha256).hexdigest()
    return session, asset
