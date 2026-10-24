"""Shortlist proposals, deliberate outreach, and creator responses on real records."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
import store
from matching import LicenseTerms
from demo_accounts import demo_creator_for_brief, can_match


class CandidateAction(BaseModel):
    action: Literal['shortlist', 'remove', 'contact', 'interested', 'decline']
    creator_id: str = Field(default='', max_length=100)
    message: str = Field(default='', max_length=2000)


class AgentDecision(BaseModel):
    decision: Literal['accept', 'reject']


def register(app, current_user, matches):
    def owned(brief_id, user):
        brief = store.one('briefs', {'id': brief_id})
        if not brief or brief['owner_id'] != user['id'] or user['role'] != 'brand':
            raise HTTPException(404, 'Brief not found')
        return brief

    def event(row, status, user, note=''):
        events = row.get('events', []) + [{'status': status, 'actor_id': user['id'], 'at': datetime.now(timezone.utc).isoformat(), 'note': note}]
        return store.update('brief_candidates', row['id'], {'status': status, 'events': events})

    def view(row):
        project = store.one('projects', {'brief_id': row['brief_id'], 'creator_id': row['creator_id']})
        return {**row, 'status': 'selected' if project else row['status'], 'project_id': project['id'] if project else None,
                'creator': store.one('creators', {'id': row['creator_id']})}

    @app.put('/api/me/licensing')
    def licensing(data: LicenseTerms, user=Depends(current_user)):
        if user['role'] != 'creator':
            raise HTTPException(403, 'Only creators can set an offered license.')
        creator = store.one('creators', {'owner_id': user['id']})
        return store.update('creators', creator['id'], {'licensing': data.model_dump()})

    @app.get('/api/briefs/{brief_id}/candidates')
    def candidates(brief_id: str, user=Depends(current_user)):
        if user['role'] == 'brand':
            owned(brief_id, user)
            rows = store.all_rows('brief_candidates', {'brief_id': brief_id})
        else:
            creator = store.one('creators', {'owner_id': user['id']})
            rows = store.all_rows('brief_candidates', {'brief_id': brief_id, 'creator_id': creator['id']}) if creator else []
            rows = [r for r in rows if r['status'] in ('invited', 'interested', 'declined')]
        return [view(r) for r in rows]

    @app.post('/api/briefs/{brief_id}/agent')
    async def propose(brief_id: str, user=Depends(current_user)):
        brief = owned(brief_id, user)
        if brief['status'] != 'open':
            raise HTTPException(409, 'Reopen or create a brief before building a shortlist.')
        ranked = await matches(brief_id, user)
        existing = {r['creator_id'] for r in store.all_rows('brief_candidates', {'brief_id': brief_id})}
        suitable = [m for m in ranked if m['score'] >= 50 and m['licensing']['status'] != 'mismatch' and m['creator']['id'] not in existing][:5]
        for m in suitable:
            store.insert('brief_candidates', {'brief_id': brief_id, 'brand_id': user['id'], 'creator_id': m['creator']['id'],
                         'status': 'proposed', 'source': 'agent', 'events': [{'status': 'proposed', 'actor_id': user['id'], 'at': datetime.now(timezone.utc).isoformat(),
                         'note': f"{m['score']}/100. " + '; '.join(m['factors']), 'method': m['method']}]})
        return {'proposed': len(suitable), 'message': f'Proposed {len(suitable)} creators from this brief’s ranked matches. Review the proposals before outreach.' if suitable else 'No additional suitable matches. Refine the brief, resolve rights, or review weaker fits manually.', 'candidates': candidates(brief_id, user)}

    @app.post('/api/briefs/{brief_id}/agent/decision')
    def decide(brief_id: str, data: AgentDecision, user=Depends(current_user)):
        owned(brief_id, user)
        for row in store.all_rows('brief_candidates', {'brief_id': brief_id, 'status': 'proposed'}):
            event(row, 'shortlisted' if data.decision == 'accept' else 'removed', user, 'Brand ' + data.decision + 'ed the agent proposal.')
        return candidates(brief_id, user)

    @app.post('/api/briefs/{brief_id}/candidates')
    def shortlist(brief_id: str, data: CandidateAction, user=Depends(current_user)):
        brief = owned(brief_id, user)
        if brief['status'] != 'open' or data.action != 'shortlist':
            raise HTTPException(409, 'Shortlisting requires an open brief.')
        creator = store.one('creators', {'id': data.creator_id})
        if not creator or not can_match(creator, demo_creator_for_brief(brief)):
            raise HTTPException(422, 'Choose an available registered creator.')
        row = store.one('brief_candidates', {'brief_id': brief_id, 'creator_id': creator['id']})
        if row and row['status'] in ('invited', 'interested', 'declined'):
            raise HTTPException(409, 'This creator has already been contacted.')
        if not row:
            row = store.insert('brief_candidates', {'brief_id': brief_id, 'brand_id': user['id'], 'creator_id': creator['id'], 'status': 'shortlisted', 'source': 'manual', 'events': []})
        return view(event(row, 'shortlisted', user, 'Added to shortlist.'))

    @app.post('/api/candidates/{candidate_id}')
    def candidate_action(candidate_id: str, data: CandidateAction, user=Depends(current_user)):
        row = store.one('brief_candidates', {'id': candidate_id})
        creator = store.one('creators', {'id': row['creator_id']}) if row else None
        if not row or user['id'] not in (row['brand_id'], creator.get('owner_id')):
            raise HTTPException(404, 'Invitation not found')
        brief = store.one('briefs', {'id': row['brief_id']})
        brand = user['id'] == row['brand_id']
        if (data.action in ('shortlist', 'remove', 'contact') and not brand) or (data.action in ('interested', 'decline') and brand):
            raise HTTPException(403, 'This action belongs to your collaborator.')
        if data.action in ('shortlist', 'remove'):
            if row['status'] not in ('proposed', 'shortlisted', 'removed'):
                raise HTTPException(409, 'A contacted creator cannot be removed from history.')
            row = event(row, 'shortlisted' if data.action == 'shortlist' else 'removed', user)
        elif data.action == 'contact':
            if row['status'] != 'shortlisted' or brief['status'] != 'open':
                raise HTTPException(409, 'Only shortlisted creators on an open brief can be invited.')
            if len(data.message.strip()) < 20:
                raise HTTPException(422, 'Write an invitation of at least 20 characters.')
            thread = store.insert('contact_threads', {'brand_id': row['brand_id'], 'creator_id': row['creator_id'], 'kind': 'quote', 'subject': brief['title'],
                       'message': data.message.strip() + f"\n\nBrief: /briefs/{brief['id']}", 'budget': brief['budget'], 'timeline': brief.get('deadline') or ''})
            store.update('brief_candidates', row['id'], {'thread_id': thread['id']})
            row = event({**row, 'thread_id': thread['id']}, 'invited', user, data.message.strip())
        elif data.action in ('interested', 'decline'):
            if row['status'] != 'invited' or brief['status'] != 'open':
                raise HTTPException(409, 'This invitation is no longer awaiting a response.')
            if data.action == 'interested':
                application = store.one('applications', {'brief_id': brief['id'], 'creator_id': creator['id']})
                if application and application['status'] != 'pending':
                    raise HTTPException(409, 'An application decision already exists for this brief.')
                if not application:
                    store.insert('applications', {'brief_id': brief['id'], 'creator_id': creator['id'], 'status': 'pending', 'note': data.message.strip() or 'Invitation accepted. I am interested in discussing the scope and usage rights.'})
            row = event(row, 'interested' if data.action == 'interested' else 'declined', user, data.message.strip())
        return view(row)
