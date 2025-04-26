# 🐱 CatGPT

CatGPT is a tiny open-source clone of ChatGPT that answers every prompt with a playful feline personality.

This repository contains **two** separate apps that live side-by-side:

1. **backend/** – Python + FastAPI service that proxies requests to OpenAI’s Chat Completion API and streams the reply back to the browser as Server-Sent Events (SSE).
2. **frontend/** – React + Vite web client that provides the chat interface and renders the streamed tokens in real-time.

> Everything is 100 % MIT-licensed—feel free to fork and adapt.

---

## 1. Prerequisites

* Node ≥ 18 (for the React dev server)
* Python ≥ 3.10 (for `list[dict]` type hints)
* An OpenAI API key – create one at <https://platform.openai.com/account/api-keys>

---

## 2. Quick start (local dev)

```bash
# Clone & open a virtual env (optional)
git clone <repo-url> catgpt && cd catgpt

# ───── backend ─────
cd backend
python -m venv venv && source venv/bin/activate  # optional
pip install -r requirements.txt
cp .env.example .env   # add your real key
uvicorn main:app --reload --port 8000

# ───── frontend ─────
cd ../frontend
npm install
npm run dev          # http://localhost:5173
```

Open <http://localhost:5173> and start meowing at CatGPT! 🐾

---

## 3. Project layout

```
catgpt/
├─ backend/
│  ├─ main.py              # FastAPI server
│  ├─ requirements.txt
│  └─ .env.example         # copy → .env
├─ frontend/
│  ├─ index.html
│  ├─ package.json         # npm scripts & deps
│  ├─ vite.config.ts
│  └─ src/
│      ├─ App.tsx
│      ├─ Chat.tsx
│      ├─ api.ts           # fetch + streaming helpers
│      ├─ main.tsx
│      └─ …
└─ README.md
```

---

## 4. How streaming works

1. The browser sends `POST /chat` with the full message history.
2. `backend/main.py` forwards the messages (plus a system prompt that turns the model into a cat 🐱) to `openai.chat.completions.create(stream=True)`.
3. As tokens arrive, the backend converts them to Server-Sent Events (`data:<token>\n\n`).
4. The React app consumes the **ReadableStream**, splits `\n\n`, and appends the text to the UI for that satisfying “typewriter effect.”

If you prefer WebSockets you can swap transports—the OpenAI SDK gives you an async generator that can be bridged to anything.

---

## 5. Deployment (one-liners)

• **Backend** – Fly.io example:

```bash
fly launch --name catgpt-backend --dockerfile -r ord
fly secrets set OPENAI_API_KEY=sk-…
```

 (Render, Railway, or AWS Elastic Beanstalk work just as well.)

• **Frontend** – Vercel example:

```bash
# inside frontend/
vercel --prod -e VITE_API_URL=https://<backend-url>
```

---

## 6. Next steps / ideas

* Persist chat history in Supabase/Postgres
* Add image generation mode via DALL·E 3 for cat pictures
* Play “meow” / “purr” sound effects after each reply
* Rate-limit by IP to avoid abuse

Have fun building! Feel free to open issues or PRs. 🐈
