import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from supabase import create_client

load_dotenv()
import store

SECRET = os.getenv('LOCAL_JWT_SECRET', 'replace-me-for-any-shared-environment')
AI_KEY = os.getenv('OPENAI_API_KEY', '')
AI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4.1-mini')
GEMINI_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash-lite')
AI_PROVIDER = 'gemini' if GEMINI_KEY else 'openai' if AI_KEY else None


async def generate_ai_text(prompt: str, json_mode: bool = False) -> str:
    async with httpx.AsyncClient(timeout=40) as client:
        if AI_PROVIDER == 'gemini':
            body = {'contents': [{'parts': [{'text': prompt}]}]}
            if json_mode:
                body['generationConfig'] = {'responseMimeType': 'application/json'}
            response = await client.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent',
                headers={'x-goog-api-key': GEMINI_KEY}, json=body,
            )
            response.raise_for_status()
            result = response.json()
            text = ''.join(part.get('text', '') for candidate in result.get('candidates', [])
                           for part in candidate.get('content', {}).get('parts', []))
        elif AI_PROVIDER == 'openai':
            response = await client.post(
                'https://api.openai.com/v1/responses',
                headers={'Authorization': f'Bearer {AI_KEY}'},
                json={'model': AI_MODEL, 'input': prompt},
            )
            response.raise_for_status()
            result = response.json()
            text = ''.join(part.get('text', '') for output in result.get('output', [])
                           for part in output.get('content', []) if part.get('type') == 'output_text')
        else:
            raise ValueError('No AI provider configured')
    if not text.strip():
        raise ValueError('AI provider returned no text')
    return text.strip()


def log_ai_failure(operation, exc):
    """Record a safe upstream error code without logging keys or user prompts."""
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            error = exc.response.json().get('error') or {}
            code = error.get('code') or error.get('type') or 'unknown'
        except (ValueError, AttributeError):
            code = 'unknown'
        logging.warning('%s %s failed: HTTP %s, code=%s', AI_PROVIDER or 'AI', operation, exc.response.status_code, code)
    else:
        logging.warning('%s %s failed: %s', AI_PROVIDER or 'AI', operation, type(exc).__name__)


@asynccontextmanager
async def lifespan(app):
    store.init_local()
    yield


app = FastAPI(title='Crevo API', version='0.1.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(','), allow_methods=['*'], allow_headers=['*'])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Register(Credentials):
    name: str = Field(min_length=2, max_length=80)
    role: str


class CreatorEdit(BaseModel):
    title: str = Field(max_length=120)
    bio: str = Field(max_length=1000)
    location: str = Field(max_length=100)
    categories: list[str] = Field(max_length=8)
    skills: list[str] = Field(max_length=12)
    platforms: list[str] = Field(max_length=8)
    audience: int = Field(ge=0)
    rate: int = Field(ge=0)


class PortfolioItemIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(max_length=1000)
    media_url: str = Field(min_length=8, max_length=1000)
    media_type: str
    tools: list[str] = Field(max_length=15)
    workflow: str = Field(max_length=1000)
    format: str = Field(max_length=100)
    commercial_use: str = Field(max_length=300)


class BriefIn(BaseModel):
    title: str = Field(min_length=4, max_length=140)
    description: str = Field(min_length=20, max_length=3000)
    category: str = Field(min_length=2, max_length=80)
    skills: list[str] = Field(max_length=12)
    platforms: list[str] = Field(max_length=8)
    budget: int = Field(ge=0)
    location: str = Field(max_length=100)
    content_type: str = Field(default='', max_length=100)
    style: str = Field(default='', max_length=200)
    format: str = Field(default='', max_length=100)
    commercial_use: str = Field(default='', max_length=500)


class IdeaIn(BaseModel):
    idea: str = Field(min_length=20, max_length=1000)


class ApplicationIn(BaseModel):
    note: str = Field(min_length=20, max_length=1000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=3000)


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 260000).hex()
    return f'{salt}${digest}'


def verify_password(password, encoded):
    try:
        salt, expected = encoded.split('$')
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 260000).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False


def auth_result(user, token):
    return {'user': user, 'access_token': token, 'mode': 'supabase' if store.REMOTE else 'local'}


def local_token(user_id):
    return jwt.encode({'sub': user_id, 'exp': datetime.now(timezone.utc) + timedelta(days=7)}, SECRET, algorithm='HS256')


