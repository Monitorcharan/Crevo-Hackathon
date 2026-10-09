# Crevo data model

Crevo stores accounts in Supabase Auth. Its application tables are in PostgreSQL. A creator account owns one creator profile; a brand account owns briefs. The FastAPI server checks account role and record ownership before each private action.

| Record | Main fields | Why it matters |
| --- | --- | --- |
| Creator profile | Name, title, bio, location, categories/specialization, skills, platforms, audience, starting rate, avatar, portfolio introduction | Gives brands a searchable summary of the creator’s focus and availability. |
| Portfolio item | Creator ID, title, description, media URL, media type (image/video/link), tools and models, workflow, format, commercial-use terms, verification label | Shows an AI work sample and the process behind it. Tool and work claims are marked **creator reported**; Crevo does not present them as independently verified. |
| Brief | Brand owner, title, description, category, skills, platforms, budget, location, content type, style, format/aspect ratio, commercial-use requirements, status | Captures the deliverable and usage context needed for a useful creator match. |
| Application | Brief, creator, proposal note, status | Connects a creator to a specific brief. |
| Project and message | Accepted brief, creator, brand, project status, sender, message body | Keeps collaboration attached to the accepted engagement. |

Discovery searches creator text, skills, specialization, and portfolio tools. Filters cover category, platform, skill, tool/model, and portfolio media type. Match suggestions combine transparent category, skill, platform, budget, and location rules with an optional Gemini assessment. The AI brief helper suggests structured fields from a rough idea; the brand reviews and completes them before publishing.

Profile avatars use Supabase Storage. Portfolio samples use publicly accessible media URLs in this MVP. Project payments, milestones, and shared file delivery are outside its current scope.
