"""Avoid terminated shared HTTP/2 streams; retry reads without replaying writes."""
import httpx
from supabase.lib.client_options import SyncClientOptions


class SupabaseHTTPClient(httpx.Client):
    def __init__(self, **options):
        options.setdefault('http2', False)
        options.setdefault('timeout', httpx.Timeout(20, connect=5, pool=5))
        options.setdefault('limits', httpx.Limits(max_connections=24, max_keepalive_connections=8, keepalive_expiry=5))
        super().__init__(**options)

    def send(self, request, **options):
        attempts = 2 if request.method in ('GET', 'HEAD') and not options.get('stream') else 1
        for attempt in range(attempts):
            try:
                return super().send(request, **options)
            except (httpx.NetworkError, httpx.TimeoutException, httpx.RemoteProtocolError):
                if attempt + 1 == attempts:
                    raise


def client_options():
    return SyncClientOptions(auto_refresh_token=False, persist_session=False, flow_type='implicit',
                             httpx_client=SupabaseHTTPClient())