def current_user(authorization: str = Header(default='')):
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in to continue')
    token = authorization[7:]
    try:
        if store.REMOTE:
            result = store.admin.auth.get_user(token)
            user_id = result.user.id
        else:
            user_id = jwt.decode(token, SECRET, algorithms=['HS256'])['sub']
        user = store.one('users', {'id': str(user_id)})
        if not user:
            raise HTTPException(401, 'Account not found')
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, 'Invalid or expired session')


def require_role(role):
    def check(user=Depends(current_user)):
        if user['role'] != role:
            raise HTTPException(403, f'{role.title()} account required')
        return user
    return check


@app.get('/api/health')
def health():
    return {'ok': True, 'database': 'supabase' if store.REMOTE else 'local', 'ai_enabled': bool(AI_PROVIDER), 'ai_provider': AI_PROVIDER}


@app.post('/api/auth/register')
def register(data: Register):
    if data.role not in ('creator', 'brand'):
        raise HTTPException(422, 'Choose creator or brand')
    if store.one('users', {'email': data.email.lower()}):
        raise HTTPException(409, 'This email is already registered')
    try:
        if store.REMOTE:
            auth = create_client(store.SUPABASE_URL, store.PUBLIC_KEY).auth.sign_up({'email': data.email.lower(), 'password': data.password})
            if not auth.user:
                raise HTTPException(400, 'Supabase could not create the account')
            user_id = str(auth.user.id)
            access_token = auth.session.access_token if auth.session else None
        else:
            user_id = str(uuid.uuid4())
            access_token = local_token(user_id)
        user_data = {'id': user_id, 'email': data.email.lower(), 'name': data.name.strip(), 'role': data.role}
        if not store.REMOTE:
            user_data['password_hash'] = hash_password(data.password)
        user = store.insert('users', user_data)
        if data.role == 'creator':
            store.insert('creators', {'owner_id': user_id, 'name': user['name'], 'title': 'Creator', 'bio': '', 'location': '', 'categories': [], 'skills': [], 'platforms': [], 'audience': 0, 'rate': 0, 'avatar_url': None, 'portfolio': '', 'portfolio_source': 'manual'})
        return {**auth_result(user, access_token), 'email_confirmation_required': access_token is None}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, 'Could not create account; check Auth and database configuration')


@app.post('/api/auth/login')
def login(data: Credentials):
    user = store.one('users', {'email': data.email.lower()})
    if not user:
        raise HTTPException(401, 'Invalid email or password')
    if store.REMOTE:
        try:
            auth = create_client(store.SUPABASE_URL, store.PUBLIC_KEY).auth.sign_in_with_password({'email': data.email.lower(), 'password': data.password})
            token = auth.session.access_token
        except Exception:
            raise HTTPException(401, 'Invalid email or password')
    else:
        with store.connect() as db:
            row = db.execute('select password_hash from users where id=?', (user['id'],)).fetchone()
        if not row or not verify_password(data.password, row['password_hash']):
            raise HTTPException(401, 'Invalid email or password')
        token = local_token(user['id'])
    return auth_result(user, token)


@app.get('/api/me')
def me(user=Depends(current_user)):
    creator = store.one('creators', {'owner_id': user['id']}) if user['role'] == 'creator' else None
    return {'user': user, 'creator': creator}


@app.get('/api/creators')
def creators(q: str = '', category: str = '', platform: str = ''):
    results = store.all_rows('creators', order='created_at')
    query = q.lower().strip()
    if query:
        results = [c for c in results if query in ' '.join([c['name'],c['title'],c['bio'],c['location'],*c['skills'],*c['categories']]).lower()]
    if category:
        results = [c for c in results if category.lower() in [x.lower() for x in c['categories']]]
    if platform:
        results = [c for c in results if platform.lower() in [x.lower() for x in c['platforms']]]
    return results


@app.get('/api/creators/{creator_id}')
def creator_detail(creator_id: str):
    creator = store.one('creators', {'id': creator_id})
    if not creator:
        raise HTTPException(404, 'Creator not found')
    return creator


@app.get('/api/creators/{creator_id}/portfolio')
def creator_portfolio(creator_id: str):
    if not store.one('creators', {'id': creator_id}):
        raise HTTPException(404, 'Creator not found')
    return store.all_rows('portfolio_items', {'creator_id': creator_id}, order='created_at')


