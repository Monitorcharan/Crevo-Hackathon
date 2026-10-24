"""Versioned project workflow. Payments are explicitly simulated, never charged."""
import copy
import json
import uuid
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Literal
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse, Response
import jwt
from pydantic import BaseModel, Field
import store
from matching import LicenseTerms, license_check
from delivery_checks import inspect_bytes, check_delivery, requires_checked_file, MAX_BYTES

ASSET_SECRET = os.getenv('LOCAL_JWT_SECRET') or os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY') or uuid.uuid4().hex


class WorkflowAction(BaseModel):
    revision: int = Field(ge=0)
    action: Literal['terms', 'accept_terms', 'payment', 'submit', 'revise', 'approve', 'production', 'start_revision']
    amount_paise: int = Field(default=0, ge=0, le=100000000)
    outcome: Literal['success', 'failed', 'cancelled'] = 'cancelled'
    method: Literal['UPI', 'Card', 'Netbanking'] = 'UPI'
    title: str = Field(default='', max_length=160)
    url: str = Field(default='', max_length=2000)
    notes: str = Field(default='', max_length=5000)
    version: int = Field(default=0, ge=0)
    licensing: LicenseTerms | None = None
    asset_token: str = Field(default='', max_length=8000)


def register(app, current_user, permitted_project):
    @app.post('/api/projects/{project_id}/assets')
    async def upload(project_id: str, file: UploadFile = File(...), user=Depends(current_user)):
        project = permitted_project(project_id, user)
        if user['id'] == project['brand_id']:
            raise HTTPException(403, 'Only the creator can upload deliveries.')
        if project['status'] == 'completed':
            raise HTTPException(409, 'This project is already completed.')
        raw = await file.read(MAX_BYTES + 1)
        metadata = inspect_bytes(raw)
        brief = store.one('briefs', {'id': project['brief_id']})
        result = check_delivery(metadata, brief)
        if not result['passed']:
            return {**result, 'asset_token': None}
        asset_id = uuid.uuid4().hex
        if store.REMOTE:
            path = f"{project_id}/{asset_id}"
            store.admin.storage.from_('crevo-deliveries').upload(path, raw, {'content-type': metadata['mime']})
        else:
            folder = Path(store.DB_PATH).parent / 'deliveries' / project_id
            folder.mkdir(parents=True, exist_ok=True)
            (folder / asset_id).write_bytes(raw)
        url = f'/api/projects/{project_id}/files/{asset_id}'
        asset = {'project_id': project_id, 'asset_id': asset_id, 'url': url, 'filename': (file.filename or 'delivery')[:200], 'checks': result,
                 'exp': datetime.now(timezone.utc) + timedelta(hours=24), 'purpose': 'delivery_asset'}
        return {**result, 'asset_token': jwt.encode(asset, ASSET_SECRET, algorithm='HS256'), 'filename': asset['filename']}

    @app.get('/api/projects/{project_id}/files/{asset_id}')
    def download(project_id: str, asset_id: str, user=Depends(current_user)):
        permitted_project(project_id, user)
        if len(asset_id) != 32 or any(x not in '0123456789abcdef' for x in asset_id):
            raise HTTPException(404, 'File not found')
        if store.REMOTE:
            try:
                raw = store.admin.storage.from_('crevo-deliveries').download(f'{project_id}/{asset_id}')
            except Exception:
                raise HTTPException(404, 'File not found')
            return Response(content=raw, media_type='application/octet-stream', headers={'Content-Disposition': 'attachment; filename="crevo-delivery"'})
        path = Path(store.DB_PATH).parent / 'deliveries' / project_id / asset_id
        if not path.is_file():
            raise HTTPException(404, 'File not found')
        return FileResponse(path, media_type='application/octet-stream', filename='crevo-delivery')

    @app.get('/api/projects/{project_id}/workspace')
    def workspace(project_id: str, user=Depends(current_user)):
        project = permitted_project(project_id, user)
        brief = store.one('briefs', {'id': project['brief_id']})
        return {**project, 'brief': brief, 'requires_checked_file': requires_checked_file(brief),
                'creator': store.one('creators', {'id': project['creator_id']})}

    @app.post('/api/projects/{project_id}/workflow')
    def act(project_id: str, data: WorkflowAction, user=Depends(current_user)):
        project = permitted_project(project_id, user)
        revision = project.get('workflow_revision', 0)
        if revision != data.revision:
            raise HTTPException(409, 'This project changed. Refresh and try again.')
        state = copy.deepcopy(project.get('workflow') or {})
        brand = user['id'] == project['brand_id']
        now = datetime.now(timezone.utc).isoformat()
        status = project['status']
        deliveries = state.setdefault('deliveries', [])
        terms = state.get('terms')
        brief = store.one('briefs', {'id': project['brief_id']})
        payment = state.get('payment', {})
        if data.action in ('terms', 'payment', 'revise', 'approve') and not brand:
            raise HTTPException(403, 'Only the project brand can do this.')
        if data.action in ('accept_terms', 'submit', 'production', 'start_revision') and brand:
            raise HTTPException(403, 'Only the project creator can do this.')
        if status == 'completed' and data.action != 'payment':
            raise HTTPException(409, 'This project is already completed.')
        if data.action == 'terms':
            if terms and terms.get('accepted_at'):
                raise HTTPException(409, 'Accepted terms cannot be changed.')
            if not data.amount_paise or not data.notes.strip():
                raise HTTPException(422, 'Add a positive INR amount and the agreed deliverables and usage terms.')
            state['terms'] = {'amount_paise': data.amount_paise, 'currency': 'INR',
                              'scope': data.notes.strip(), 'proposed_at': now, 'proposed_by': user['id'],
                              'deadline': brief.get('deadline'), 'revision_rounds': brief.get('revision_rounds'),
                              'licensing': data.licensing.model_dump() if data.licensing else brief.get('licensing'),
                              'brief_requirements': brief.get('licensing'), 'commercial_use': brief.get('commercial_use', '')}
            if not state['terms']['licensing']:
                raise HTTPException(422, 'Add structured licensing terms for the creator to confirm.')
            if brief.get('licensing') and license_check(brief['licensing'], state['terms']['licensing'])['status'] != 'compatible':
                raise HTTPException(422, 'The proposed usage rights must cover the brief requirements.')
            state['stage'] = 'scope_pending'
        elif data.action == 'accept_terms':
            if not terms or terms.get('accepted_at'):
                raise HTTPException(409, 'No new terms to accept.')
            terms.update(accepted_at=now, accepted_by=user['id'])
            state['stage'] = 'production'
            state['licensing_snapshot'] = {'requirements': terms.get('brief_requirements'), 'agreed': terms.get('licensing'),
                                           'commercial_use': terms.get('commercial_use'), 'confirmed_by': user['id'], 'confirmed_at': now}
        elif data.action in ('production', 'start_revision'):
            if not terms or not terms.get('accepted_at'):
                raise HTTPException(409, 'Accept the scope and license before production.')
            if data.action == 'start_revision':
                if not deliveries or deliveries[-1]['status'] != 'revision_requested':
                    raise HTTPException(409, 'No revision is awaiting work.')
                deliveries[-1].update(status='revision_in_progress', revision_status='in_progress', revision_started_at=now, revision_started_by=user['id'])
            elif deliveries:
                raise HTTPException(409, 'Production status cannot replace an active review or revision.')
            state['stage'] = 'revision_in_progress' if data.action == 'start_revision' else 'production'
        elif data.action == 'payment':
            if not terms or not terms.get('accepted_at'):
                raise HTTPException(409, 'The creator must accept the INR terms first.')
            if payment.get('status') == 'demo_succeeded':
                raise HTTPException(409, 'The demo payment is already complete.')
            attempts = state.setdefault('payment_attempts', [])
            if len(attempts) >= 100:
                raise HTTPException(409, 'Demo attempt limit reached.')
            payment = {'id': 'demo_' + uuid.uuid4().hex[:16], 'mode': 'simulation',
                       'status': 'demo_succeeded' if data.outcome == 'success' else 'demo_' + data.outcome,
                       'method': data.method, 'amount_paise': terms['amount_paise'],
                       'currency': 'INR', 'created_at': now, 'actor_id': user['id']}
            attempts.append(payment)
            state['payment'] = payment
        elif data.action == 'submit':
            if not terms or not terms.get('accepted_at'):
                raise HTTPException(409, 'Confirm the scope and licensing agreement before submitting work.')
            if deliveries and deliveries[-1]['status'] not in ('revision_requested', 'revision_in_progress'):
                raise HTTPException(409, 'Wait for feedback before submitting another version.')
            asset = None
            if data.asset_token:
                try:
                    asset = jwt.decode(data.asset_token, ASSET_SECRET, algorithms=['HS256'])
                    if asset['project_id'] != project_id or asset['purpose'] != 'delivery_asset' or not asset['checks']['passed']:
                        raise ValueError('Wrong asset')
                    if not check_delivery(asset['checks']['metadata'], brief)['passed']:
                        raise ValueError('Brief requirements changed')
                except (jwt.PyJWTError, ValueError, KeyError):
                    raise HTTPException(422, 'Upload the delivery again; the file check expired or does not belong to this project.')
            else:
                if requires_checked_file(brief):
                    raise HTTPException(422, 'Upload the actual file so Crevo can check the brief’s delivery requirements.')
                url = urlsplit(data.url.strip())
                if url.scheme != 'https' or not url.hostname or url.username or url.password:
                    raise HTTPException(422, 'Use a public HTTPS delivery link without embedded credentials.')
            if not data.title.strip() or not data.notes.strip():
                raise HTTPException(422, 'Add a title and delivery notes, including tools and usage rights.')
            if len(deliveries) >= 100:
                raise HTTPException(409, 'Delivery version limit reached.')
            if deliveries:
                deliveries[-1].update(status='superseded', revision_status='submitted', revised_in_version=len(deliveries) + 1)
            deliveries.append({'version': len(deliveries) + 1, 'title': data.title.strip(),
                               'url': asset['url'] if asset else data.url.strip(), 'notes': data.notes.strip(),
                               'asset': {k: v for k, v in asset.items() if k not in ('exp', 'purpose')} if asset else None,
                               'checks': asset['checks'] if asset else {'passed': None, 'checks': [], 'source': 'External link; manual review required'},
                               'responds_to_version': deliveries[-1]['version'] if deliveries else None,
                               'submitted_at': now, 'submitted_by': user['id'], 'status': 'awaiting_review'})
            state['stage'] = 'in_review'
        elif data.action in ('revise', 'approve'):
            if not deliveries or deliveries[-1]['version'] != data.version or deliveries[-1]['status'] != 'awaiting_review':
                raise HTTPException(409, 'Only the latest delivery awaiting review can be reviewed.')
            if data.action == 'revise' and not data.notes.strip():
                raise HTTPException(422, 'Describe the changes you need.')
            deliveries[-1].update(status='approved' if data.action == 'approve' else 'revision_requested',
                                  feedback=data.notes.strip(), reviewed_at=now, reviewed_by=user['id'])
            if data.action == 'revise':
                deliveries[-1]['revision_status'] = 'requested'
            elif len(deliveries) > 1:
                deliveries[-2]['revision_status'] = 'approved'
            if data.action == 'approve':
                status = 'completed'
            state['stage'] = 'completed' if data.action == 'approve' else 'revision_requested'
        state.setdefault('events', []).append({'action': data.action, 'actor_id': user['id'], 'at': now, 'version': data.version or (deliveries[-1]['version'] if deliveries else None)})
        values = {'workflow': state, 'workflow_revision': revision + 1, 'status': status}
        if store.REMOTE:
            rows = store.admin.table('projects').update(values).eq('id', project_id).eq('workflow_revision', revision).execute().data
            saved = bool(rows)
        else:
            with store.connect() as db:
                saved = db.execute('update projects set workflow=?, workflow_revision=?, status=? where id=? and workflow_revision=?',
                                   (json.dumps(state), revision + 1, status, project_id, revision)).rowcount == 1
        if not saved:
            raise HTTPException(409, 'This project changed. Refresh and try again.')
        return {**project, **values}
