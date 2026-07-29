# Progress / Learning Log

A running log of what got built and what clicked (or didn't) each session.

---

## 2026-07-29

- Decided on the project: a social outing/availability coordinator ("Circle").
- Stack: FastAPI + SQLAlchemy + Postgres backend, React + TypeScript frontend, Docker Compose locally, GitHub Actions for CI.
- Set up Docker Desktop + WSL2.
- Scaffolding repo structure.
- Docker Compose running Postgres + a FastAPI backend skeleton. `/health` and `/health/db` both return 200 — confirmed FastAPI can actually reach Postgres through SQLAlchemy, not just that containers are running.
- Next: User model + auth (signup/login, password hashing, JWT) — this one I'm writing myself with guidance, not having it written for me.
