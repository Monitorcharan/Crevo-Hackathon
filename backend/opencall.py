"""Public creative challenges; private voter identities and atomic winner handoff."""
import copy
import hashlib
import hmac
import json
import sqlite3
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import jwt
from fastapi import Depends, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator
from postgrest.exceptions import APIError

import rate_limits
import store
from delivery_checks import MAX_BYTES, inspect_bytes
from engagements import transition_local
from matching import license_check
from security_config import signing_keys

_, _asset_key = signing_keys(store.REMOTE, store.SECRET_KEY)
VOTER_KEY = hmac.new(_asset_key.encode(), b'crevo:opencall-voter:v1', hashlib.sha256).hexdigest()
COOKIE = 'crevo_opencall_visitor'
MAX_ENTRIES, MAX_VOTES = 200, 10000


def call_rows(filters=None, order=None, optional=False):
    try:
        return store.all_rows('opencalls', filters, order)
    except APIError as exc:
        if exc.code in ('42P01', 'PGRST205'):
            if optional:
                return []
            raise HTTPException(503, 'OpenCall is not enabled on this workspace yet.')
        raise


def find_for_brief(brief_id):
    rows = call_rows({'brief_id': brief_id}, optional=True)
    return rows[0] if rows else None


def now():
    return datetime.now(timezone.utc)


class Launch(BaseModel):
    brief_id: str = Field(min_length=1, max_length=100)
    mode: Literal['brand', 'community', 'hybrid']
    submission_deadline: datetime
    voting_deadline: datetime
    rules: str = Field(min_length=30, max_length=2500)
    public_consent: bool

    @model_validator(mode='after')
    def dates(self):
        if self.submission_deadline.tzinfo is None or self.voting_deadline.tzinfo is None:
            raise ValueError('Deadlines must include a time zone.')
        if not now() < self.submission_deadline < self.voting_deadline <= now() + timedelta(days=180):
            raise ValueError('Choose a future submission deadline, then a later judging deadline, within 180 days.')
        if not self.public_consent or len(self.rules.strip()) < 30:
            raise ValueError('Confirm public publication and describe the participation terms.')
        return self


class Action(BaseModel):
    revision: int = Field(ge=0)
    action: Literal['close_submissions', 'close_voting', 'evaluate', 'select', 'hide', 'withdraw', 'cancel']
    entry_id: str = Field(default='', max_length=100)
    score: int = Field(default=0, ge=0, le=100)
    note: str = Field(default='', max_length=2000)


class Vote(BaseModel):
    entry_id: str = Field(min_length=1, max_length=100)


def phase(state):
    if state['status'] in ('selected', 'cancelled'):
        return state['status']
    if state['status'] == 'judging' or now() >= datetime.fromisoformat(state['voting_deadline']):
        return 'judging'
    if state['status'] == 'voting' or now() >= datetime.fromisoformat(state['submission_deadline']):
        return 'judging' if state['mode'] == 'brand' else 'voting'
    return 'submissions'


def get_call(call_id):
    rows = call_rows({'id': call_id})
    row = rows[0] if rows else None
    brief = store.one('briefs', {'id': row['brief_id']}) if row else None
    owner = store.one('users', {'id': row['owner_id']}) if row else None
    if not row or not brief or not owner or owner.get('disabled_at'):
        raise HTTPException(404, 'OpenCall not found')
    return row


def active_entries(state):
    return [e for e in state['entries'] if e['status'] == 'submitted' and store.one('creators', {'id': e['creator_id']})]


def rankings(state):
    entries = active_entries(state)
    counts = Counter(state['votes'].values())
    maximum = max((counts[e['id']] for e in entries), default=0)
    result = []
    for entry in entries:
        public = counts[entry['id']]
        evaluation = state['evaluations'].get(entry['id'])
        brand = evaluation['score'] if evaluation else None
        score = public if state['mode'] == 'community' else brand if state['mode'] == 'brand' else (
            .5 * brand + .5 * (100 * public / maximum if maximum else 0) if brand is not None else None)
        result.append({'id': entry['id'], 'votes': public, 'brand_score': brand, 'score': round(score, 4) if score is not None else None})
    return sorted(result, key=lambda r: (-(r['score'] if r['score'] is not None else -1), r['id']))


