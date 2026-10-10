import json
import os
import sqlite3
import uuid
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / 'crevo.db'
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
PUBLIC_KEY = os.getenv('SUPABASE_PUBLISHABLE_KEY') or os.getenv('SUPABASE_ANON_KEY', '')
SECRET_KEY = os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
if any((SUPABASE_URL, PUBLIC_KEY, SECRET_KEY)) and not all((SUPABASE_URL, PUBLIC_KEY, SECRET_KEY)):
    raise RuntimeError('Supabase configuration is incomplete: set URL, publishable key, and secret key together')
REMOTE = bool(SUPABASE_URL and PUBLIC_KEY and SECRET_KEY)
if os.getenv('CREVO_REQUIRE_SUPABASE') == '1' and not REMOTE:
    raise RuntimeError('Hosted Crevo requires Supabase credentials')
admin = create_client(SUPABASE_URL, SECRET_KEY) if REMOTE else None
JSON_FIELDS = {'categories', 'skills', 'platforms', 'tools', 'social_links'}


def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def init_local():
    if REMOTE:
        return
    with connect() as db:
        db.executescript('''
        create table if not exists users(id text primary key,email text unique not null,name text not null,role text not null,password_hash text not null,firebase_uid text unique,company_name text not null default '',logo_url text,created_at text default current_timestamp);
        create table if not exists creators(id text primary key,owner_id text unique,name text not null,title text not null,bio text not null,location text not null,categories text not null,skills text not null,platforms text not null,social_links text not null default '{}',contact_email text,verified_at text,audience integer not null,rate integer not null,avatar_url text,portfolio text not null,portfolio_source text not null,created_at text default current_timestamp);
        create table if not exists portfolio_items(id text primary key,creator_id text not null,title text not null,description text not null,media_url text not null,media_type text not null,tools text not null,workflow text not null,format text not null,commercial_use text not null,verification text not null,created_at text default current_timestamp);
        create table if not exists briefs(id text primary key,owner_id text not null,title text not null,description text not null,category text not null,skills text not null,platforms text not null,budget integer not null,location text not null,content_type text not null default '',style text not null default '',format text not null default '',commercial_use text not null default '',status text not null,created_at text default current_timestamp);
        create table if not exists applications(id text primary key,brief_id text not null,creator_id text not null,note text not null,status text not null,created_at text default current_timestamp,unique(brief_id,creator_id));
        create table if not exists projects(id text primary key,brief_id text not null,creator_id text not null,brand_id text not null,status text not null,created_at text default current_timestamp,unique(brief_id,creator_id));
        create table if not exists messages(id text primary key,project_id text not null,sender_id text not null,body text not null,created_at text default current_timestamp);
        create table if not exists contact_threads(id text primary key,brand_id text not null,creator_id text not null,kind text not null,subject text not null,message text not null,budget integer,timeline text not null default '',created_at text default current_timestamp);
        create table if not exists contact_messages(id text primary key,thread_id text not null,sender_id text not null,body text not null,created_at text default current_timestamp);
        create table if not exists reviews(id text primary key,project_id text not null unique,brand_id text not null,creator_id text not null,rating integer not null,body text not null,created_at text default current_timestamp);
        create table if not exists verification_requests(id text primary key,creator_id text not null,evidence_url text not null,statement text not null,status text not null,decision_note text not null default '',reviewed_by text,reviewed_at text,created_at text default current_timestamp);
        ''')
        if 'firebase_uid' not in {row[1] for row in db.execute('pragma table_info(users)')}:
            db.execute('alter table users add column firebase_uid text')
        db.execute('create unique index if not exists users_firebase_uid_idx on users(firebase_uid)')
        user_columns = {row[1] for row in db.execute('pragma table_info(users)')}
        if 'company_name' not in user_columns:
            db.execute("alter table users add column company_name text not null default ''")
        if 'logo_url' not in user_columns:
            db.execute('alter table users add column logo_url text')
        if 'social_links' not in {row[1] for row in db.execute('pragma table_info(creators)')}:
            db.execute("alter table creators add column social_links text not null default '{}'")
        creator_columns = {row[1] for row in db.execute('pragma table_info(creators)')}
        if 'contact_email' not in creator_columns:
            db.execute('alter table creators add column contact_email text')
        if 'verified_at' not in creator_columns:
            db.execute('alter table creators add column verified_at text')
        legacy_names = ('Maya Chen', 'Jordan Rivera', 'Amara Okafor', 'Leo Martínez', 'Priya Shah', 'Noah Brooks')
        for name in legacy_names:
            row = db.execute('select id from creators where name=? and owner_id is null', (name,)).fetchone()
            if row and not db.execute('select 1 from projects where creator_id=? union select 1 from applications where creator_id=?', (row['id'], row['id'])).fetchone():
                db.execute('delete from portfolio_items where creator_id=?', (row['id'],))
                db.execute('delete from creators where id=?', (row['id'],))
        samples = [
            ('[Demo] Aria Vale', 'AI filmmaker & campaign director', ['AI Filmmaking', 'Advertising Creative', 'Product Visualization'], ['Creative Direction', 'Storyboarding'], ['Instagram', 'YouTube'], 'night-drive.png', 'After Dark / launch film concept'),
            ('[Demo] Kian Mercer', '3D motion & generative artist', ['Motion Design', '3D & CGI', 'Generative Art'], ['3D Art Direction', 'Motion Concepts'], ['Instagram', 'YouTube'], 'glass-motion.png', 'Glass Orbit / motion concept'),
            ('[Demo] Solana Park', 'AI product & beauty visual artist', ['Beauty', 'AI Photography', 'Product Visualization'], ['Product Imagery', 'Art Direction'], ['Instagram', 'TikTok'], 'skincare-still.png', 'Soft Light / skincare still life'),
            ('[Demo] Niko Lane', 'Fashion editorial & social creator', ['Fashion', 'Social Media Content', 'AI Photography'], ['Editorial Imagery', 'Social Campaigns'], ['Instagram', 'TikTok'], 'fashion-editorial.png', 'Electric Blue / fashion editorial'),
        ]
        for name, title, categories, skills, platforms, image, work_title in samples:
            if db.execute('select 1 from creators where name=?', (name,)).fetchone():
                continue
            creator_id = str(uuid.uuid4())
            db.execute('insert into creators(id,owner_id,name,title,bio,location,categories,skills,platforms,audience,rate,avatar_url,portfolio,portfolio_source) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (creator_id, None, name, title, 'Fictional sample profile with original AI-generated concept art and illustrative feedback. No real client work is represented.', 'Creative studio · worldwide', json.dumps(categories), json.dumps(skills), json.dumps(platforms), 0, 0, None, 'Illustrative Crevo demo portfolio.', 'demo'))
            db.execute('insert into portfolio_items(id,creator_id,title,description,media_url,media_type,tools,workflow,format,commercial_use,verification) values(?,?,?,?,?,?,?,?,?,?,?)',
                (str(uuid.uuid4()), creator_id, work_title, 'Illustrative AI-generated concept artwork for the Crevo demo, not a real client campaign.', f'https://crevo-hackathon.onrender.com/demo/{image}', 'image', json.dumps(['OpenAI image generation']), 'Generated a fictional campaign image and selected the final concept.', '16:9 landscape', 'Demo only; no client license is represented.', 'illustrative demo'))


def normalize(row):
    if row is None:
        return None
    item = dict(row)
    for key in JSON_FIELDS & item.keys():
        if isinstance(item[key], str):
            item[key] = json.loads(item[key])
    item.pop('password_hash', None)
    return item


def all_rows(table, filters=None, order=None):
    filters = filters or {}
    if REMOTE:
        q = admin.table(table).select('*')
        for key, value in filters.items():
            q = q.eq(key, value)
        if order:
            q = q.order(order)
        return [normalize(x) for x in q.execute().data]
    sql = f'select * from {table}'
    values = list(filters.values())
    if filters:
        sql += ' where ' + ' and '.join(f'{key}=?' for key in filters)
    if order:
        sql += f' order by {order}'
    with connect() as db:
        return [normalize(x) for x in db.execute(sql, values).fetchall()]


def one(table, filters):
    rows = all_rows(table, filters)
    return rows[0] if rows else None


def insert(table, data):
    item = {'id': str(uuid.uuid4()), **data}
    if REMOTE:
        return normalize(admin.table(table).insert(item).execute().data[0])
    encoded = {k: json.dumps(v) if k in JSON_FIELDS else v for k,v in item.items()}
    fields = ','.join(encoded)
    marks = ','.join('?' for _ in encoded)
    with connect() as db:
        db.execute(f'insert into {table}({fields}) values({marks})', tuple(encoded.values()))
    return one(table, {'id': item['id']})


def update(table, row_id, data):
    if REMOTE:
        rows = admin.table(table).update(data).eq('id', row_id).execute().data
        return normalize(rows[0]) if rows else None
    encoded = {k: json.dumps(v) if k in JSON_FIELDS else v for k,v in data.items()}
    assignments = ','.join(f'{key}=?' for key in encoded)
    with connect() as db:
        db.execute(f'update {table} set {assignments} where id=?', (*encoded.values(), row_id))
    return one(table, {'id': row_id})


def delete(table, row_id):
    if REMOTE:
        admin.table(table).delete().eq('id', row_id).execute()
        return
    with connect() as db:
        db.execute(f'delete from {table} where id=?', (row_id,))
