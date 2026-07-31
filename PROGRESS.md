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

### Concepts learned

- **ORM (Object-Relational Mapper):** a translator between Python (classes/objects) and Postgres (tables/rows). SQLAlchemy is an ORM — every piece of its model syntax exists to do this translation.
- **`__tablename__`:** a fixed, must-be-spelled-exactly-that-way class attribute that tells SQLAlchemy what to name the table in Postgres. The name itself never changes; the value you assign (e.g. `"users"`) is up to you.
- **Column line pattern:** every column is written as `column_name: Mapped[type] = mapped_column(...)` — two halves, both required:
  - `Mapped[type]` — the Python-side type hint (e.g. `Mapped[int]`, `Mapped[str]`). On its own it does *not* create a real database column, it's just a label for Python/editor tooling.
  - `mapped_column(...)` — the Postgres-side rules: primary key, unique, nullable, max length, default value. This is what actually builds the real column and its constraints.

### Working method (recalibrated after some genuine doubt today)

Had a long, honest conversation about feeling behind, forgetting concepts fast, and being unsure this approach was working. Landed on: worked example first, then I adapt/write it myself, then **I run it and bring back the real error** instead of getting it pre-corrected. That's the piece I skipped on past AI-heavy projects and it's the thing actually worth practicing. If doubts pop up mid-session, note them and keep moving instead of stalling.

### First real debugging rep

Finished the `User` model (`id`, `email`, `hashed_password`, `created_at`). Along the way: learned `default=` on `mapped_column`, why `datetime.utcnow()` is deprecated (returns a "naive" datetime with no timezone — modern code should use `datetime.now(timezone.utc)`), and what a `lambda` is (a quick unnamed, callable-later function — needed here because SQLAlchemy calls `default` with zero arguments, but `datetime.now` needs one).

Typed `lamda` instead of `lambda` and ran `docker compose exec backend python -c "import app.models"` myself — got a real `SyntaxError` with a file/line/caret pointing right at it, found the typo, fixed it, re-ran, got silence (= success). First real "read a traceback and fix my own bug" rep of the project.

### Migrations (Alembic) — set up, not yet run

- **Migration:** a small file recording one change to the database schema over time — like a git commit, but for the database's structure instead of code. Needed because hand-writing `CREATE TABLE`/`ALTER TABLE` SQL for every model change doesn't scale, and keeps everyone (or every environment) in sync.
- **Alembic:** the tool that auto-generates migrations by diffing SQLAlchemy models against the live database, then applies/reverts them in order.
- Claude wired the plumbing (`alembic init`, pointed `env.py` at our real database URL and at `Base.metadata` so it knows about `User`) — that part's config, not learning-critical.
- **Still to do tomorrow:** run `alembic revision --autogenerate -m "create users table"` myself, read the generated migration file before applying it, then `alembic upgrade head` to actually create the table in Postgres.

### How to think about memorizing all this (meta note)

Asked directly: am I supposed to memorize all this syntax? Answer that stuck: no — professionals don't memorize exact API syntax either (argument names, exact spellings), they look that up constantly, every day, forever. What's actually worth internalizing is the *concepts* (ORM = translator, migration = versioned schema change, hashing = one-way) since those transfer across every language/framework. Syntax is a recognition-and-lookup skill, not a memorization one — this log is the lookup reference, not a study sheet.

Pacing note: aiming for ~2 hours/day on this project.

## 2026-07-30

### Migration applied — first real table

Ran `alembic revision --autogenerate` (generated a migration file describing the `users` table) then `alembic upgrade head` (actually applied it). Verified directly in Postgres with `docker compose exec db psql -U circle -d circle -c "\d users"` — all four columns present, `id` has a real auto-increment sequence (`nextval('users_id_seq')`, created automatically from `primary_key=True`), and the `email` unique constraint shows up as a real index.

Took a few tries to understand the migration file itself — the confusion was not realizing it was a *generated* file (Alembic wrote it from diffing `models.py` against the empty database), not something typed by hand. Full loop now clear: Python class in `models.py` → `alembic revision --autogenerate` diffs it and writes a migration file → `alembic upgrade head` actually applies it to Postgres. This pattern (describe schema in code, let a tool diff + generate + apply migrations) generalizes to any serious backend framework, not just SQLAlchemy/Alembic (Django's `makemigrations`, Rails' ActiveRecord migrations, etc. — same idea, different tool names).

### Password hashing (`security.py`) — done and verified

Wrote `hash_password`/`verify_password` using `bcrypt`. Real bugs hit and fixed along the way:
- `b.password` instead of `password.encode()` — `.encode()` turns a string into bytes; `b.` isn't valid syntax at all.
- Forgot `.decode()` on the hash before returning it (bcrypt gives bytes back; we want a string to store).
- Wrote `hash.decode()` instead of `hash.encode()` in `verify_password` — Python's own error message named the fix (`'str' object has no attribute 'decode'. Did you mean: 'encode'?`).
- Learned the difference between **import-time errors** (syntax problems, caught just by importing a file) and **call-time errors** (logic/name mistakes inside a function body, only surface once you actually call it with real arguments) — this is why `hash_password`'s bug didn't show up until it was actually called, not just imported.

Confirmed working end to end: hashed a test password, `verify_password` returned `True` for the correct password and `False` for a wrong one.

Pacing note: agreed to stop pausing for Socratic back-and-forth on simple, already-stated syntax recall — save that for genuinely new concepts, just give direct answers for small recall items to keep speed up.

### Pydantic schemas (`schemas.py`)

