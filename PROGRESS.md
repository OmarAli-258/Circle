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

## 2026-08-01

### Generators and `yield` (practice/) — landed cleanly, first real try

Applied the recalibrated teaching approach (motivation first, one solid analogy — a waiter bringing food, then waiting, then clearing the table — mapped directly onto real code) and it worked on the first pass, no repeated attempts needed this time.

Core understanding, confirmed correct in own words: calling a generator function (one containing `yield`) does **not** run its code immediately — it builds a paused, not-yet-started object. `next(order)` is what actually runs it, up to the next `yield`, where it pauses and hands back the yielded value. Calling `next()` again resumes exactly where it paused. A function with N `yield`s needs N+1 `next()` calls to fully play out — the last of which raises `StopIteration`, Python's built-in signal that a generator has completely finished (even if that same call also ran real code first, like a `finally` block).

Connected to real code: `get_db()` in `database.py` is a generator so it can create a session, hand it over via `yield db`, pause while the endpoint uses it, then resume and clean up — `try`/`finally` guarantees `db.close()` runs whether the endpoint succeeded or crashed, since leaked open database connections are a real production problem.

### `get_current_user` dependency — auth infrastructure fully done

Added `get_current_user` to `security.py`: `HTTPBearer` extracts the token from the `Authorization` header, `jwt.decode` verifies its signature and unpacks the `sub`/`exp` payload (rejecting via `except jwt.InvalidTokenError` if tampered/expired), then looks up the real `User` by that id. Wired into a test endpoint (`GET /me`) using the exact same `Depends(...)` pattern as `db`.

New piece: `except` (the other half of `try`, alongside `finally` learned earlier) — `try` marks an attempt, `except SomeError:` marks what to do *specifically* if that particular error happens, versus `finally` which always runs regardless.