@app.post('/api/me/portfolio/items')
def add_portfolio_item(data: PortfolioItemIn, user=Depends(require_role('creator'))):
    if data.media_type not in ('image', 'video', 'link'):
        raise HTTPException(422, 'Choose image, video, or link')
    if not data.media_url.startswith(('https://', 'http://')):
        raise HTTPException(422, 'Provide a full http or https URL')
    creator = store.one('creators', {'owner_id': user['id']})
    return store.insert('portfolio_items', {'creator_id': creator['id'], **data.model_dump(), 'verification': 'self-reported'})


@app.put('/api/me/creator')
def edit_creator(data: CreatorEdit, user=Depends(require_role('creator'))):
    creator = store.one('creators', {'owner_id': user['id']})
    return store.update('creators', creator['id'], data.model_dump())


@app.post('/api/me/portfolio')
async def generate_portfolio(user=Depends(require_role('creator'))):
    creator = store.one('creators', {'owner_id': user['id']})
    if not creator['bio'].strip() or not creator['skills']:
        raise HTTPException(422, 'Add a bio and skills to your profile first')
    if AI_PROVIDER:
        prompt = f"Write a concise 100-word first-person portfolio introduction for this creator. Use only supplied facts; do not invent clients, awards, metrics, or projects. Name: {creator['name']}. Title: {creator['title']}. Bio: {creator['bio']}. Skills: {', '.join(creator['skills'])}. Categories: {', '.join(creator['categories'])}."
        try:
            text = await generate_ai_text(prompt)
            source = AI_PROVIDER
        except Exception as exc:
            log_ai_failure('portfolio', exc)
            raise HTTPException(502, 'AI portfolio generation is temporarily unavailable')
    else:
        text = f"I'm {creator['name']}, a {creator['title'].lower()} based in {creator['location'] or 'my community'}. {creator['bio'].strip()} My work brings together {', '.join(creator['skills'][:3])}."
        source = 'template'
    return store.update('creators', creator['id'], {'portfolio': text, 'portfolio_source': source})


@app.post('/api/me/avatar')
async def upload_avatar(file: UploadFile = File(...), user=Depends(require_role('creator'))):
    if not store.REMOTE:
        raise HTTPException(503, 'Storage uploads require Supabase configuration')
    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
        raise HTTPException(422, 'Use a JPG, PNG, or WebP image')
    content = await file.read(5_000_001)
    if len(content) > 5_000_000:
        raise HTTPException(422, 'Image must be under 5 MB')
    extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.content_type]
    path = f"{user['id']}/{uuid.uuid4()}.{extension}"
    try:
        store.admin.storage.from_('portfolios').upload(path, content, {'content-type': file.content_type})
        url = store.admin.storage.from_('portfolios').get_public_url(path)
    except Exception:
        raise HTTPException(502, 'Image upload failed')
    creator = store.one('creators', {'owner_id': user['id']})
    return store.update('creators', creator['id'], {'avatar_url': url})


@app.get('/api/briefs')
def briefs(user=Depends(current_user)):
    if user['role'] == 'brand':
        return store.all_rows('briefs', {'owner_id': user['id']}, order='created_at')
    return [b for b in store.all_rows('briefs', order='created_at') if b['status'] == 'open']


@app.post('/api/briefs/draft')
async def draft_brief(data: IdeaIn, user=Depends(require_role('brand'))):
    if not AI_PROVIDER:
        raise HTTPException(503, 'Add GEMINI_API_KEY or OPENAI_API_KEY to enable AI brief drafting')
    prompt = 'Turn this rough campaign idea into a concise creative brief description. Include goal, deliverables, tone, audience, and success criteria only when present in the idea. Do not invent facts. Ask for missing information at the end. Return plain text, 120 words maximum. Idea: ' + data.idea
    try:
        description = await generate_ai_text(prompt)
        return {'description': description, 'source': AI_PROVIDER}
    except Exception as exc:
        log_ai_failure('brief_draft', exc)
        raise HTTPException(502, 'AI brief drafting is temporarily unavailable')


@app.post('/api/briefs')
def create_brief(data: BriefIn, user=Depends(require_role('brand'))):
    return store.insert('briefs', {'owner_id': user['id'], **data.model_dump(), 'status': 'open'})


@app.get('/api/briefs/{brief_id}')
def brief_detail(brief_id: str, user=Depends(current_user)):
    brief = store.one('briefs', {'id': brief_id})
    if not brief or (user['role'] == 'creator' and brief['status'] != 'open') or (user['role'] == 'brand' and brief['owner_id'] != user['id']):
        raise HTTPException(404, 'Brief not found')
    return brief