A schema is a class describing the *shape of API input/output* — separate from `models.py`, which describes the database. Each `field: type` line is both documentation and an actual enforced validation rule; FastAPI builds a real validated Python object from incoming JSON automatically, or rejects the request before endpoint code runs.

- `UserCreate` — signup request shape: `email: str`, `password: str`.
- `UserOut` — safe response shape: `id`, `email`, `created_at` — **deliberately excludes `hashed_password`**. First draft included it by mistake; caught as a real security issue (that field existing in a response schema would leak the hash to every client), not just a style nit.
- `model_config = {"from_attributes": True}` — lets a Pydantic schema be built from a real object's attributes (`user.id`) rather than only a dictionary (`data["id"]"`) — needed since we'll build `UserOut` directly from a SQLAlchemy `User` row.

### Signup endpoint — full auth loop closed

Wrote `POST /signup` in `main.py`, tying together everything so far: `UserCreate` validates the incoming request, checks for a duplicate email via `db.query(User).filter(...).first()`, hashes the password with `hash_password`, builds a new `User` object, saves it (`db.add` / `db.commit` / `db.refresh`), and returns it through `response_model=UserOut` so the hash never leaks out.

New concepts: **dependency injection** (`Depends(get_db)` — declare what you need as a parameter, FastAPI supplies it and cleans it up after), **`response_model`** (validates *and filters* what a route returns — a second layer of protection beyond just not including a field in the schema), and the fact that **function type-hints/annotations are evaluated immediately when a file is imported**, not lazily — which is why a missing `Session` import crashed the whole app at import time, while a bug inside a function body (like the earlier `security.py` mistakes) only surfaces when that function is actually called.

Hit the "file exists but is empty on disk" issue twice more (`security.py`, then `schemas.py`) — worth remembering as a recurring gotcha: always confirm the file is actually *saved* in the editor (no unsaved-changes dot on the tab) before assuming code that was typed is code that exists.

**Verified for real, not just trusted:** POSTed a real signup request via `curl`, got back `{"id":1,"email":"test@example.com","created_at":"..."}` with no password field, then queried Postgres directly and confirmed the row exists with a bcrypt hash (`$2b$12$...`) in `hashed_password` — never the plaintext.

### Full review pass

Went back through every concept from this session one at a time (containers/WSL2, ORM, `default=`/lambda, migrations, hashing, schemas, dependency injection, `response_model`, import-time vs. call-time errors) — migrations needed a second, more concrete pass (grounded in the actual real commands/files from this project instead of an analogy) before it landed.

Checked in afterward: couldn't rebuild any of this from a blank page yet, and that's the expected state after one sitting covering ~8 genuinely new areas — not a flaw in the approach. What's already real and independently-owned: debugging several actual errors from a traceback alone (the `lambda` typo, the missing `Session` import, the unsaved-file `ImportError`s). The metric that actually matters going forward: does each repeat of a pattern need less scaffolding than the last, not "can I do this cold today."

## 2026-07-31

### Decorators (practice/) — took many passes, finally landed

Spent a long time on `@decorator` syntax — abstract description, code trace, runtime proof (`.__name__`), atomic step-by-step, and a story analogy (a comedian + a hype-man who does a drumroll/applause around the joke) before it actually stuck. Final correct understanding, in own words: a decorator function (like `shout`) runs *once*, immediately, at the moment `@shout` is written above a function — it builds a new function (`wrapper`) that does something before/after, and *that* is what actually runs on every future call, not `shout` itself again. The point of it: apply the same extra behavior to many different functions without copy-pasting that behavior into each one — which is exactly what `@app.get`/`@app.post` have been doing this whole project (registering routes) rather than "printing before/after."

Key lesson on process: too many different explanations stacked back-to-back stopped helping and started being noise. What worked in the end: one complete, connected, plain-language explanation in a single message (no fragments), followed by a concrete non-code analogy, followed by mapping that analogy's exact words onto the real code line-by-line.

### JWT + create_access_token

New vocabulary, defined plainly: a JWT's "payload"/"claims" is just a dictionary of facts stored in the token. `"sub"` (subject) = who the token belongs to; `"exp"` (expiration) = when it stops being valid — both special key names the `jwt` library specifically looks for. `jwt.encode(payload, secret, algorithm=...)` signs that dictionary into one scrambled string using a secret only the server knows, so tampering breaks the signature.

Real bugs hit and fixed via the run-it-yourself loop: `timedelta.utc` instead of `timezone.utc`, `user_id.name` instead of `user_id` (found out the hard way that `user_id` was already a plain int, not an object with a `.name`), and `settings.jwt.secret` instead of `settings.jwt_secret` (plus a missing import of `settings` entirely). Verified for real: called `create_access_token(1)` and got back an actual three-part JWT string.

### Login endpoint — auth is now fully done

Added `UserLogin`/`Token` schemas and `POST /login`: look up by email, reject with a **generic** error (`"incorrect email or password"`) if either the user doesn't exist or the password is wrong — deliberately the same message either way, so a failed attempt never reveals which part was incorrect. On success, issues a real JWT via `create_access_token`.

One real bug: imported/used `Userlogin` (lowercase `l`) in `main.py` while the actual class was `UserLogin` (capital `L`) in `schemas.py` — Python names are case-sensitive, so this would have failed to import.

**Verified for real, all three cases:** correct credentials → real JWT back. Wrong password → `{"detail":"incorrect email or password"}`. Nonexistent email → the exact same message, proving no information leaks about which part failed.

This closes out Week 1 (auth) — signup, login, and JWT issuance all working end-to-end. Next: a dependency that reads a JWT back off future requests to identify "who's calling this endpoint," then the Week 2 design conversation (friend graph, availability, outing requests) before writing any of that code.
