# Applying Code Changes When Using Docker

Your `docker-compose.yml` **mounts** the backend and frontend source from your machine into the containers. The files on disk are already the new ones; the running **processes** need to load them.

## 1. Restart containers (required for backend)

The backend runs **Gunicorn**, which does not reload when you change Python files. Restart the backend so it loads the latest code:

```bash
docker compose restart backend
```

Restart the frontend as well so the React dev server and CSS changes are picked up cleanly:

```bash
docker compose restart frontend
```

Or restart both in one go:

```bash
docker compose restart backend frontend
```

## 2. If you still don’t see changes

- **Rebuild and restart** (ensures the image and any non-mounted paths are up to date):

  ```bash
  docker compose build backend frontend --no-cache
  docker compose up -d backend frontend
  ```

- **Browser cache**: do a hard refresh so you get new JS/CSS:
  - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
  - **Mac**: `Cmd + Shift + R`

- **Check which code is running** (optional):

  ```bash
  # Backend: last-modified time of app.py inside the container
  docker compose exec backend ls -la /app/app.py

  # Frontend: confirm src is mounted
  docker compose exec frontend ls -la /app/src/index.css
  ```

## 3. Quick reference

| What you changed | What to do |
|------------------|------------|
| Backend (Python) | `docker compose restart backend` |
| Frontend (React/JS/CSS) | `docker compose restart frontend` or hard refresh |
| Both / not sure   | `docker compose restart backend frontend` |
| Still not applied | `docker compose build backend frontend --no-cache` then `docker compose up -d backend frontend` |

After restart, try adding a new app user again and check the user list (students first). If the UI still looks wrong on small screens, hard-refresh the browser to load the new CSS.
