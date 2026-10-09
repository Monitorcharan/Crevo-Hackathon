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
JSON_FIELDS = {'categories', 'skills', 'platforms', 'tools'}


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
        create table if not exists users(id text primary key,email text unique not null,name text not null,role text not null,password_hash text not null,created_at text default current_timestamp);
        create table if not exists creators(id text primary key,owner_id text unique,name text not null,title text not null,bio text not null,location text not null,categories text not null,skills text not null,platforms text not null,audience integer not null,rate integer not null,avatar_url text,portfolio text not null,portfolio_source text not null,created_at text default current_timestamp);
        create table if not exists portfolio_items(id text primary key,creator_id text not null,title text not null,description text not null,media_url text not null,media_type text not null,tools text not null,workflow text not null,format text not null,commercial_use text not null,verification text not null,created_at text default current_timestamp);
        create table if not exists briefs(id text primary key,owner_id text not null,title text not null,description text not null,category text not null,skills text not null,platforms text not null,budget integer not null,location text not null,content_type text not null default '',style text not null default '',format text not null default '',commercial_use text not null default '',status text not null,created_at text default current_timestamp);
        create table if not exists applications(id text primary key,brief_id text not null,creator_id text not null,note text not null,status text not null,created_at text default current_timestamp,unique(brief_id,creator_id));
        create table if not exists projects(id text primary key,brief_id text not null,creator_id text not null,brand_id text not null,status text not null,created_at text default current_timestamp,unique(brief_id,creator_id));
        create table if not exists messages(id text primary key,project_id text not null,sender_id text not null,body text not null,created_at text default current_timestamp);
        ''')
        if db.execute('select count(*) from creators').fetchone()[0] == 0:
            samples = [
                ('Maya Chen','Visual storyteller & creative director','Making everyday moments feel cinematic. I create thoughtful short form films for lifestyle brands.','Brooklyn, NY',['Lifestyle','Fashion'],['Video','Art Direction','Photography'],['Instagram','TikTok'],128000,1800),
                ('Jordan Rivera','Motion designer & 3D artist','Fluid worlds, bold type, and motion that stays with you.','Austin, TX',['Design','Technology'],['3D','Motion','Animation'],['Instagram','YouTube'],82000,1500),
                ('Amara Okafor','Beauty creator & photographer','Colorful beauty stories rooted in real routines and honest recommendations.','London, UK',['Beauty','Lifestyle'],['Photography','UGC','Video'],['Instagram','TikTok'],245000,2300),
                ('Leo Martínez','Food filmmaker','Films that make you taste the story. Recipes, restaurants and everything between.','Los Angeles, CA',['Food','Lifestyle'],['Video','Photography','Editing'],['TikTok','YouTube'],97000,1400),
                ('Priya Shah','Travel writer & creator','Human stories from the places we go, made for people who travel with curiosity.','Mumbai, India',['Travel','Lifestyle'],['Writing','Video','Photography'],['Instagram','YouTube'],161000,1900),
                ('Noah Brooks','Culture & streetwear creator','Building visual culture at the intersection of fashion, music and city life.','New York, NY',['Fashion','Culture'],['UGC','Video','Art Direction'],['Instagram','TikTok'],114000,1700),
            ]
            for name,title,bio,location,categories,skills,platforms,audience,rate in samples:
                db.execute('insert into creators(id,owner_id,name,title,bio,location,categories,skills,platforms,audience,rate,avatar_url,portfolio,portfolio_source) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (str(uuid.uuid4()),None,name,title,bio,location,json.dumps(categories),json.dumps(skills),json.dumps(platforms),audience,rate,None,'','manual'))


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
