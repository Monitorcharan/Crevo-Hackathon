# Isolated local test scenario

This optional launcher creates fictional records in an explicitly local SQLite database. It never seeds the hosted marketplace. Use the [complete workflow](rounds-one-and-two-workflow.md) for the current live creator and brand.

## Launch

Install the backend development requirements and frontend dependencies from the root README. From the repository root:

```powershell
python backend/run_round_two_local.py
```

In another terminal:

```powershell
npm run dev
```

The launcher asks for an operator-chosen password of at least 12 characters. The brand is `brand.demo.crevo@example.com` and primary creator is `creator.demo.crevo@example.com`. Use separate browser profiles. No password is embedded in the frontend or repository.

Records use `tmp/round2-preview.db`; files use `public/round-two-samples/` and local delivery storage. To start a fresh scenario, pass `--db tmp/round2-fresh.db`. Add `--ai` only when you intend to call the configured real AI provider; the default is transparent rules.

## What the fixtures exercise

The scenario supplies four fictional creators: suitable video profiles, a limited-territory offer and a sparse profile. The prepared Sola Coffee brief requests a 15-second vertical MP4, relevant tools and worldwide social/web rights for 12 months.

Follow matching → shortlist review → invitation/response → application selection → agreement → progress → checked upload → revision → approval. See the [project workflow](project-workflow.md) for shared behavior.

The generated `public/round-two-samples/round2-landscape.mp4` must fail the 9:16 ratio requirement; `round2-vertical.mp4` has the required format. These are solid-color technical fixtures, not creative portfolio films or commissioned campaigns. A local fixture's claims and feedback must not be presented as real production evidence.

The original MP4s in `backend/fixtures/` are committed because automated tests inspect their actual dimensions and duration. Generated copies, SQLite files, credentials and delivery files are excluded from Git. Public `/demo` redirects to discovery; no hosted demo account is enabled by this launcher.