def assert_winner(state, entry_id):
    ranked = rankings(state)
    chosen = next((r for r in ranked if r['id'] == entry_id), None)
    if not chosen:
        raise HTTPException(409, 'Choose an available, visible submission.')
    if state['mode'] != 'community' and chosen['brand_score'] is None:
        raise HTTPException(409, 'Evaluate this submission before selecting it.')
    if state['mode'] == 'community' and not chosen['votes']:
        raise HTTPException(409, 'Community selection requires at least one vote.')
    if state['mode'] == 'hybrid' and any(r['brand_score'] is None for r in ranked):
        raise HTTPException(409, 'Evaluate every visible submission before combined selection.')
    if state['mode'] in ('community', 'hybrid') and chosen['score'] != ranked[0]['score']:
        raise HTTPException(409, 'This mode requires selecting a top-ranked submission. Ties are decided by the brand.')


def save(row, state):
    """Compare-and-swap prevents duplicate votes, lost entries and late writes."""
    if store.REMOTE:
        rows = store.admin.table('opencalls').update({'state': state, 'revision': row['revision'] + 1}).eq('id', row['id']).eq('revision', row['revision']).execute().data
        saved = store.normalize(rows[0], 'opencalls') if rows else None
    else:
        with store.connect() as db:
            updated = db.execute('update opencalls set state=?,revision=revision+1 where id=? and revision=? returning *',
                                 (json.dumps(state), row['id'], row['revision'])).fetchone()
            saved = store.normalize(updated, 'opencalls')
    if not saved:
        raise HTTPException(409, 'This OpenCall changed. Refresh it and try again.')
    return saved


def voter_id(request, response=None):
    token = request.cookies.get(COOKIE, '')
    visitor = None
    try:
        claims = jwt.decode(token, VOTER_KEY, algorithms=['HS256'], audience='crevo-opencall', options={'require': ['sub', 'exp']})
        visitor = claims['sub']
    except jwt.InvalidTokenError:
        pass
    if visitor is None and response is not None:
        visitor = uuid.uuid4().hex
        token = jwt.encode({'sub': visitor, 'aud': 'crevo-opencall', 'exp': now() + timedelta(days=180)}, VOTER_KEY, algorithm='HS256')
        response.set_cookie(COOKIE, token, max_age=180 * 86400, httponly=True, secure=request.url.scheme == 'https', samesite='lax', path='/api/opencall')
    return visitor


def vote_key(call_id, visitor):
    return hmac.new(VOTER_KEY.encode(), f'{call_id}:{visitor}'.encode(), hashlib.sha256).hexdigest() if visitor else None