Good observation caught independently: `@app.get("/health")` looks different from the plain `@shout` decorator learned yesterday — because it is, in a precise way. `app.get("/health")` runs first (it's a normal function call with an argument), and *that call* returns the actual decorator, which then gets applied to the function below. This is a "decorator factory" — a function that builds a customized decorator rather than being one directly. Also, unlike `shout`, which replaced the function with a new wrapper, `app.get(...)`'s decorator mainly *registers* the function into FastAPI's routing table and hands it back essentially unchanged.

**Verified for real, three cases:** no token → `403` (FastAPI's `HTTPBearer` default for missing credentials). Garbage/invalid token → `401` with the custom message. Real token from a live login → actual protected user data returned via `GET /me`.

This completes all of auth's infrastructure. Next: the Week 2 design conversation (friend graph, availability, outing requests) before writing any of that code.

### Week 2 design conversation

**Friend model:** one table (`friend_requests`: `requester_id`, `recipient_id`, `status`, `created_at`), not separate "requests" and "friendships" tables — a friendship is just this one relationship changing state over time. Checking "are these two people friends" has to check both directions (`requester_id`/`recipient_id` could be either way round), since the row only remembers who originally sent it.

**Availability model:** one row per time window (`user_id`, `start_time`, `end_time`) — one-off only for now, no recurring patterns (deferred, but not a dead end: recurring could later just be a background job creating ordinary one-off rows on schedule). Timezone-aware UTC, same reasoning as `created_at`.

**Real product-design conversation, not just schema:** identified a genuine flaw in the core concept — broadcasting "I'm free" openly is socially risky (visible rejection if nobody responds), and is a bigger problem for the exact users who'd benefit most (less socially-connected people, for whom "always available" can read as a low-status signal). Solution decided: **mutual reveal** — availability is never shown to anyone until at least one other friend also has overlapping availability; only then do both get notified simultaneously. Directly borrowed from how dating apps solve one-sided visible rejection (mutual match, not visible one-way "likes"). This is purely an application/notification-layer decision — doesn't change the availability schema above, so it doesn't block current work.

**Deliberately out of scope for now, but kept in mind for how things are structured:** friend "circles"/sub-groups (close friends vs. wider circle), and location/venue presets attached to outings. Noted so visibility-checking logic gets kept as one isolated, named piece of code rather than scattered inline joins — cheap now, avoids a rewrite if circles get added later.

### `FriendRequest` model — first table with foreign keys

New concept: **foreign keys** — a column storing a reference to another table's row (`ForeignKey("users.id")`), which Postgres actively enforces (rejects inserts referencing a nonexistent user). Two real mistakes caught along the way: applying `unique=True`/`String(255)` to `requester_id` by copy-pasting from `email` without realizing a requester can legitimately appear many times across different requests (a real conceptual error, not just a typo), and `ForeignKey("user.id")` (singular) instead of `"users.id"` — foreign keys reference the actual table name, not the Python class name, same distinction as `__tablename__`.

Migration generated and applied the same two-step way as before; this one's `down_revision` correctly chains to the previous migration instead of `None`, and the generated file contains real `ForeignKeyConstraint` entries — visible, concrete proof the Python-level `ForeignKey` became a real database-enforced constraint. Verified directly in Postgres (`\d friend_requests`): both foreign keys correctly reference `users(id)`.

Next: the actual endpoints (send request, accept/decline, list friends).

## 2026-08-02

### Typed lists (practice/) — `list[SomeType]`

New notation: `list[str]` means "a list where every item is a string." Honest caveat learned: in plain Python this is just a label for humans/tools, not enforced at runtime — the real enforcement comes from Pydantic (same distinction as `Mapped[type]` alone vs `mapped_column`/`BaseModel`). Directly motivated by "list my friends" needing to return `list[UserOut]` instead of one `UserOut`.

### `POST /friend_requests` — first endpoint using `get_current_user` for real

First endpoint where `current_user: User = Depends(get_current_user)` is used for actual business logic (not just the `/me` test) — the requester is always whoever's really logged in, never something the client can specify/fake.

Real bugs, and a good lesson about consistency specifically: ended up with **three different spellings** of what should've been one field (`recipent_id`, `reciever_id`, `recivier_id`) spread across two schemas and the endpoint. None of it showed up as an import error — `FriendRequestCreate`/`FriendRequestOut` importing fine says nothing about whether their fields actually match each other or the real `FriendRequest` model's columns. Only actually calling the endpoint (a real signup → login → send-request flow via `curl`) would have surfaced it. Fixed by picking one canonical name (`recipient_id`, matching the real column) and making every reference consistent, rather than patching typos one at a time.

**Verified for real:** created a second user (Bob), sent a real friend request from the original account, got back `{"requester_id":1,"recipient_id":2,"status":"pending",...}`, and confirmed self-friend-requests are correctly rejected.

Next: accept/decline endpoints, then listing friends (`list[UserOut]`).

### `POST /friend_requests/{id}/accept` — path parameters + updating existing rows

Two new concepts: **path parameters** (`{request_id}` in the URL, matched to a function parameter of the same name — FastAPI extracts and converts it automatically), and **updating vs. creating** — `friend_request` came from `db.query(...).first()`, already tracked by the session, so changing `friend_request.status = "accepted"` and calling `db.commit()` is enough to trigger a real `UPDATE`; no `db.add()` needed (that's only for objects the session doesn't know about yet). Also introduced `403` (valid login, but not authorized for *this specific* action) as distinct from `401` (not authenticated at all).

One real bug: a missing comma in `HTTPException(status_code=400 detail=...)` — Python's own error message named the fix directly (`SyntaxError: invalid syntax. Perhaps you forgot a comma?`).

**Verified for real, three cases:** Bob accepting a pending request → status flips to `"accepted"`. The original requester trying to accept their own sent request → rejected with the `403`. Bob trying to accept the same request again → rejected with the `400` "not pending" check.

### `POST /friend_requests/{id}/decline`

Copy of `accept`'s shape with `"declined"` instead. Real bug caught: pasted the new endpoint but named the function `accept_friend_request` again — an exact duplicate name of the earlier function. Worth understanding precisely why this wasn't a crash: Python just silently rebinds the name to point at the second function, discarding the reference to the first — but since FastAPI's routing captures each function *at decoration time* (immediately, per the decorator lesson), both `/accept` and `/decline` likely still routed correctly to their own separate functions regardless. Still fixed by renaming to `decline_friend_request`, since the collision is genuinely confusing to read and would show up wrong in FastAPI's auto-generated `/docs`.

**Verified for real:** signed up a third user (Carol), sent her a request, declined it as Carol, confirmed `status: "declined"` in the real response.

Next: `GET /friends` — list a user's actual friends, returning `list[UserOut]` (today's practice concept) instead of one object.

## 2026-08-03

### List comprehensions (practice/) — already partly known

Basic form (`[n * 2 for n in numbers]` as shorthand for a `for` loop that builds a new list) was already familiar. New part: the conditional-expression variant, `X if condition else Y`, usable inside a comprehension — e.g. `[req.recipient_id if req.requester_id == current_user.id else req.requester_id for req in accepted_requests]`, which is exactly the "who's the other person" loop from `list_friends`, compressed to one expression. `if`/`else` here produces a value directly, unlike a normal `if`/`else` statement running separate code blocks.

### `GET /friends` — friend model fully complete

Needed a full second pass on the explanation (first attempt yesterday didn't land) — this time explained in the actual order the code should be read (function signature first, then body), which was the real source of confusion, not the SQL logic itself. Also cleared up a mixup between a loop variable (`req`, one item at a time) and the full list it iterates over (`accepted_requests`).

Real bugs: `User.id in_ (friend_ids)` instead of `User.id.in_(friend_ids)` — `.in_()` is a method, needs the dot, no space before its parentheses (same category as any other method call like `.first()`/`.all()`). Also `List[UserOut]` (capital, unimported `typing.List`) instead of `list[UserOut]` (the modern built-in style already used elsewhere).

**Verified for real, both directions:** `test@example.com` (the original requester) sees exactly Bob (the one accepted friend), correctly excluding Carol (declined). Bob — who was the *recipient*, not the requester — also correctly sees `test@example.com` back, confirming the bidirectional OR query works from either side.

This completes the entire friend model: send, accept, decline, and list, all built and verified. Next: the availability model.

Process note: starting next session, practice/ concepts will branch out to general job-relevant topics (testing, git workflows, data structures/algorithms) rather than only things strictly needed for this project.

### `Availability` model — third table, no new concepts needed

Same shape as `FriendRequest`: `id`, a foreign key (`user_id` → `users.id`), plain columns (`start_time`/`end_time`, no default — set explicitly each time), `created_at`. One real bug, a good retention check: wrote `ForeignKey("user_id")` instead of `ForeignKey("users.id")` — missed both the plural table name and the `.id` part. Migration generated and applied the same two-step way as before; verified directly in Postgres (`\d availability`) — real foreign key constraint pointing at `users(id)`.

Next: schemas + a `POST /availability` endpoint to actually create a window, then the harder piece — the mutual-reveal matching query.

### `POST /availability` — and the general "how to design a feature" checklist

Before writing this one, worked out the general thought process behind every feature built so far, as a reusable checklist rather than a one-off recipe: (1) what data needs storing → the model, (2) what the client sends to create one → the Create schema (never auto-generated/server-determined fields), (3) what's safe to send back → the Out schema, (4) what actions exist on this data → one endpoint per action, (5) per endpoint: does it need `current_user`? `db`? input data? any business-rule checks before touching the database?

Also clarified: FastAPI doesn't care about parameter *position* in an endpoint signature — it reads each parameter's *type hint* (a `BaseModel` → request body, `Depends(...)` → a dependency, a plain type matching `{path_param}` → from the URL). The reason body-schema parameters always end up listed first is a plain Python rule (parameters without a default can't follow ones that have one), not a FastAPI requirement.

Endpoint itself reused every known pattern; one real bug (`status=404` instead of `status_code=400` — both the wrong keyword *and* the wrong code, since this is a validation failure, not a "not found").

**Verified for real:** posted a real availability window (7-10pm), got back the full row; posting one with `end_time` before `start_time` correctly rejected.

Next: the mutual-reveal matching query — the hardest piece of Week 2.

### Overlap logic (practice/) — the hardest conceptual piece, solved and verified

Good pushback mid-design: a technical overlap of a single minute isn't practically useful, so refined the plan to require a **minimum overlap duration** (30 minutes), not just "do these ranges touch at all." Clean way to compute it: `overlap_start = max(start_a, start_b)`, `overlap_end = min(end_a, end_b)`, `overlap_end - overlap_start` gives the actual overlap length directly — comparing that to `timedelta(minutes=30)` naturally handles the "no overlap at all" case too (produces a *negative* duration, which just fails the minimum check on its own, no special-casing needed).

Also settled: input time granularity (should users be forced to pick times in clean 15/30-min steps?) is a **frontend** concern for Week 3, not something that changes the backend math — datetime subtraction doesn't care what granularity the values came from.

**Verified for real:** wrote `overlaps()` standalone, tested against a 15-minute (too-short) overlap and a real 1-hour overlap — both matched expectations exactly.

Next: apply this same logic to real availability rows pulled from the database, across a user and their friends.

### Extracted `app/utils.py` — real DRY moment

Good catch mid-session: `list_friends` and the new matching endpoint both needed the exact same "find accepted friend ids" logic — instead of duplicating it a second time, pulled it into a shared `get_friend_ids(user_id, db)` helper in a new `app/utils.py`, alongside the verified `overlaps()` function (moved there from `practice/`). Both endpoints now call the one shared function. Also discussed why there's no stored "friends list" column on `User` directly — same principle as not storing a redundant "confirmed" flag on outings: never store something derivable from a source of truth in a second place, since the two can drift out of sync.

**Stopping point (unfinished, picking up next session):** `get_availability_matches` in `main.py` has its `friend_ids` line but still needs: fetching `my_windows`/`friend_windows`, the nested loop comparing every pair using `overlaps()`, and the final query turning matched ids into real `User` records. Explained in full, not yet written or tested.

## 2026-08-04

### `GET /availability/matches` — finished, and the biggest real bug yet

Real production-grade error caught via actual testing, not just review: `Availability.user_id == Availability.user_id.in_(friend_ids)` — comparing a column to the *result* of an `.in_()` check (which is itself a true/false condition) instead of just using `.in_()` as the entire filter on its own. This didn't surface as a Python error at all — it passed import cleanly, and only broke when Postgres itself rejected the generated SQL: `operator does not exist: integer = boolean`, with the actual bad SQL shown directly (`WHERE availability.user_id = (availability.user_id IN (...))`). A good reminder that some bugs only show up as a *database* error, one layer past even a Python call-time error — checked via `docker compose logs backend` for the real traceback, since the client only ever sees a generic "Internal Server Error".

**Verified for real, the actual point of the whole feature:** `test@example.com` (free 7-10pm) and Bob (free 8-11pm, added specifically to create a 2-hour overlap) — calling `/availability/matches` as `test@example.com` correctly returns Bob. This is the first genuinely "smart" feature in the project — not just storing what a user typed, but computing something real across two people's data.

This completes Week 2's core domain entirely: friend model, availability model, and the mutual-reveal matching logic, all built and verified.

### Frontend kickoff — Node.js, Vite, and CORS

Deliberate scope decision: dip into frontend now with just signup/login (see it actually work end-to-end), then return to finish the backend (outings) afterward — rather than committing to the full dashboard right away. Also decided to learn plain React (JavaScript) first, adding TypeScript as its own separate later step, rather than both at once — same "one new thing at a time" lesson as everywhere else.

**Node.js** — explained as "Python's interpreter, but for JavaScript": lets JS run outside a browser, needed for build tools like Vite. **npm** is the same role as `pip`.

Scaffolded a new React project with Vite (`frontend/`, plain JS template) and installed dependencies. **CORS** explained: browsers block a page loaded from one origin (protocol+domain+port) from calling a different origin by default — our frontend (`:5173`) and backend (`:8000`) count as different origins even on the same machine — so the backend needed `CORSMiddleware` added explicitly allowing `http://localhost:5173`.

**Verified for real:** started the Vite dev server, confirmed the default React starter page actually renders in the browser.

Next: learn components/JSX, then build the real signup page.

### First real component — signup form markup (no logic yet)

Recalibrated mid-lesson: JS fundamentals are genuinely bare, not "mid" as originally assumed — same kind of recalibration as "Year 1 CS, not comfortable-with-basics" back in Week 1. Approach adjusted accordingly: small concrete steps, worked example → own version, same rhythm as the backend rather than more upfront explanation.

Core ideas covered: a component is a JavaScript function returning JSX (HTML-like markup embedded in JS, not the reverse); `{}` inside JSX drops back into real JavaScript values; `const [a, b] = something` is array destructuring (same idea as Python's `a, b = 1, 2`, just JS's version) — flagged as the likely actual sticking point rather than React itself.

Replaced the full Vite starter template with a minimal one-line component first, specifically to prove the edit-save-see-it-change loop (Vite's "HMR") before building anything real — same instinct as the backend's original `/health` check.

**Verified for real in the browser:** a working signup form — email input, password input, submit button — actually rendered, via `read_page` rather than just trusting the code.

Next: make the form actually do something — state to track typed input, then a real `fetch` call to `POST /signup`.

### Signup form fully working — first real full-stack frontend feature

Learned `useState` and controlled inputs (`value={x}` + `onChange={(e) => setX(e.target.value)}`) — clarified that `setX` only updates stored state, the input re-displaying is a *side effect* of that via `value={x}`, not `setX` touching the input directly. Also unpacked the event object `e`: browser-generated, describes what just happened; `e.target` is the actual element; `e.target.value` is its current text.

Found and worked around a real tooling limitation, not a code bug: the browser automation's simulated typing didn't register in this environment (confirmed by testing on a completely plain, logic-free input too) — real typing in an actual browser worked fine, a good reminder that automated verification has limits and manual testing is sometimes the more reliable check.

Explicit division-of-labor shift for frontend: Claude writes a larger share of the code directly going forward (frontend from scratch would take too long otherwise), while still pausing to explain new concepts and hand over practice-worthy pieces — different balance than the backend's "user writes domain code" default.

New concepts from the completed signup form: `async`/`await` (handling something that takes time without freezing the page), `e.preventDefault()` (stopping a form's default full-page-reload behavior), `fetch` (JS's built-in HTTP client — same role as `curl`/`requests`), `JSON.stringify`/`response.json()` (JS object ↔ JSON text, both directions), and `{condition && <jsx/>}` as a common "only render this if true" pattern.

**Verified for real, manually in a real browser (not automation):** filled in the signup form, submitted, got back a real confirmation message from the actual backend.

### Login page — division of labor corrected, and fully working

Course-corrected the frontend approach: the signup form was written entirely by Claude, which didn't match what the user actually wanted (write it themselves, with real explanation, same rhythm as the backend). Reset to: Claude writes true boilerplate/CSS only, user writes all interactive logic themselves — restored close to the original backend division rather than the overcorrection from the signup form.

Practiced `localStorage` (`setItem`/`getItem`) in isolation first — persists data across page reloads, unlike a `useState` variable which resets. Motivation: needed somewhere to actually keep the JWT after logging in.

Built `handleLogin` and its form through many real rounds of debugging — genuinely hard-won this time, not handed over: a misplaced closing brace that silently moved code *outside* the function (a real lesson in what "scope" means — `response` didn't exist once outside its own function's braces), `e.preventDefault` missing its call parentheses, `localStorage.setItem(token, ...)` using an undefined variable instead of a plain string key, a real `SyntaxError` from one extra closing parenthesis (caught via actual Vite error output, not review), and a harmless-but-sloppy trailing space inside `type="submit "`.

Also did a full, slow, line-by-line trace of `const response = await fetch(...)` — what a Promise is (a "claim ticket" for a reply that isn't ready yet), why `fetch` alone can't return the real data immediately, and what `await` actually does (pause until the real reply exists). This took several passes before landing, similar to decorators earlier in the project.

**Verified for real, manually, by the user:** signed up, then logged in with the same credentials, and got back "valid token" — a complete, self-written, working login flow, JWT actually saved in the browser.

This completes the "dip our toes in frontend" plan — signup and login both fully working. Next: either back to the backend (outings/requests), or continue the frontend (routing between pages, a real dashboard).

## 2026-08-05

### Outings — decided to defer CSS, back to finishing Week 2's last backend piece

Discussed when to do styling: agreed to defer it until more pages exist, so one cohesive design pass happens across the whole app rather than restyling piecemeal as each new page gets built.

Built `Outing` and `OutingInvite` models — first table with a genuinely **nullable** column (`cancellation_message`, `responded_at`): needs `Mapped[Optional[str]]` (not just `Mapped[str]`) plus `nullable=True`, and requires `from typing import Optional`. Real bugs, mostly repeats of earlier lessons (good retention check): `nullable` used as a bare undefined name instead of `nullable=True`; `default="unkown"` both misspelled and semantically wrong (should default to `"open"`, matching the actual designed states); `__tablenames__` (extra "s") on the second table — the exact same "must be spelled exactly" trap from the very first model; `ForeignKey(outings.id)`/`ForeignKey(users.id)` missing quotes entirely, same category of mistake as `Availability.user_id`'s foreign key earlier.

`OutingInvite` is the first table with two foreign keys pointing at **two different tables** (`outings` and `users`), rather than the same table twice like `FriendRequest` did.

**Verified for real:** migration generated and applied, both tables confirmed directly in Postgres with correct foreign keys in both directions (`outing_invites` shows up under `outings`' "Referenced by").

Next: schemas, then the `POST /outings` endpoint — which introduces a new pattern, creating *one* outing plus *several* invite rows in a single request.