@app.post('/api/briefs/{brief_id}/close')
def close_brief(brief_id: str, user=Depends(require_role('brand'))):
    brief = store.one('briefs', {'id': brief_id})
    if not brief or brief['owner_id'] != user['id']:
        raise HTTPException(404, 'Brief not found')
    if brief['status'] == 'closed':
        return brief
    return store.update('briefs', brief_id, {'status': 'closed'})


@app.get('/api/briefs/{brief_id}/matches')
async def matches(brief_id: str, user=Depends(require_role('brand'))):
    brief = store.one('briefs', {'id': brief_id})
    if not brief or brief['owner_id'] != user['id']:
        raise HTTPException(404, 'Brief not found')
    results = []
    for creator in store.all_rows('creators'):
        category_hit = brief['category'].lower() in [x.lower() for x in creator['categories']]
        skills_hit = sorted(set(x.lower() for x in brief['skills']) & set(x.lower() for x in creator['skills']))
        platforms_hit = sorted(set(x.lower() for x in brief['platforms']) & set(x.lower() for x in creator['platforms']))
        budget_hit = brief['budget'] >= creator['rate'] or creator['rate'] == 0
        location_hit = bool(brief['location'] and brief['location'].lower() in creator['location'].lower())
        score = (30 if category_hit else 0) + (35 * len(skills_hit) / max(1,len(brief['skills']))) + (20 * len(platforms_hit) / max(1,len(brief['platforms']))) + (10 if budget_hit else 0) + (5 if location_hit else 0)
        factors = []
        if category_hit: factors.append('category match')
        if skills_hit: factors.append('shared skills: ' + ', '.join(skills_hit))
        if platforms_hit: factors.append('shared platforms: ' + ', '.join(platforms_hit))
        if budget_hit: factors.append('within budget')
        if location_hit: factors.append('location match')
        results.append({'creator': creator, 'score': round(score), 'factors': factors, 'method': 'weighted rules', 'ai_reason': None})
    results.sort(key=lambda x: x['score'], reverse=True)
    if AI_PROVIDER and results:
        candidates = [{'id': x['creator']['id'], 'name': x['creator']['name'], 'title': x['creator']['title'], 'bio': x['creator']['bio'], 'skills': x['creator']['skills'], 'categories': x['creator']['categories'], 'platforms': x['creator']['platforms'], 'rate': x['creator']['rate'], 'portfolio': [{'title': p['title'], 'tools': p['tools'], 'format': p['format'], 'workflow': p['workflow']} for p in store.all_rows('portfolio_items', {'creator_id': x['creator']['id']})[:5]], 'rule_score': x['score']} for x in results[:8]]
        prompt = 'Assess fit for a creator campaign. Use only supplied facts. Return JSON object with key matches, an array of objects with id, score (integer 0-100), and reason (one factual sentence). No markdown. Brief: ' + json.dumps({'title': brief['title'], 'description': brief['description'], 'category': brief['category'], 'skills': brief['skills'], 'platforms': brief['platforms'], 'budget': brief['budget'], 'content_type': brief['content_type'], 'style': brief['style'], 'format': brief['format'], 'commercial_use': brief['commercial_use']}) + ' Candidates: ' + json.dumps(candidates)
        try:
            answer = await generate_ai_text(prompt, json_mode=True)
            answer = answer.removeprefix('```json').removesuffix('```').strip()
            items = {x['id']: x for x in json.loads(answer)['matches']}
            for x in results[:8]:
                suggestion = items.get(x['creator']['id'])
                if suggestion:
                    ai_score = max(0, min(100, int(suggestion['score'])))
                    x['score'] = round(x['score'] * .7 + ai_score * .3)
                    x['ai_reason'] = str(suggestion.get('reason', ''))[:300]
                    x['method'] = '70% weighted rules + 30% AI assessment'
            results.sort(key=lambda x: x['score'], reverse=True)
        except Exception as exc:
            log_ai_failure('matching', exc)
            pass  # Keep the transparent rules ranking if the optional AI service fails.
    return results


