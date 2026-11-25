# DAMS: Document Automation Management System

FastAPI + SQLAlchemy + SQLite backend, React + Vite + Tailwind frontend.

## What this version adds

1. **Owl identity ("Dami")**: one purple-and-white owl with eight poses (welcome, reading/loading, celebrate, confused, approved stamp, empty, error, idle), plus an original owl-on-a-page logo and favicon.
2. **Designed templates**: 13 built-in templates (8 school, 5 administrative) in seven layouts: letter, framed certificates (landscape), memo, announcement, report and form. The Word and PDF downloads use the same layout as the preview (headers, signature blocks, reference numbers, page numbers, certificate frames).
3. **AI that assists**: on long-text fields and on the AI Assistant page you can *Improve, Rewrite formally, Shorten, Fix grammar* or *Suggest text*. The result is shown next to the original and **only applied if you press Accept**. Select part of a field to change just that part. Nothing is sent without a one-time confirmation; if no AI provider is configured the buttons are disabled and no text is invented.
4. **Live preview beside the form**: the page redraws as you type (debounced, rendered by the same engine as the downloads).

Also included: login/registration with hashed passwords, roles (Administrator, Staff, Approver) enforced on the backend, approval workflow with comments and history, version history, notifications, activity log, favorites and recently used templates, light/dark mode, collapsible sidebar, reduced-motion support.

## Run it

Backend (Windows PowerShell):

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example .env      # optional: add AI settings
uvicorn main:app --reload
```

Frontend (second terminal):

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. **The first account you register becomes the administrator.** Existing documents from the old version are assigned to that account. The database is upgraded in place (`migrate.py`), and your existing templates are kept.

### Optional AI setup
Put these in `backend/.env` (never in the frontend): `AI_PROVIDER` (`anthropic` or `openai`), `AI_API_KEY`, and `AI_MODEL` (required for `openai`). Without them everything else works.

## Smoke test
1. Register (you become admin) → Templates → *Create document* on "Certificate of Completion".
2. Type a name; watch the preview update. Clear a required field and press *Submit*: the owl asks for the missing detail.
3. Save draft → download Word and PDF from the success dialog.
4. Register a second account in a private window; promote it to *Approver* in Settings → Users. (By default you cannot approve your own document; set `ALLOW_SELF_APPROVAL=true` for a one-person demo.)
5. Submit a document, then approve/reject it from *Approvals* and check the owner's notification.

## Verification status (be aware)
The latest changes were written in an offline sandbox where FastAPI, SQLAlchemy and the npm packages could not be installed. What **was** verified there: all backend files compile; all 13 templates render to blocks, valid `.docx` and `.pdf` files (empty and filled); the whole frontend bundles with esbuild (syntax and imports resolve). What was **not** run: the API server, the included `backend/tests`, and the UI in a browser. Please run `pytest` inside `backend` (after installing requirements) and click through the smoke test above; report anything that fails.