def public_view(row, user=None, visitor=None, include_entries=True):
    state = row['state']
    owner = bool(user and user['id'] == row['owner_id'])
    current_phase = phase(state)
    ranks = {r['id']: r for r in rankings(state)} if include_entries else {}
    entries = []
    for e in state['entries'] if include_entries else []:
        creator = store.one('creators', {'id': e['creator_id']})
        if not creator or (e['status'] != 'submitted' and not owner and not (user and creator['owner_id'] == user['id'])):
            continue
        rank = ranks.get(e['id'], {'votes': 0, 'score': None, 'brand_score': None})
        revealed = owner or current_phase == 'selected'
        entries.append({k: e[k] for k in ('id', 'creator_id', 'title', 'description', 'tools', 'workflow', 'status', 'created_at', 'media', 'moderation_note') if k in e} | {
            'creator': {'name': creator['name'], 'avatar_url': creator.get('avatar_url')},
            'votes': rank['votes'], 'score': rank['score'] if revealed else None,
            'evaluation': state['evaluations'].get(e['id']) if revealed else None,
            'mine': bool(user and creator['owner_id'] == user['id']),
            'licensing': license_check(state['brief'].get('licensing'), creator.get('licensing')) if owner else None})
    project_id = state.get('project_id')
    winner = next((e for e in state['entries'] if e['id'] == state.get('winner_id')), None)
    winner_creator = store.one('creators', {'id': winner['creator_id']}) if winner else None
    member = owner or bool(user and winner_creator and winner_creator['owner_id'] == user['id'])
    return {'id': row['id'], 'brief_id': row['brief_id'], 'revision': row['revision'], 'created_at': row['created_at'],
            **{k: state[k] for k in ('brief', 'brand', 'mode', 'rules', 'submission_deadline', 'voting_deadline')},
            'phase': current_phase, 'owned': owner, 'entry_count': len(active_entries(state)),
            'vote_count': sum(r['votes'] for r in rankings(state)), 'entries': entries,
            'my_vote': state['votes'].get(vote_key(row['id'], visitor)),
            'winner_id': state.get('winner_id'), 'selection_note': state.get('selection_note'),
            'cancel_note': state.get('cancel_note'), 'project_id': project_id if member else None,
            'events': [{k: v for k, v in event.items() if k != 'actor_id'} for event in state['events']]}


def select_local(row, state, entry, user):
    """Winner + application + project either commit together, or all roll back."""
    with store.connect() as db:
        db.execute('begin immediate')
        current = db.execute('select revision from opencalls where id=?', (row['id'],)).fetchone()
        if not current or current['revision'] != row['revision']:
            raise HTTPException(409, 'This OpenCall changed. Refresh before selecting.')
        if db.execute('select id from projects where brief_id=?', (row['brief_id'],)).fetchone():
            raise HTTPException(409, 'This brief already has a project. Refresh its status.')
        application = db.execute('select * from applications where brief_id=? and creator_id=?', (row['brief_id'], entry['creator_id'])).fetchone()
        if not application:
            application_id = str(uuid.uuid4())
            db.execute('insert into applications(id,brief_id,creator_id,note,status) values(?,?,?,?,?)',
                       (application_id, row['brief_id'], entry['creator_id'], 'Selected through OpenCall: ' + entry['title'], 'pending'))
        else:
            application_id = application['id']
            if application['status'] != 'pending':
                raise HTTPException(409, 'The selected creator has a prior application decision. Choose a fresh brief.')
        project = transition_local(db, application_id, user['id'], 'accepted')
        workflow = project['workflow']
        workflow['opencall'] = {'id': row['id'], 'entry_id': entry['id'], 'title': entry['title'], 'preview_url': entry['media']['url']}
        db.execute('update projects set workflow=? where id=?', (json.dumps(workflow), project['id']))
        state['project_id'] = project['id']
        db.execute('update opencalls set state=?,revision=revision+1 where id=?', (json.dumps(state), row['id']))
        db.execute("update briefs set status='closed' where id=?", (row['brief_id'],))
    return get_call(row['id'])


