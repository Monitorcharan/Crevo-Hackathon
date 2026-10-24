"""Persistent atomic quotas: Supabase for hosted traffic, SQLite for local use."""
import hashlib
import ipaddress
import logging
import os
import time
from fastapi import HTTPException
import store

ENABLED = True


def consume(scope, identity, limit, seconds):
    if not ENABLED:
        return
    key = hashlib.sha256((scope + ':' + identity).encode()).hexdigest()
    now = time.time()
    retry = max(1, seconds - int(now) % seconds)
    try:
        if store.REMOTE:
            result = store.admin.rpc('consume_rate_limit', {'p_key': key, 'p_limit': limit, 'p_window': seconds}).execute().data
            allowed = result['allowed']
            retry = result['retry_after']
        else:
            bucket = key + ':' + str(int(now) // seconds)
            with store.connect() as db:
                db.execute('delete from request_limits where expires_at < ?', (int(now),))
                row = db.execute('''insert into request_limits(bucket,hits,expires_at) values(?,1,?)
                    on conflict(bucket) do update set hits=hits+1 where hits < ? returning hits''',
                    (bucket, int(now) + retry, limit)).fetchone()
                allowed = row is not None
    except Exception as exc:
        logging.error('Rate limit storage unavailable: type=%s', type(exc).__name__)
        raise HTTPException(503, 'This action is temporarily unavailable. Please try again shortly.')
    if not allowed:
        raise HTTPException(429, 'Too many requests. Please wait before trying again.', headers={'Retry-After': str(retry)})


def client_ip(request):
    # Render terminates public ingress at its managed proxy. Ignore forwarding
    # headers entirely outside that environment; email/account quotas also apply.
    candidate = request.client.host if request.client else 'unknown'
    if os.getenv('RENDER') == 'true':
        chain = request.headers.get('x-forwarded-for', '').split(',')
        if chain and chain[-1].strip():
            candidate = chain[-1].strip()
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return 'unknown'


def auth_ip(request):
    path = request.url.path
    if request.method != 'POST' or not path.startswith('/api/auth/'):
        return
    limit, seconds = (12, 600) if path.endswith('/register') else (120, 300) if path.endswith('/refresh') else (40, 300)
    consume('auth-ip:' + path, client_ip(request), limit, seconds)
    consume('auth-global', 'all', 1000, 600)


def ai_request(request, user):
    path = request.url.path
    paid = path in ('/api/assistant/chat', '/api/me/portfolio', '/api/briefs/draft') or (
        path.startswith('/api/briefs/') and path.endswith(('/matches', '/agent')))
    if not paid:
        return
    consume('ai-user-minute', user['id'], 6, 60)
    consume('ai-user-hour', user['id'], 30, 3600)
    consume('ai-global-hour', 'all', 120, 3600)
