# LinkFetch

**Your Links. Your Media. Simply.**

Free, no-account social media / media downloader focused on **public and authorized** content only.

> This project deliberately does **not** implement unauthorized stream extraction, DRM circumvention, or bypassing of platform login / private-content protections.

## Features

- Paste a public media URL → analyze → download when authorized
- No user accounts, no database, no permanent history
- Modular provider registry (easy to extend)
- Secure URL validation + SSRF protection
- Temporary in-memory jobs + automatic file cleanup
- Modern responsive UI (React + Tailwind) with light/dark theme
- Honest provider status (available / limited / unavailable)

## Supported in this release

| Provider       | Status    | Notes                                      |
|----------------|-----------|--------------------------------------------|
| Direct Media   | available | Public mp4/webm/mp3/… file URLs            |
| Reddit         | limited   | Public posts with direct media             |
| YouTube        | limited   | Metadata + official watch link only        |
| Vimeo / others | limited   | oEmbed metadata + official link            |
| TikTok / IG / X| unavailable | Not enabled (authorization constraints) |

## Project structure

```
linkfetch/
├── frontend/          # Vite + React + TypeScript + Tailwind
├── backend/           # Express + TypeScript
├── .gitignore
└── README.md
```

## Quick start (local)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173  (proxies /api → backend)
```

Open http://localhost:5173

## API

| Method | Path                 | Description                          |
|--------|----------------------|--------------------------------------|
| GET    | `/api/health`        | Health + limits                      |
| GET    | `/api/providers`     | Provider list + status               |
| POST   | `/api/analyze`       | `{ "url": "..." }` → metadata/formats|
| POST   | `/api/download`      | Start authorized download job        |
| GET    | `/api/jobs/:id`      | Job status                           |
| GET    | `/api/download/:id`  | Stream file (`?token=…`)             |
| DELETE | `/api/jobs/:id`      | Cancel job                           |

## Security highlights

- Strict HTTP/HTTPS scheme validation
- DNS resolution + private/reserved IP blocking (SSRF protection)
- Redirect re-validation
- Rate limiting + concurrent job limits
- Cryptographically random job IDs and download tokens
- No shell interpolation; temporary files cleaned on expire/cancel/shutdown
- No secrets committed; CORS allow-list via env

## Deployment notes

- **Frontend**: any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages)
- **Backend**: needs a Node host that allows outbound network + temporary disk (Railway, Render, Fly.io, etc.)
- Set `CORS_ORIGINS` to your frontend origin(s)
- Set `VITE_API_URL` at frontend build time if the API is on a different domain
- In-memory jobs are lost on restart (documented limitation of the no-database design)

## Legal / responsible use

LinkFetch is provided for downloading content you are authorized to obtain.  
Do not use it to infringe copyright or violate platform terms of service.  
Platform capabilities change; the "Supported Platforms" list is the source of truth for a given deployment.

## License

MIT (or as otherwise stated in the repository)