def register(app, current_user):
    def optional_user(request: Request, authorization: str = Header(default='')):
        return current_user(request, authorization) if authorization else None

    @app.get('/api/opencall')
    def listing(user=Depends(optional_user)):
        rows = []
        for row in reversed(call_rows(order='created_at')):
            try:
                get_call(row['id'])
                rows.append(public_view(row, user, include_entries=False))
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
        return rows

    @app.post('/api/opencall')
    def launch(data: Launch, user=Depends(current_user)):
        if user['role'] != 'brand':
            raise HTTPException(403, 'Only brands can launch an OpenCall.')
        brief = store.one('briefs', {'id': data.brief_id})
        if not brief or brief['owner_id'] != user['id']:
            raise HTTPException(404, 'Brief not found')
        if brief['status'] != 'open' or store.all_rows('projects', {'brief_id': brief['id']}):
            raise HTTPException(409, 'Choose an open brief without an existing project.')
        if find_for_brief(brief['id']):
            raise HTTPException(409, 'This brief already has an OpenCall.')
        rate_limits.consume('opencall-launch', user['id'], 10, 3600)
        fields = ('title', 'description', 'category', 'skills', 'platforms', 'budget', 'content_type', 'style', 'format', 'deliverables', 'deadline', 'revision_rounds', 'licensing', 'commercial_use', 'required_tools', 'duration_seconds')
        state = {'brief': {k: brief.get(k) for k in fields}, 'brand': {'name': user.get('company_name') or user['name'], 'logo_url': user.get('logo_url')},
                 'mode': data.mode, 'rules': data.rules.strip(), 'submission_deadline': data.submission_deadline.isoformat(),
                 'voting_deadline': data.voting_deadline.isoformat(), 'status': 'submissions', 'entries': [], 'votes': {}, 'evaluations': {},
                 'events': [{'action': 'launched', 'at': now().isoformat(), 'note': 'Public brief and selection rules published.'}]}
        try:
            row = store.insert('opencalls', {'brief_id': brief['id'], 'owner_id': user['id'], 'state': state, 'revision': 0})
        except (sqlite3.IntegrityError, APIError) as exc:
            if isinstance(exc, sqlite3.IntegrityError) or exc.code == '23505':
                raise HTTPException(409, 'This brief already has an OpenCall.')
            if exc.code in ('42P01', 'PGRST205'):
                raise HTTPException(503, 'OpenCall is not enabled on this workspace yet.')
            raise
        return public_view(row, user)

    @app.get('/api/opencall/{call_id}')
    def detail(call_id: str, request: Request, response: Response, user=Depends(optional_user)):
        row = get_call(call_id)
        visitor = voter_id(request, response)
        response.headers['Cache-Control'] = 'no-store'
        return public_view(row, user, visitor)

    @app.post('/api/opencall/{call_id}/entries')
    async def submit(call_id: str, file: UploadFile = File(...), title: str = Form(..., min_length=3, max_length=140),
                     description: str = Form(..., min_length=20, max_length=2000), tools: str = Form(..., min_length=2, max_length=500),
                     workflow: str = Form(..., min_length=20, max_length=2000), consent: bool = Form(False), user=Depends(current_user)):
        row = get_call(call_id)
        creator = store.one('creators', {'owner_id': user['id']}) if user['role'] == 'creator' else None
        if not creator:
            raise HTTPException(403, 'A registered creator profile is required.')
        if not consent:
            raise HTTPException(422, 'Confirm that you can publicly share this work and accept the participation terms.')
        if phase(row['state']) != 'submissions':
            raise HTTPException(409, 'Submissions are closed.')
        if any(e['creator_id'] == creator['id'] for e in row['state']['entries']):
            raise HTTPException(409, 'One submission per creator. Your entry is already recorded.')
        if len(row['state']['entries']) >= MAX_ENTRIES:
            raise HTTPException(409, 'This OpenCall has reached its 200-entry capacity.')
        if len(title.strip()) < 3 or min(len(description.strip()), len(workflow.strip())) < 20 or not tools.strip():
            raise HTTPException(422, 'Describe your concept, tools and production workflow.')
        rate_limits.consume('opencall-upload', user['id'], 10, 3600)
        raw = await file.read(MAX_BYTES + 1)
        metadata = inspect_bytes(raw)
        if phase(row['state']) != 'submissions':
            raise HTTPException(409, 'Submissions closed while your file was uploading. Your entry was not published.')
        entry_id = uuid.uuid4().hex
        path = f'{row["id"]}/{entry_id}'
        folder = Path(store.DB_PATH).parent / 'opencall-media' / row['id']
        if store.REMOTE:
            store.admin.storage.from_('crevo-opencall').upload(path, raw, {'content-type': metadata['mime']})
        else:
            folder.mkdir(parents=True, exist_ok=True)
            (folder / entry_id).write_bytes(raw)
        state = copy.deepcopy(row['state'])
        state['entries'].append({'id': entry_id, 'creator_id': creator['id'], 'title': title.strip(), 'description': description.strip(),
                                 'tools': [s.strip() for s in tools.split(',') if s.strip()][:20], 'workflow': workflow.strip(),
                                 'status': 'submitted', 'created_at': now().isoformat(),
                                 'media': {**metadata, 'url': f'/api/opencall/{row["id"]}/media/{entry_id}'}})
        try:
            if phase(state) != 'submissions':
                raise HTTPException(409, 'Submissions closed while your file was uploading. Your entry was not published.')
            saved = save(row, state)
        except HTTPException:
            if store.REMOTE:
                store.admin.storage.from_('crevo-opencall').remove([path])
            else:
                (folder / entry_id).unlink(missing_ok=True)
            raise
        return public_view(saved, user)

    @app.get('/api/opencall/{call_id}/media/{entry_id}')
    def media(call_id: str, entry_id: str):
        row = get_call(call_id)
        entry = next((e for e in active_entries(row['state']) if e['id'] == entry_id), None)
        if not entry:
            raise HTTPException(404, 'Public submission not found')
        headers = {'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'}
        if store.REMOTE:
            raw = store.admin.storage.from_('crevo-opencall').download(f'{row["id"]}/{entry_id}')
            return Response(raw, media_type=entry['media']['mime'], headers=headers)
        path = Path(store.DB_PATH).parent / 'opencall-media' / row['id'] / entry['id']
        if not path.is_file():
            raise HTTPException(404, 'Preview file not found')
        return FileResponse(path, media_type=entry['media']['mime'], headers=headers)

    @app.post('/api/opencall/{call_id}/vote')
    def vote(call_id: str, data: Vote, request: Request, user=Depends(optional_user)):
        if request.headers.get('x-crevo-vote') != '1':
            raise HTTPException(403, 'Vote from the OpenCall page.')
        row = get_call(call_id)
        if phase(row['state']) != 'voting' or row['state']['mode'] == 'brand':
            raise HTTPException(409, 'Community voting is not open.')
        visitor = voter_id(request)
        if not visitor:
            raise HTTPException(422, 'Enable cookies and reload this page before voting.')
        if not any(e['id'] == data.entry_id for e in active_entries(row['state'])):
            raise HTTPException(404, 'Submission not found')
        creator = store.one('creators', {'owner_id': user['id']}) if user and user['role'] == 'creator' else None
        participating = bool(creator and any(e['creator_id'] == creator['id'] for e in row['state']['entries']))
        if user and (user['id'] == row['owner_id'] or participating):
            raise HTTPException(403, 'Participating creators and the host brand cannot cast signed-in votes.')
        rate_limits.consume('opencall-vote-ip', rate_limits.client_ip(request), 60, 600)
        rate_limits.consume('opencall-vote-browser', visitor, 20, 600)
        state = copy.deepcopy(row['state'])
        key = vote_key(call_id, visitor)
        if key not in state['votes'] and len(state['votes']) >= MAX_VOTES:
            raise HTTPException(409, 'This OpenCall has reached its visitor vote capacity.')
        if state['votes'].get(key) != data.entry_id:
            state['votes'][key] = data.entry_id
            row = save(row, state)
        return public_view(row, user, visitor)

    @app.post('/api/opencall/{call_id}/actions')
    def action(call_id: str, data: Action, user=Depends(current_user)):
        rate_limits.consume('opencall-action', user['id'], 90, 600)
        row = get_call(call_id)
        state = copy.deepcopy(row['state'])
        if data.action == 'select' and state.get('winner_id') == data.entry_id and user['id'] == row['owner_id']:
            return public_view(row, user)
        if data.revision != row['revision']:
            raise HTTPException(409, 'This OpenCall changed. Refresh it before continuing.')
        if len(state['events']) >= 1500:
            raise HTTPException(409, 'This OpenCall has reached its activity capacity. Contact the host before continuing.')
        entry = next((e for e in state['entries'] if e['id'] == data.entry_id), None)
        owner = user['id'] == row['owner_id'] and user['role'] == 'brand'
        if data.action == 'withdraw':
            creator = store.one('creators', {'owner_id': user['id']})
            if not entry or not creator or entry['creator_id'] != creator['id']:
                raise HTTPException(404, 'Your submission was not found.')
            if phase(state) != 'submissions' or entry['status'] != 'submitted':
                raise HTTPException(409, 'Withdraw only while submissions are open.')
            entry['status'] = 'withdrawn'
        else:
            if not owner:
                raise HTTPException(403, 'Only the host brand can manage this OpenCall.')
            if phase(state) in ('selected', 'cancelled'):
                raise HTTPException(409, 'This OpenCall has finished.')
            if data.action == 'close_submissions':
                if phase(state) != 'submissions':
                    raise HTTPException(409, 'Submissions have already closed.')
                state['status'] = 'judging' if state['mode'] == 'brand' else 'voting'
            elif data.action == 'close_voting':
                if phase(state) != 'voting':
                    raise HTTPException(409, 'Voting is not open.')
                state['status'] = 'judging'
            elif data.action == 'evaluate':
                if state['mode'] == 'community' or phase(state) != 'judging' or not entry or entry['status'] != 'submitted':
                    raise HTTPException(409, 'Brand evaluation requires a visible entry in the judging phase.')
                if len(data.note.strip()) < 20:
                    raise HTTPException(422, 'Explain your evaluation in at least 20 characters.')
                state['evaluations'][entry['id']] = {'score': data.score, 'note': data.note.strip(), 'at': now().isoformat()}
            elif data.action in ('hide', 'cancel'):
                if len(data.note.strip()) < 20:
                    raise HTTPException(422, 'Give a public reason of at least 20 characters.')
                if data.action == 'hide':
                    if not entry or entry['status'] != 'submitted':
                        raise HTTPException(404, 'Visible submission not found')
                    entry['status'], entry['moderation_note'] = 'hidden', data.note.strip()
                else:
                    state['status'], state['cancel_note'] = 'cancelled', data.note.strip()
            elif data.action == 'select':
                if phase(state) != 'judging':
                    raise HTTPException(409, 'Close submissions and voting before selecting a winner.')
                assert_winner(state, data.entry_id)
                if len(data.note.strip()) < 20:
                    raise HTTPException(422, 'Explain the selection, including any tie decision, in at least 20 characters.')
                brief = store.one('briefs', {'id': row['brief_id']})
                creator = store.one('creators', {'id': entry['creator_id']})
                creator_user = store.one('users', {'id': creator['owner_id']}) if creator else None
                if not creator_user or creator_user.get('disabled_at'):
                    raise HTTPException(409, 'This creator is no longer available.')
                if brief.get('licensing') and license_check(brief['licensing'], creator.get('licensing'))['status'] != 'compatible':
                    raise HTTPException(409, 'The creator’s declared usage rights must cover the brief before selection.')
                state.update(status='selected', winner_id=entry['id'], selection_note=data.note.strip())
        state['events'].append({'action': data.action, 'entry_id': data.entry_id or None, 'at': now().isoformat(),
                                'note': data.note.strip() if data.action != 'evaluate' else 'Brand evaluation recorded.', 'actor_id': user['id']})
        if data.action == 'select':
            if store.REMOTE:
                # Server-only RPC locks the OpenCall and creates its project in one transaction.
                try:
                    store.admin.rpc('select_opencall_winner', {'p_call_id': row['id'], 'p_owner_id': user['id'],
                                    'p_revision': row['revision'], 'p_entry_id': entry['id'], 'p_state': state}).execute()
                except Exception:
                    raise HTTPException(409, 'Selection could not be completed. Refresh to check whether it succeeded before retrying.')
                row = get_call(row['id'])
            else:
                row = select_local(row, state, entry, user)
        else:
            row = save(row, state)
        return public_view(row, user)
