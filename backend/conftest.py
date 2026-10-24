"""Tests use isolated SQLite data and never call paid generation services."""
import io
from pathlib import Path
import pytest
from PIL import Image
import main


@pytest.fixture(autouse=True)
def disable_live_ai(monkeypatch):
    monkeypatch.setattr(main, 'AI_PROVIDER', None)


@pytest.fixture
def complete_workflow():
    def complete(client, project_id, brand_headers, creator_headers):
        base = f'/api/projects/{project_id}'
        def action(who, name, **values):
            revision = client.get(base + '/workspace', headers=who).json().get('workflow_revision', 0)
            response = client.post(base + '/workflow', headers=who, json={'action': name, 'revision': revision, **values})
            assert response.status_code == 200, response.text
            return response.json()
        action(brand_headers, 'terms', amount_paise=10000, notes='One final delivery with the agreed commercial usage rights.', licensing={'usage_types': ['paid_social'], 'territory': 'Worldwide', 'duration_months': 6, 'exclusive': False})
        action(creator_headers, 'accept_terms')
        brief = client.get(base + '/workspace', headers=brand_headers).json()['brief']
        if any(x in brief.get('content_type', '').lower() for x in ('video', 'film', 'animation')):
            raw = (Path(__file__).parent / 'fixtures' / 'round2-vertical.mp4').read_bytes()
            file = ('film.mp4', raw, 'video/mp4')
        else:
            out = io.BytesIO()
            Image.new('RGB', (90, 160), '#264b34').save(out, 'PNG')
            file = ('final.png', out.getvalue(), 'image/png')
        upload = client.post(base + '/assets', headers=creator_headers, files={'file': file})
        assert upload.status_code == 200 and upload.json()['passed'], upload.text
        action(creator_headers, 'submit', title='Final delivery', notes='Final work, including the agreed usage rights and handoff notes.', asset_token=upload.json()['asset_token'])
        return action(brand_headers, 'approve', version=1)
    return complete
