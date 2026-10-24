"""Application decisions and project creation share one database transaction."""
import uuid
import json
from datetime import datetime, timezone
import store


def transition(application_id, brand_id, decision):
    if store.REMOTE:
        return store.admin.rpc('transition_application', {
            'p_application_id': application_id, 'p_brand_id': brand_id,
            'p_decision': decision,
        }).execute().data
    with store.connect() as db:
        db.execute('begin immediate')
        row = db.execute('select a.* from applications a join briefs b on b.id=a.brief_id where a.id=? and b.owner_id=?', (application_id, brand_id)).fetchone()
        if not row:
            raise ValueError('Application not found')
        existing = db.execute('select * from projects where brief_id=? and creator_id=?', (row['brief_id'], row['creator_id'])).fetchone()
        if row['status'] == 'accepted' and decision == 'accepted' and existing:
            return store.normalize(existing, 'projects')
        if row['status'] != 'pending' and not (row['status'] == 'accepted' and decision == 'accepted'):
            raise ValueError('Only pending applications can be changed')
        if decision == 'accepted' and not existing:
            project_id = str(uuid.uuid4())
            brief = store.normalize(db.execute('select * from briefs where id=?', (row['brief_id'],)).fetchone(), 'briefs')
            creator = store.normalize(db.execute('select * from creators where id=?', (row['creator_id'],)).fetchone(), 'creators')
            workflow = {'stage': 'scope_pending', 'selection_snapshot': {'brief': brief, 'creator_offer': creator.get('licensing'), 'selected_by': brand_id, 'selected_at': datetime.now(timezone.utc).isoformat()}}
            db.execute('insert into projects(id,brief_id,creator_id,brand_id,status,workflow) values(?,?,?,?,?,?)', (project_id, row['brief_id'], row['creator_id'], brand_id, 'active', json.dumps(workflow)))
            existing = db.execute('select * from projects where id=?', (project_id,)).fetchone()
        db.execute('update applications set status=? where id=?', (decision, application_id))
        return store.normalize(existing if decision == 'accepted' else db.execute('select * from applications where id=?', (application_id,)).fetchone(), 'projects' if decision == 'accepted' else 'applications')