@app.post('/api/briefs/{brief_id}/apply')
def apply(brief_id: str, data: ApplicationIn, user=Depends(require_role('creator'))):
    brief = store.one('briefs', {'id': brief_id})
    if not brief or brief['status'] != 'open':
        raise HTTPException(404, 'Open brief not found')
    creator = store.one('creators', {'owner_id': user['id']})
    if store.one('applications', {'brief_id': brief_id, 'creator_id': creator['id']}):
        raise HTTPException(409, 'You already applied to this brief')
    return store.insert('applications', {'brief_id': brief_id, 'creator_id': creator['id'], 'note': data.note.strip(), 'status': 'pending'})


@app.get('/api/applications')
def applications(user=Depends(current_user)):
    if user['role'] == 'creator':
        creator = store.one('creators', {'owner_id': user['id']})
        rows = store.all_rows('applications', {'creator_id': creator['id']})
    else:
        owned = {b['id'] for b in store.all_rows('briefs', {'owner_id': user['id']})}
        rows = [a for a in store.all_rows('applications') if a['brief_id'] in owned]
    return [{**a, 'brief': store.one('briefs', {'id': a['brief_id']}), 'creator': store.one('creators', {'id': a['creator_id']})} for a in rows]


@app.post('/api/applications/{application_id}/accept')
def accept(application_id: str, user=Depends(require_role('brand'))):
    application = store.one('applications', {'id': application_id})
    brief = store.one('briefs', {'id': application['brief_id']}) if application else None
    if not brief or brief['owner_id'] != user['id']:
        raise HTTPException(404, 'Application not found')
    if application['status'] == 'accepted':
        existing = store.one('projects', {'brief_id': brief['id'], 'creator_id': application['creator_id']})
        if existing:
            return existing
    if application['status'] != 'pending':
        raise HTTPException(409, 'Only pending applications can be accepted')
    store.update('applications', application_id, {'status': 'accepted'})
    return store.insert('projects', {'brief_id': brief['id'], 'creator_id': application['creator_id'], 'brand_id': user['id'], 'status': 'active'})


@app.post('/api/applications/{application_id}/decline')
def decline(application_id: str, user=Depends(require_role('brand'))):
    application = store.one('applications', {'id': application_id})
    brief = store.one('briefs', {'id': application['brief_id']}) if application else None
    if not brief or brief['owner_id'] != user['id']:
        raise HTTPException(404, 'Application not found')
    if application['status'] != 'pending':
        raise HTTPException(409, 'Only pending applications can be declined')
    return store.update('applications', application_id, {'status': 'declined'})


@app.get('/api/projects')
def projects(user=Depends(current_user)):
    if user['role'] == 'brand':
        rows = store.all_rows('projects', {'brand_id': user['id']})
    else:
        creator = store.one('creators', {'owner_id': user['id']})
        rows = store.all_rows('projects', {'creator_id': creator['id']})
    return [{**p, 'brief': store.one('briefs', {'id': p['brief_id']}), 'creator': store.one('creators', {'id': p['creator_id']})} for p in rows]


def permitted_project(project_id, user):
    project = store.one('projects', {'id': project_id})
    creator = store.one('creators', {'owner_id': user['id']}) if user['role'] == 'creator' else None
    if not project or (project['brand_id'] != user['id'] and (not creator or project['creator_id'] != creator['id'])):
        raise HTTPException(404, 'Project not found')
    return project


@app.post('/api/projects/{project_id}/complete')
def complete_project(project_id: str, user=Depends(require_role('brand'))):
    project = permitted_project(project_id, user)
    if project['status'] == 'completed':
        return project
    return store.update('projects', project_id, {'status': 'completed'})


@app.get('/api/projects/{project_id}/messages')
def messages(project_id: str, user=Depends(current_user)):
    permitted_project(project_id, user)
    return store.all_rows('messages', {'project_id': project_id}, order='created_at')


@app.post('/api/projects/{project_id}/messages')
def send_message(project_id: str, data: MessageIn, user=Depends(current_user)):
    permitted_project(project_id, user)
    return store.insert('messages', {'project_id': project_id, 'sender_id': user['id'], 'body': data.body.strip()})


# The Docker deployment serves the Vite build from the same origin as the API.
DIST_DIR = Path(__file__).resolve().parents[1] / 'dist'


@app.get('/{path:path}', include_in_schema=False)
def frontend(path: str):
    if path.startswith('api/') or not (DIST_DIR / 'index.html').is_file():
        raise HTTPException(404, 'Not found')
    candidate = (DIST_DIR / path).resolve()
    if candidate.is_relative_to(DIST_DIR.resolve()) and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST_DIR / 'index.html')
