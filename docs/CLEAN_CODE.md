# Clean code guidelines

This project uses shared tooling and conventions to keep the codebase clean and consistent.

---

## Frontend (React / JS / JSX)

### Tooling

- **ESLint** — Linting (no `console.log` in production code; unused vars; React/JSX rules).
- **Prettier** — Formatting (line length, quotes, semicolons, trailing commas).

Config: `frontend/.eslintrc.cjs`, `frontend/.prettierrc`, `frontend/.prettierignore`.

### Commands (from `frontend/`)

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix what ESLint can fix
npm run format      # Format with Prettier
npm run format:check # Check formatting only
```

### Conventions

- Prefer `console.warn` / `console.error` for real diagnostics; avoid `console.log` in app code.
- Use meaningful names; prefix unused params with `_` if needed.
- Keep components and hooks focused; extract helpers when logic grows.

---

## Backend (Python)

### Tooling

- **Black** — Code formatter (line length 100, Python 3.10+).
- **Ruff** — Linter (import order, common errors, style; config in `pyproject.toml`).

Config: `backend/pyproject.toml` (sections `[tool.black]` and `[tool.ruff]`).

### Commands (from `backend/`, with venv active)

```bash
pip install black ruff   # Optional dev dependencies
black .                  # Format all
black api app.py         # Format specific paths
ruff check .             # Lint
ruff check . --fix       # Lint and auto-fix
```

### Conventions

- Use `print()` only in scripts or CLI; in app code prefer proper logging.
- Keep functions and modules small; use type hints where they help.
- Follow Black’s formatting; Ruff enforces import order and selected rules.

---

## General

- **Imports** — Grouped and ordered (stdlib, third-party, local); tools enforce this.
- **Naming** — Clear, consistent names; avoid abbreviations except well-known ones.
- **Comments** — Explain “why” when non-obvious; remove commented-out code.
- **No debug clutter** — Remove or guard temporary `print`/`console.log` before committing.

Running format and lint before commits (or in CI) keeps the codebase clean over time.
