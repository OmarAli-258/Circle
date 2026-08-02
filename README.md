# Circle (working title)

A social coordination app: see when your friends are free, and get invited to (or propose) outings without a WhatsApp group chat argument.

## Why this exists

Organizing hangouts usually means a group chat, everyone slowly replying with availability, and someone eventually giving up and picking a time. Circle flips that: mark yourself free, and if a friend's availability overlaps with yours, you both find out at the same time — no one-sided "I said I was free and nobody responded."

## Roadmap / future ideas

Deliberately out of scope for now, but the current design keeps room for them:

- **Circles** — sub-groups of friends (close friends vs. wider circle), for finer-grained availability sharing.
- **Location/venue presets** — attach preferred hangout spots to your availability or an outing proposal.
- **Recurring availability** — "free every Sunday afternoon" instead of one-off windows.

## Stack

- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** React, TypeScript
- **Infra:** Docker Compose (local), GitHub Actions (CI)

## Status

Early development — see [PROGRESS.md](PROGRESS.md) for a running log.

## Local development

Setup instructions will go here once the backend skeleton is running.
