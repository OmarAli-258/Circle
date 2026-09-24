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

## 2026-08-24 (back after a two-week break)

Environment came back up cleanly after three weeks stopped (Docker restarted fine, `/health`/`/health/db` both still passed). Did a compact review pass over the whole stack (models, migrations, hashing, schemas, DI, JWT, decorators, React basics) rather than a full deep re-teach — some things had faded a bit, judged acceptable to let resurface naturally while continuing rather than re-teaching everything up front.

### `OutingCreate`/`OutingOut` schemas

Real bug caught: `cancellation_message: str` in `OutingOut` — needed to be `Optional[str]`, mirroring the model's own nullable column (most outings aren't cancelled, so this field is usually `None`; a non-optional schema field would fail validation on every uncancelled outing). Also cleared up *why* `model_config = {"from_attributes": True}` belongs only on `OutingOut` and not `OutingCreate`, by tracing exactly how each gets constructed in real code: `OutingCreate` is built by FastAPI from raw incoming JSON (a dict), `OutingOut` is built from a real `Outing` database object via `response_model` (needs dot-attribute access).

### `POST /outings` — two-stage save, and a real division-of-labor correction mid-session

User caught Claude reverting to "here's the code" instead of "here's the reason, then the pieces that lead to it" — corrected explicitly and applied for the rest of the session. Settled rule going forward: genuine new-concept/logic mistakes stay the user's to work through; trivial typos (missing commas, misspellings of already-known syntax) Claude just points out and fixes directly, no need to burn a full debug cycle on those.

Core new idea: `OutingInvite` rows need a real `outing_id` to reference, which doesn't exist until the `Outing` itself is saved — so this endpoint saves in two stages (create+commit+refresh the outing alone first, *then* loop to create invite rows using the now-real id), unlike every previous endpoint's single save. Needed a second, concrete pass (a real Alice/Bob/Carol example: one outing row, two invite rows sharing the same `outing_id`) before the abstract version actually landed.

Real bugs, each explained with reasoning before the fix: `OutingInvite(outing_id=outing_data.id, ...)` — a genuine mix-up between `outing_data` (the client's original request, which never has an `id` at all) and `new_outing` (the real saved row, which does after `db.refresh`); committing/refreshing inside the invite loop instead of batching one `db.commit()` after it (not broken, just an unnecessary extra database round-trip per invitee); and a missing `return new_outing` entirely, which `response_model=OutingOut` needs something real to build from.

Also fixed in passing: the CORS middleware block had been accidentally deleted from `main.py` at some point — restored directly, along with catching that `Outing`/`OutingInvite`/`OutingCreate`/`OutingOut` were being used but never actually imported.

**Verified for real:** created a real outing with `test@example.com` inviting Bob, confirmed both the outing and a correctly-linked `outing_invites` row (`outing_id`/`invitee_id` matching) directly in Postgres. Confirmed inviting a non-friend (Carol, whose request was declined) is correctly rejected.

This completes outing creation — the core of Week 2's outings feature. Still ahead: accept/decline for outing invites, and cancelling an outing.

### `POST /outing_invites/{id}/accept` and `/decline`

Built almost entirely independently this time, directly mirroring `accept_friend_request`/`decline_friend_request` — right structure, right order of checks on the first real attempt, after one genuine conceptual correction: the first draft tried to build a *new* `OutingInvite(status="accepted")` instead of fetching and updating the *existing* one — the same "update vs. create" distinction from the very first accept endpoint, resurfacing as a real mistake rather than just remembered trivia, which is a more honest test of whether it actually stuck.

Also caught, self-flagged: a URL path (`{outings_invite}`) that didn't match its function's actual parameter name (`invite_id`) — reinforced that FastAPI links path parameters by exact name, not position or vibes.

Real bug, and a good live proof of the import-time vs. call-time lesson: `datetime`/`timezone` were never imported in `main.py`, but `import app.main` succeeded anyway, since `datetime.now(timezone.utc)` sits inside a function body, not a type hint — only evaluated when the function actually runs. Confirmed by actually calling the endpoint and getting a real `NameError` from the server logs, then fixing the import.

**Verified for real, three cases:** Bob accepting a real invite (status flips, real `responded_at` timestamp); accepting the same invite again correctly rejected as already-responded; a second outing/invite created and successfully declined.

Outings feature is now functionally complete for the MVP scope: create, accept, decline. Cancelling (with the optional message) is the last piece, if wanted, otherwise ready to return to the frontend.

## 2026-08-25

### pytest (practice/) — first real automated tests

Motivation: every verification so far has been manual (`curl`, checking Postgres by hand, reading logs) — doesn't scale, since changing anything later means remembering to re-check everything by hand again. Automated tests write the check once, as real code, rerunnable in seconds forever. Directly motivated by yesterday's honest CV assessment flagging "no tests" as a real gap.

`assert` just checks something is `True`; if not, it raises an error right there. `pytest` runs every function named `test_...` and reports which `assert`s failed and what they expected vs. got. Installed `pytest` on host Python (separate from the Docker-based backend stack, since `practice/` files run standalone).

Turned the already-manually-verified `overlaps()` function into two real tests — one confirming a real overlap is detected, one confirming a non-overlap is correctly rejected (a boundary-touching case, a legitimate variant of the originally-suggested "too short" case, not a mistake).

**Verified for real:** `python -m pytest practice/2026-08-25_pytest_intro.py -v` → `collected 2 items`, both `PASSED`. First real exposure to pytest's actual output format, unmodified from what a real job would show.

### Routing + the dashboard's first real feature — the token finally gets used

Installed `react-router-dom`, split the single `App.jsx` into `pages/SignupPage.jsx`, `pages/LoginPage.jsx`, `pages/DashboardPage.jsx` — Claude's to set up directly (infrastructure), then explained fully: `BrowserRouter`/`Routes`/`Route` (URL → component), `Navigate` (redirect, used for `/` → `/login`), `Link` (navigate without a full reload), `useNavigate` (same idea, triggered from code — sends the user to `/dashboard` right after a successful login).

Needed several full restarts on `useEffect`/`async` — genuinely felt like starting from zero on JS again despite prior reps, which is an honest, expected place to be this early in a second language/paradigm, not a regression. What eventually landed: `useEffect(() => {...}, [])` runs code automatically once, on page load, instead of only in response to a click; `async` permits a function to pause, `await` is where the pause actually happens (a real, useful correction from "async means wait till done" to "async permits it, await is where it happens"). Also corrected a real mixup: the JWT comes from `localStorage` (separate, persistent browser storage from an earlier page), not from the `useState` memory slot being built in the same breath — two genuinely different storage mechanisms getting conflated.

Also explained fully from scratch (per explicit request to stop leaning on "same as before" for frontend): `currentUser && <p>...</p>` — `&&` short-circuits to its left side when that's `null`/falsy, so nothing renders until real data exists; the moment `setCurrentUser` fills it in, the right side renders instead.

**Verified for real:** got a real token via `curl` login, injected it into the browser's `localStorage` directly (since simulated typing doesn't register in this environment), loaded `/dashboard`, and it actually fetched `/me` automatically and rendered "Logged in as test@example.com" — real, automatic, token-authenticated data on screen for the first time.

Next: build out the rest of the dashboard — friends, availability, matches, outings — reusing this same fetch-with-token pattern repeatedly.

### Friends list on the dashboard — second rep of the fetch pattern, plus rendering a list for the first time

Real bugs while adapting `fetchUser`'s pattern to `displayFriends`: reflexively tried `localStorage.getItem("friends")` — a genuine mixup between two different storage mechanisms (the `useState` memory slot being built in the same breath, vs. `localStorage`, the separate persistent browser storage the token — and only the token — actually lives in). Also: forgot to call `displayFriends()` at all at first, then placed the call *inside* the function's own body (accidental infinite self-recursion) before landing it outside, mirroring `fetchUser`/`fetchUser()` exactly. Also missed the `[]` second argument on the second `useEffect` — properly explained this time: without it, an effect reruns after every re-render, and since fetching triggers a re-render, that's a real infinite-fetch-loop risk, not just a style nit.

New rendering concept: `.map()` to turn an array of data into an array of JSX elements — `{friends.map(friend => <p key={friend.id}>{friend.email}</p>)}` — same idea as a list comprehension on the backend, JS's version. `key` is required on each item so React can tell list items apart when the list changes.

Debugging note: chased a phantom `useEffect` console warning and repeated 401s that turned out to be pure stale history accumulated in one long-lived browser tab across many server restarts and edits — resolved by testing in a genuinely fresh tab, which showed zero errors. Good reminder that a console's accumulated history isn't the same as its current state.

**Verified for real:** real friends list rendered on the dashboard — `bob@example.com`, `test@example.com`'s one actual accepted friend, fetched live and displayed via `.map()`.

## 2026-08-26

### `onClick` (practice/) — the plain, non-form version of `onSubmit`

Motivation: every fetch so far was triggered by submitting a form; a plain button (like an upcoming "Accept" or "Send request" button) needs the simpler, form-free version. Practiced in a standalone plain-HTML file (no React, no dev server) — `element.onclick = handleClick` is the non-React version of the same idea; no `preventDefault()` needed since there's no form's default reload behavior to stop.

### `GET /friend_requests/pending` — new backend endpoint for the frontend's sake

Real bugs, both caught before running: `response_model=[FriendRequestOut]` instead of `list[FriendRequestOut]` — the former is an actual Python list *containing the class*, not the `list[SomeType]` type-hint syntax from the typed-lists practice exercise; and a missing second filter condition (`status == "pending"`) — the first draft only checked the recipient, returning *every* request ever sent, accepted/declined included, not just ones still awaiting a response.

**Verified for real:** signed up a new user (Dave), sent him a fresh request from `test@example.com`, and confirmed `GET /friend_requests/pending` (as Dave) correctly returns exactly that one pending request.

Next: switch `send_friend_request` to accept an email instead of a raw `recipient_id` — better UX, since a real user wouldn't know another person's numeric id.

### `send_friend_request` switched to email-based lookup

Real bug, a repeat of the earlier `outing_data.id`/`new_outing.id` mixup: used `request_data.recipient_id` (a field that no longer exists on the request at all) instead of `recipient.id` (the real id of the user actually found by the email lookup). Also caught a schema/endpoint mismatch — the endpoint referenced `request_data.recipient_email`, but `FriendRequestCreate` still had the old `recipient_id: int` field; forgot to update the schema alongside the endpoint at first, then initially left the corrected field typed as `int` instead of `str`.

Simplified the explanation after it landed as "convoluted" — restated as five plain steps (find the person → check two things can go wrong → stop on either → build with the real found id → save and return) rather than a caveated, reordering-focused explanation.

**Verified for real:** sent a friend request by email (`dave@example.com`), confirmed the backend resolved it to the real `recipient_id: 5`. Confirmed the self-request guard still works using email comparison instead of id comparison — a different, equally valid way to write the same check.

### `FriendRequestOut` gained `requester_email`

The pending-requests dashboard section was rendering blank — `FriendRequest` only ever stored `requester_id` (a number), never an email, so there was nothing for the frontend to display. Added `requester_email: str` to the schema and, in every endpoint returning a `FriendRequestOut` (send, accept, decline, list-pending), built the response object manually with an extra `User` lookup instead of handing the ORM row straight to Pydantic — there's no SQLAlchemy `relationship()` wired up yet to do that join automatically.

**Verified for real:** created two fresh test users, sent a request between them, and confirmed the JSON response actually included `requester_email` at every stage (send, list-pending, accept).

### Accept button — first `onClick` with an argument in real code

New concept: passing an argument into a click handler requires wrapping it in an arrow function — `onClick={() => handleAccept(friend_request.id)}` — since `onClick={handleAccept(friend_request.id)}` would call the function immediately at render time instead of waiting for a click. Also the first `POST` fetch (previous ones were all default `GET`), and a real case-sensitivity bug: wrote `onclick` (lowercase, valid in plain HTML) instead of JSX's `onClick`, which React silently ignores rather than erroring on.

Also restructured `displayFriendsList` out of its `useEffect` into a standalone function, so `handleAccept` can call it again after a successful accept — this is what makes the accepted request disappear from the list immediately, without a manual page reload.

**Verified for real:** created a fresh pending request between two test accounts, clicked Accept in the actual browser, confirmed `POST /friend_requests/{id}/accept` hit the backend (`docker compose logs`), confirmed the request left the database's pending list (fresh `curl` to `/friend_requests/pending` returned `[]`), and confirmed the UI removed it from screen with no reload.

Next: `handleDecline` — same shape as `handleAccept`, swapping `/accept` for `/decline`.

## 2026-08-27

### Git branching practice (general, `master`/branch/merge/`reset --hard`)

Worked through the real branch lifecycle in this repo: `git checkout -b practice-branch`, committed a throwaway change on it, switched back to `master` and watched the change disappear (a genuine "oh, branches really are separate" moment — briefly looked like a bug when the editor kept showing stale content after the checkout, but that was just the editor not re-reading the file from disk, not a git issue), merged it back in, then used `git reset --hard HEAD~1` to fully undo the merge commit once we realized it was just noise — confirmed safe since it was the tip commit and nothing else was pushed anywhere.

### `handleDecline` — second `onClick`-with-argument rep

Built as a close mirror of `handleAccept` (same shape: get token, POST fetch, refresh the pending list after) — real repetition of yesterday's new concept rather than a new one. Two real bugs on the first pass: `https://` instead of `http://`, and `/friend_request/` (singular) instead of `/friend_requests/` (plural) — both caught before testing, neither was a guess-and-check fix.

**Verified for real:** fresh test request created via curl, clicked the live Decline button in the browser, confirmed `POST /friend_requests/{id}/decline` hit the backend with `200 OK`, confirmed the request left "Friend Requests" without a reload, and confirmed it correctly did *not* get added to "Friends" (declining shouldn't create a friendship).

Next: a form to send a new friend request by email, directly from the dashboard.

### Send Friend Request form — first real `<form>` built from scratch on the dashboard

New concepts: the `submit` event (fires on the `<form>`, triggered by pressing Enter in an input or clicking a `type="submit"` button — not something the button/input itself fires), and combining a form submission with an authenticated POST for the first time (`LoginPage`'s form has no auth token since you're not logged in yet; `handleAccept`/`handleDecline`'s POSTs aren't form submissions). Real bugs caught along the way: writing `if (response.ok) :` / `else:` — Python's colon-based block syntax used out of habit where JS needs curly braces `{ }`, which would've been an outright syntax error; storing the whole response object in `message` instead of just `data.detail`, which would've crashed React trying to render an object as text; and a function name mismatch (`handSentInformation` defined vs `handleSentInformation` referenced in `onSubmit`), caught before it ever ran.

Also planned a rough wireframe (via a visual mockup) for the dashboard's eventual full shape — Friends / Friend Requests / Send Request / Availability / Outings as consistently-wrapped `.dashboard-section` cards — so upcoming sections have a CSS-ready structure without blocking on real visual design yet. Retrofitted the two existing sections to match.

**Verified for real:** submitted the actual form in the browser (via a real DOM `input`/`submit` event, not just a JS fetch call), confirmed `POST /friend_requests` hit the backend with `200 OK`, confirmed the success message rendered, and confirmed the *recipient's* own `/friend_requests/pending` (checked via a separate login) genuinely showed the new incoming request — end to end through the real UI, not simulated.

## 2026-08-28

### Post-availability form — `datetime-local` inputs, first solo attempt at a new form

New concept: `<input type="datetime-local">`, controlled the same `value`/`onChange` way as every other input so far, just with a different string format (`"YYYY-MM-DDTHH:MM"`). Real bugs caught before running: a stray-space header key (`" Authorization "` instead of `"Authorization"` — would have thrown at the `fetch` call itself, since HTTP header names can't contain spaces), and a genuine key/value inversion in the request body — `{availabilityStart: start_time, ...}` instead of `{start_time: availabilityStart, ...}`, i.e. using the frontend's own state names as the JSON keys and referencing undefined variables as the values, rather than the backend's expected field names as keys with the real state as values. Also discussed `response.ok` properly for the first time: `fetch` does not throw on a non-2xx HTTP response (400/404/422/etc.) — only on genuine network failures — so checking `response.ok` manually is the only way to detect a rejected request. Noted but left unfixed: FastAPI's automatic 422 validation errors return `detail` as a list of objects, not a plain string, which would crash `{availabilityMessage}` if it were ever hit — acceptable known gap for now, unlikely to trigger from a `datetime-local` input in normal use.

Ran short on time, so Claude finished the JSX form itself (same shape as the Send Friend Request form, wired to the already-user-written `handlePostAvailabilty`) rather than the user typing it — an explicit exception, not the default.

**Verified for real:** submitted the actual form via real DOM events in the browser, confirmed `POST /availability` hit the backend with `200 OK`, and confirmed the success message rendered.

Next: a section showing actual availability matches (`GET /availability/matches`) — right now you can post a window but never see who it matched with.

## 2026-09-21

Back after a month-long internship break. Set a hard deadline: finish the remaining scope in 5 days at ~3 hrs/day. Remaining work reviewed and re-scoped: matches display, a missing `GET /outing_invites/pending` backend endpoint, outings UI (create form with a new friend-multi-select pattern, plus a repeat of the accept/decline pattern), logout, protected routes, a CSS pass, then tests/CI/deployment as stretch goals — deployment flagged as the highest-variance item to cut first if short on time.

### Availability Matches display — third rep of the fetch+`useState`+`.map()` pattern

Pure repetition of the Friends-list shape (`GET /availability/matches`, already built and working). Two real bugs, both understood before fixing: called `displayMatched` with no parentheses and outside any `useEffect` — which wouldn't have run it at all, and if it *had* run directly in the render body, would have caused an infinite re-render loop (fetch → `setMatchedFriends` → re-render → fetch again, forever) — same reason every other fetch here lives inside a `useEffect` with `[]`; and later, `<p key={friend.id}>friend.email</p>` written without curly braces around `friend.email`, which JSX renders as the literal text "friend.email" rather than evaluating it as a real property lookup.

**Verified for real:** posted two overlapping availability windows via curl for two already-friended test accounts, confirmed the backend returned the correct match, then confirmed the actual dashboard UI rendered `verifya@example.com` under "Matches" with no console errors.

### `GET /outing_invites/pending` — new backend endpoint, repeat of the `/friend_requests/pending` pattern

Built solo as a direct mirror of `my_friend_requests`. Three real bugs, all fixed before running: inconsistent route naming (`/outing/pending` instead of `/outing_invites/pending`, breaking from the `/outing_invites/{id}/accept`/`decline` convention already in use); `List[OutingInviteOut]` using the unimported capital-`L` typing generic instead of the built-in lowercase `list[...]` — a repeat of an old, previously-made mistake, would have crashed at import with `NameError`; and the real logic bug, `current_user.id == OutingInvite.id` — comparing against the invite's own primary key instead of `OutingInvite.invitee_id` (who the invite is actually for), the same category of mistake as August's `Availability.user_id == Availability.user_id.in_(friend_ids)` bug.

**Note for the upcoming outings UI:** `OutingInviteOut` only carries `outing_id` (a bare number), not the outing's title/location/time — same gap `FriendRequestOut` had before `requester_email` was added. Will need the same fix (join/manual lookup) before the invites list is actually readable to a user.

**Verified for real:** created a real outing via curl (`verifya` inviting `verifyb`), confirmed `verifyb`'s `/outing_invites/pending` correctly returned it as a pending invite.

### `OutingInviteOut` enriched with real outing details — same fix as `requester_email`, applied to a new pair of tables

Added `outing_title`/`outing_location`/`outing_time` to the schema (response shape only, no database migration — `OutingInvite` the table stays untouched), then manually built the enriched response in all three endpoints that return it (`accept_outing_invite`, `decline_outing_invite`, `my_outing_invites`), looking up the related `Outing` row by `outing_id` each time. Several real bugs worked through across multiple passes: trying `.append()` on a single ORM object instead of building one directly (confusing "this endpoint returns one item" with "this endpoint returns a list" — `accept`/`decline` handle exactly one invite, `my_outing_invites` needed the opposite fix, a genuine `for` loop + `result.append(...)`, since it returns a list); missing commas between keyword arguments in the constructor calls; a bare `(key=value, ...)` with the class name `OutingInviteOut` missing before the parentheses, which isn't valid Python syntax at all outside a real function call; forgetting the `Outing` lookup entirely in `decline_outing_invite` after writing it correctly in `accept_outing_invite`; and querying `OutingOut` (the Pydantic response schema) instead of `Outing` (the real SQLAlchemy model) — a genuinely important distinction (only real models back actual database tables and are queryable; `*Out` schemas just describe API response shapes).

**Verified for real:** created a second outing between two already-friended test accounts, confirmed `my_outing_invites` returned both pending invites with their real titles/locations/times, then accepted one and declined the other — both responses correctly included the real outing details, and the pending list correctly emptied out afterward.

### Outing Invites display + Accept/Decline — fourth rep of the fetch+`.map()`+buttons pattern

Direct mirror of the Friend Requests section. Real bugs along the way, mostly variable-scope related: a case mismatch between the declared state name and its use in `.map()`; `localStorage.getitem(token)` — wrong capitalization *and* referencing the `token` variable as its own initializer before it existed; two missing `await`s; a function defined but never called (`dispalyOutingInvites`, also misspelled); the refresh calls (`displayOutingInvites()`) placed *after* the handler functions' closing braces instead of inside them, meaning they ran on every render instead of after an accept/decline — same infinite-loop risk as the earlier `displayMatched` bug; Accept/Decline buttons written as `onClick={() => function}` (the literal keyword, not a real call) and placed outside the `.map()` entirely, where `invite` doesn't exist at all (a variable defined inside `.map()`'s arrow function only exists inside that function). The last and most interesting bug, caught only via the browser console rather than by reading the code: `displayOutingInvites` was defined *inside* its own `useEffect`, invisible to `handleAcceptOuting`/`handleDeclineOuting` — exact repeat of the original `displayFriendsList` scoping bug from weeks ago, fixed the same way (pulled out to a standalone function, `useEffect` just calls it).

**Verified for real:** created fresh outing invites via curl across two test accounts, clicked real Accept and Decline buttons in the browser (via genuine DOM click events after confirming coordinate-clicks weren't landing on a backgrounded tab), confirmed both `POST /outing_invites/{id}/accept` and `/decline` hit the backend successfully, and confirmed the UI correctly removed each invite from the list with no manual reload — first checked in a tab with stale console history (which showed a misleading leftover error), then re-confirmed clean in a genuinely fresh tab.

## 2026-09-22

### Create Outing form — friend multi-select via checkboxes, the first genuinely new frontend concept in a while

New concept: an array of selected ids (`invitedFriends`) driven by a toggle function using `.includes()` (checked/unchecked) and either `.filter()` (deselect) or spread (`[...invitedFriends, id]`, select) — the checkbox equivalent of a controlled text input, just checking array membership instead of comparing a string. Real bugs worked through, several rounds: `useState=([])` (stray `=`), `[invitedFriends, id]` instead of spreading (created a nested array, not a flat one with the id appended), `useState(datetime-local)` (a bare, undefined identifier used as a value instead of a string), `e.targetValue` instead of `e.target.value` (missing the dot — directly tied to a recurring point of confusion about what `onChange`/`e.target.value` actually are, walked through with a full click-by-click trace), a body key mismatch (`proposedtime` vs the backend's `proposed_time`), `response.ok()` (called as a function; it's a plain boolean property, no parentheses). The core conceptual bug: initially mapped over `invitedFriends` (the selected subset) instead of `friends` (the full list) to render checkboxes — mixing up "the data to loop over" with "the data used to check membership inside the loop."

**Verified for real:** filled out and submitted the actual form in the browser (real DOM events: text inputs, a datetime input, and a checkbox click), confirmed `POST /outings` hit the backend with `200 OK`, confirmed the "Outing created" message rendered, and confirmed the invited friend's own `/outing_invites/pending` genuinely showed the new outing with correct title/location/time — end to end through the real UI, not simulated. This completes the entire outings feature (backend + frontend).

Next: logout button, protected routes, then a CSS pass — the last non-stretch items before tests/CI/deployment.

### Logout button — first use of `useNavigate` outside `LoginPage`

New import (`useNavigate` from `react-router-dom`, already known from `LoginPage`) plus one new method, `localStorage.removeItem("token")` — the delete counterpart to `setItem`. No fetch involved at all, the simplest handler in the file. Two small bugs: a naming-convention slip (`handlelogout`, all lowercase, inconsistent with every other `handleX` in the file — fixed for consistency, not because it would've broken); and the real bug, `onClick={() => handleLogout}` — the arrow function's body was just the bare function name, which evaluates to a reference to the function without ever calling it, so nothing would have happened on click. Needed either `onClick={handleLogout}` (no wrapper, since no argument is needed) or `onClick={() => handleLogout()}` (wrapper, but actually invoking it) — went with the latter.

**Verified for real:** logged in as a real test user, clicked the actual Logout button in the browser, confirmed `localStorage`'s token became `null` and the URL redirected to `/login`, no console errors.

### Protected route check — redirect to `/login` if there's no token

Simplest approach given the time budget: a `useEffect` in `DashboardPage` itself checking `localStorage.getItem("token")` on load, redirecting via `navigate("/login")` if missing — not a dedicated route-guard wrapper component, which would've been the more reusable approach if there were more than one protected page. Real bugs: missing the `[]` second argument on the `useEffect` entirely (would've re-run on every render, same category as the earlier `displayMatched` infinite-loop risk); `token.notreal()` — not real JavaScript, a placeholder attempt at "check if missing" — the actual tool is the negation operator, `!token`, since `localStorage.getItem` returns `null` (falsy) when the key doesn't exist; and the function defined but never called (`checkLogin` needed `()`), a now-familiar repeat mistake.

**Rough edge fixed same session:** all the dashboard's *other* `useEffect`s were firing in parallel on mount regardless of whether the redirect was about to happen, producing a wall of 401s before the redirect completed. Fixed by adding a guard clause — `if (!token) return` — right after grabbing the token in each of the five fetch functions (`fetchUser`, `displayFriends`, `displayFriendsList`, `displayMatched`, `displayOutingInvites`), so the actual network request never fires at all when there's no token. Applied directly (mechanical repetition of the same two-line fix five times), not written by the user this time.

**Verified for real:** cleared the token and visited `/dashboard` directly — confirmed the URL correctly ended up at `/login` with zero console errors this time (previously produced 10 401s). Separately, with a real valid token in a fresh tab, confirmed the dashboard still renders normally with zero errors — no regression from the guard clauses.

Next: CSS/styling pass — the last non-stretch item before tests/CI/deployment.

### CSS pass, round 1 — design direction researched, base system + Dashboard/Login/Signup styled

Before writing any CSS, actually researched rather than guessing: looked at Partiful (the closest real comp — an actual "plan hangouts with friends" app) for a reference point, 2026 color-trend sources for what reads as warm/friendly right now, typography pairing guidance, spacing/border-radius scale conventions, icon libraries, and what recruiters/hiring managers actually look for in a CV-facing project (clean and functional over illustrated/animated). Landed on: a warm cream base, coral as the primary accent (buttons, primary actions), a plum second accent for "positive outcome" moments (Matches, Create Outing) chosen over teal/dusty-blue/olive alternatives that were mocked up side by side first, Poppins for headings + Inter for body text, an 8px spacing scale, and a two-value border-radius scale (8px controls, 14px cards) — deliberately skipping icons, illustrations, and animation as low-value time sinks against the deadline.

Implemented in `frontend/src/index.css` (rewritten from the unused Vite boilerplate defaults) plus Google Fonts links in `index.html`: CSS custom properties for the whole palette/spacing/radius/font system, base typography, styled form elements, the `.dashboard-section` card treatment (retroactively also given a `--plum` variant), and new small structural classes (`.list-row`, `.row-actions`, `.btn-secondary`, `.page-header`) added to `DashboardPage.jsx`'s existing JSX to give each list item and the header row real layout instead of default inline flow. Also gave `LoginPage`/`SignupPage` a proper centered card layout (`.auth-page`/`.auth-card`) instead of unstyled top-left content, and deleted the now-fully-unused `App.css` (Vite boilerplate, never imported by `App.jsx`). Fixed a small content bug found along the way: the "Outing Invites" heading read as "OUTINGINVITES" once uppercased by CSS, because the JSX text had no space between the two words.

**Verified for real:** screenshotted the styled Dashboard, Login, and Signup pages in the browser: cards, warm/plum color roles, and typography all render correctly with zero console errors (confirmed in a fresh tab after an initial stale-console false alarm). Ran an actual login through the real, now-styled form (real DOM input events, not simulated state) and confirmed it still redirects to `/dashboard` correctly — no functional regression from the styling changes.

Next: continue the CSS pass section by section with the user driving decisions live in their own browser, then tests/CI/deployment as stretch goals.

### CSS pass, round 2 — researched real login-page comps, then labels + autoComplete everywhere

Corrected process mid-round-1: user wants the CSS pass genuinely one piece at a time with a live look after each piece, not batched — and wants a plain-language explanation after each change even though Claude is writing this code, not just a diff summary. Applying that from here on.

Researched real login page design comps (Headspace validated the current calm/simple direction; Dribbble's split-screen-with-art and Tasky's illustrated approach were both noted but ruled out as scope-inappropriate) and login-form UX best practices, then filtered to what's realistic for a 5-day CV project: added real `<label>` elements (connected via matching `htmlFor`/`id`, replacing placeholder-only fields) and `autoComplete` attributes (`"email"`, `"current-password"` on Login, `"new-password"` on Signup so browsers offer to generate rather than reuse a password) across Login and Signup, then extended labels (without `autoComplete`, since it doesn't semantically apply) to every other form on the dashboard — Send Friend Request, Availability, Create Outing. Explicitly named and deferred as out of scope: SSO, passkeys/OTP, multi-step onboarding — enterprise-scale auth features inappropriate for this project's timeline.

**Verified for real:** confirmed every label's `htmlFor` correctly matches its input's `id` via the DOM, confirmed `autoComplete` values landed correctly, and ran both an actual login and an actual outing creation through the real, now-labeled forms — both still work identically to before, no functional regression from the accessibility markup change.

Still flagged, not yet done: no loading state on submit, no show/hide password toggle, no autofocus on the first field — deliberately queued as separate future pieces rather than batched into this one.

### README rewrite — researched what actually moves the needle for recruiters, then rewrote it

Research (visual design fundamentals, what hiring managers actually weigh in a portfolio project, common signs of an unfinished project, what creates a "premium" feel) converged on one unexpected finding: `README.md` and a real live demo are repeatedly named as the *primary filter* hiring managers use, ahead of extra visual polish — and the actual README was still the week-one stub (said "TypeScript" despite going plain JS weeks ago, no setup instructions, no screenshots, no feature list). Rewrote it with real, tested-against-the-actual-files setup steps (`.env.example` → `docker compose up -d` → `docker compose exec backend alembic upgrade head` → `npm install && npm run dev` — confirmed migrations aren't run automatically by the Dockerfile, so that step is genuinely required), an accurate feature list, corrected tech stack, and two screenshot slots.

Screenshots needed a real device: populated a test dashboard with a pending friend request, a match, and an outing invite so the screenshot shows the app actually doing something, then the user captured and saved them — first attempt landed in the wrong folder with wrong capitalization (`docs/Dashboard.png` instead of `docs/screenshots/dashboard.png`), found via `find` and moved/renamed to match exactly. Confirmed both are real, correctly-sized PNGs of the actual working app.

**Not yet resolved:** user still can't see the images rendering wherever they're currently viewing the README — most likely viewing the raw markdown source in an editor rather than a rendered preview (e.g. VS Code's Markdown Preview, `Ctrl+Shift+V`), or looking at GitHub.com before this was pushed there. Diagnosis handed off, not yet confirmed fixed — pick this up first next session.

Also identified (not yet acted on) a longer list of research-backed suggestions for the "recruiter impressed" goal: empty states for empty lists, distinct success/error message styling, button hover/active transitions, an actual mobile-width check, a small pre-login landing page, reconsidering deployment's stretch-goal status, and a multi-column grid layout on larger screens. Prioritized in that rough order by cost-to-value, with the README being the highest-value/lowest-cost item — now done.

## 2026-09-23

### README image issue resolved — was never actually broken

Confirmed: the images, paths, and files were all correct the whole time. User was viewing `README.md` in VS Code's plain text editor tab, which never renders markdown (images show as literal `![alt](path)` text) — the fix was simply opening the rendered preview (`Ctrl+Shift+V`). No code or file changes needed.

### Empty states — a deliberate split, not a uniform treatment

Discussed the actual purpose of an empty state first: it's not about making empty space look full, it's about removing the ambiguity between "correctly empty" and "broken." Landed on a split rather than one blanket approach, reasoned per section: **Friends** gets a real empty-state message (`"No friends yet — send a request below to get started."`, written as an invitation rather than an apology — bare "No friends" was avoided on purpose) since it's a core, always-relevant identity list even for a brand-new user. **Friend Requests**, **Matches**, and **Outing Invites** instead hide their entire card when empty — all three are notification/pending-action-style lists that are empty most of the time for most users, so showing a permanent empty card year-round is just clutter. The **Matches** case has a nice bonus justification tying back to the project's own original design idea: the "mutual reveal" concept was always about showing nothing until both people are actually free at the same time, so hiding the section until a real match exists is thematically consistent, not just a style choice.

Implemented as conditional rendering (`{list.length > 0 && (...)}` wrapping the whole card, versus `{list.length === 0 && <p>...</p>}` for the one section that keeps showing) — the same `&&` pattern used since the very first `{currentUser && <p>...}` line, just applied to whole sections instead of single lines.

**Verified for real:** created a brand-new test account with zero friends/requests/matches/invites, confirmed Friends showed the invitation message and the other three sections were completely absent from the page; then switched to an account with real data in all four categories and confirmed every section rendered normally — no regression, zero console errors either way.

### Real bug found by the user: expired token crashed the whole dashboard to a blank page

User hit a genuine, previously-hidden bug: with an expired/invalid token, every fetch got a `401`, and the error response body (an object like `{"detail": "..."}`) got stuffed directly into state that the JSX expects to be an array — `friends.map()` then threw `TypeError: friends.map is not a function`, an uncaught error that unmounts the entire React tree, producing exactly the "loads for an instant then goes blank" symptom described (confirmed via the actual browser console, not guessed). This had never surfaced before because all prior testing used freshly-minted tokens.

Diagnosed collaboratively: asked what the URL bar and console showed rather than guessing blind, which confirmed it was a crash (page stayed on `/dashboard`, no redirect) rather than the existing protected-route check doing something wrong. Fixed by adding `if (!response.ok) { localStorage.removeItem("token"); navigate("/login"); return }` to all five read-only fetches (`fetchUser`, `displayFriends`, `displayFriendsList`, `displayMatched`, `displayOutingInvites`) — a `401` specifically means "this session is no longer valid," so the correct behavior is a real logout-and-redirect, not just silently swallowing the error.

**Verified for real:** set an actual garbage token and confirmed the dashboard now cleanly logs out and redirects to `/login` with zero uncaught errors (only the expected, harmless 401 network log entries), then re-confirmed a real valid token still renders the fully populated dashboard with zero errors, in a genuinely fresh tab.

### Message styling, loading states, and button feedback — the rest of the cheap CSS/UX bundle

All applied by Claude directly (mechanical, repeated across five forms), explained afterward: added `--danger`/`--success` colors, `.form-message` now defaults to red (since `LoginPage` only ever shows errors — it navigates away on success), with a `.form-message--success` green override for the four forms that can show either outcome (Signup, Send Friend Request, Availability, Create Outing). Each of those four got a companion `messageIsError`-style boolean state, set alongside the existing message text in both the success and failure branches, purely to drive which CSS class gets applied — the same "pair a boolean with a value" pattern already used for `invitedFriends`. Also added an `isSubmitting`-style boolean per form (5 total): true at the start of the submit handler, false once it resolves, disabling the button and swapping its label ("Send" → "Sending...") while a request is in flight — prevents double-submits and gives real feedback instead of a submit button that looks inert while waiting on the network. Button styling globally got a `transition` on background-color/transform plus `:active { transform: scale(0.97) }` and a dimmed `:disabled` state.

**Verified for real:** triggered a genuine signup error (duplicate email) and confirmed red styling; triggered a genuine signup success (fresh email) and confirmed green styling with the correct `form-message--success` class and computed color; triggered a genuine friend-request error (self-request) on the dashboard and confirmed the same red/no-modifier behavior there too.

### Mobile check — two real overflow bugs found and fixed

First actual test at a phone-width viewport (375px), never checked before. Login rendered cleanly with no changes needed. The dashboard had two real bugs: the page header (title + email + Logout button) overflowed horizontally, cutting the Logout button off past the edge, since three items in a `justify-content: space-between` row don't wrap by default when they don't fit; and the Friend Requests row had the same problem — a long email plus two buttons ran off the right edge instead of dropping to a new line. Fixed with `flex-wrap: wrap` (plus a `gap`) on `.list-row`, and a `@media (max-width: 480px)` rule that stacks `.page-header` into a column instead of a single row below that width.

**Verified for real:** re-screenshotted both pages at 375px width after the fix — header now stacks cleanly, Friend Requests/Outing Invites rows wrap the buttons onto their own line instead of overflowing, and every other section (Matches, Create Outing, checkboxes) was already fine. Confirmed no regression on desktop width afterward.

### Landing page, part 1 — navbar and hero built, researched before writing any code

Researched simple landing page structure and navbar conventions before building anything, on top of earlier SaaS landing-page research. Landed on a deliberately small scope for the timeline: navbar (logo + Log in/Sign up), a hero with a benefit-led headline, one real screenshot, one CTA, and — planned next — a short "how it works" section. Explicitly discussed and ruled out stock photography/illustration for filling empty space on wide screens: research is clear that stock imagery is a top 2026 landing-page mistake, and the actual fix for "feels empty on a full browser" is layout (full-width background bands, a two-column hero split, a large real screenshot), not decorative content.

Built by the user: `LandingPage.jsx` from scratch — nav, then a two-part hero (`hero-split` > `hero-text` + `hero-image`), first real use of `<h1>` on the site (discussed why: it's the one page that's the actual front door, versus every other page's `<h2>` title used for a page that isn't the site's main entry point). Real bugs along the way: the screenshot's `src` pointed at `/docs/dashboard.png`, a path Vite's dev server has no reason to serve — `docs/` is the project's own root folder for the README, entirely outside `frontend/public/`, which is the only place Vite serves files from directly at the URL root. Fixed by copying the real screenshot into `frontend/public/dashboard-preview.png` and pointing `src` at that instead.

Built by Claude (CSS, per the established split): the `#root` global max-width was moved into a new `.page-container` class (applied only to `DashboardPage`, since `LoginPage`/`SignupPage` already self-center via `.auth-page`) so the landing page could go full-width — the two-column hero-split layout with a `@media (max-width: 800px)` stack-to-column fallback, navbar styling, and a small custom SVG favicon (two overlapping coral/plum circles) replacing the default Vite lightning-bolt icon — chosen to literally represent the product's own "two people's availability overlapping" idea rather than being generic.

**Verified for real:** confirmed the screenshot actually loads (`200 OK`, real natural dimensions, `complete: true`, checked via the DOM/network directly after a screenshot-tool rendering glitch gave a misleading blank view) — side-by-side split renders correctly on desktop width and correctly stacks to a single column on a 375px mobile viewport, zero console errors either way.

Next: "how it works" section, then decide on deployment/tests/CI with the remaining time.

### Landing page, part 2 — replaced the dashboard screenshot with a crafted "match" card

User pushback, and correct: a literal screenshot of the busy, mostly-white dashboard form wasn't distinctive, and felt redundant since that page is one click away anyway. Replaced it with a small, hand-built card recreating just the one moment the whole product is actually about — two colored initial-avatars (coral/plum, matching the site's own palette and the favicon's two-overlapping-circles idea), "You and Jordan are free," a time. Still "real product, not stock art" in spirit — it's literally this app's own UI language, just curated to show the payoff instead of a whole busy page — plus a slow CSS `box-shadow` pulse animation (`@keyframes`, `animation: ... infinite`) so it reads as "something just happened" rather than a static image.

Built directly by Claude given the visual-design nature of the task (mocked up first, user approved, then implemented) rather than taught line by line — consistent with how the color-palette and font decisions earlier in the CSS pass were handled. Removed the now-fully-unused `dashboard-preview.png` from `frontend/public/` afterward rather than leaving dead weight behind.

**Verified for real:** confirmed the new match-card renders correctly and the pulse animation is applied on both desktop (side-by-side hero split) and a 375px mobile viewport (stacked, centered), zero console errors either way.

### Landing page, part 3 — the match-card animation moved to the real Dashboard, once-per-match

User's follow-up idea: the landing page's infinitely-looping pulse is fine as ambient decoration on a marketing page, but would feel wrong replayed forever on the actual dashboard — instead, each real match should get a one-time "the two of you just matched" animation (avatars sliding together, `translateX` `@keyframes`, no `infinite`), and it should never replay for a match already seen, even across page reloads. That "survives a reload" requirement meant `localStorage` again, but storing something more than a single string this time — a JSON-encoded array of already-seen match (friend) ids, read with `JSON.parse(... || "[]")` and written back with `JSON.stringify([...old, ...new])`.

Real bug caught only by testing live, not by reading the code: React's `StrictMode` (already on, in `main.jsx`) deliberately runs every effect twice in development specifically to catch bugs like this one. The first run correctly found a genuinely new match and wrote it to `localStorage` as seen; the second run then read `localStorage` *after* that write and saw zero new matches, overwriting the first run's correct state with an empty list — a real bug where the effect's own side effect corrupted its second, redundant run. Fixed with `useRef` (`seenAtLoadRef`) to snapshot the "already seen" list exactly once per page load, since a ref (unlike a plain re-read of `localStorage`) survives StrictMode's double-invoke without re-reading data the first invocation just mutated.

Reused the landing page's `.match-card` styling for the dashboard's own Matches section (replacing the old plain `.list-row` per-friend text), scoped the landing page's infinite pulse specifically to `.hero-image .match-card` so it doesn't leak onto the dashboard's version, and gave the dashboard version a one-shot `match-slide-in-left`/`-right` animation via a conditional `match-card--animate` vs `match-card--settled` class instead.

**Verified for real:** created three genuinely fresh test accounts and a real new match via curl, confirmed on first dashboard load the new match got `--animate` while an older, already-seen match correctly stayed `--settled`; reloaded again with no new matches and confirmed *both* had settled — proving "plays once per match, never again" actually holds across real page reloads, not just within one session.

### Landing page, part 4 — a real bug hunt that ended in a design fix, not a code fix

User reported the dashboard animation "didn't work." Rather than guess, walked through the whole chain link by link: (1) is the match correctly flagged new — confirmed yes, via a console one-liner printing every card's class name; (2) are the right CSS animation properties actually attached — confirmed yes, via `getComputedStyle`; (3) does the animation actually play frame-by-frame in a real browser — genuinely inconclusive in Claude's own automated browser tool (animation state read `"running"` but the transform never advanced even after 9+ real seconds — flagged honestly as a likely limitation of that tool's background frame-compositing rather than claimed as proof of a bug); (4) does the resting position actually look like "joined circles" — this one was a real, confirmed problem: the avatars were sliding into a gap-with-a-"+"-sign layout, never actually overlapping, a design left over from before the favicon's overlapping-circles motif existed and never reconciled with it.

User's own live check (DevTools' Animations panel, then a direct visual check) ended up confirming link #3 was fine all along — they'd been retesting a match that had already used its one-time animation on an earlier check, so of course nothing new played; a genuinely fresh match (a 5th test account) showed a real, if subtle, slide. That subtlety plus the wrong resting shape is what read as "barely moved, then back to normal."

Fixed both remaining issues together: avatars now truly overlap at rest (negative `margin-left` pulling the second one under the first, a thin border in the card's own background color so the overlap reads cleanly rather than the two colors just smearing together), the "+" sign removed entirely from both the landing page hero and the dashboard cards, and the animation slowed and lengthened (0.4s delay/1.4s duration/55px slide → 0.6s/2.2s/80px) specifically so the now-more-dramatic "coming together" motion is actually visible rather than glimpsed.

**Verified for real:** screenshotted both the landing page hero and all four of `matchtest1`'s dashboard match cards after the fix — genuine overlapping circles with a clean separating ring, no "+" sign, confirmed correct on both desktop and a 375px mobile viewport.

### Landing page, part 5 — animate only once the card actually scrolls into view

User's next request: the animation was firing immediately on page load regardless of scroll position, so by the time you scrolled down to the Matches section it had often already finished. Implemented "animate on scroll into view" using `IntersectionObserver` — a browser API not used anywhere else in this project yet. One shared observer instance (created once in a `useEffect`, held in a `useRef` so it survives re-renders) watches every match card via a callback ref (`ref={observeMatchCard}`, called individually for each card rendered inside the `.map()`), and only adds a card's id to a new `visibleMatchIds` state once it's actually ≥50% on screen — then immediately `unobserve()`s that card, since it only needs to fire once. The animate class now requires *two* conditions together: `newMatchIds.includes(friend.id) && visibleMatchIds.includes(friend.id)` — genuinely new *and* actually visible, not just one or the other.

Hit the same tooling limitation as the earlier CSS-timing check: a bare, minimal `IntersectionObserver` attached directly to an already-fully-visible element in Claude's own automated browser tool never fired at all, confirming (rather than guessing) that this specific tool's browser pane doesn't run a continuous compositing/paint loop unless something is actively requesting a screenshot — not a bug in the code. Handed verification to the user's own real browser instead, which doesn't have that limitation.

User confirmed live: scrolling into the Matches section correctly triggers a still-unseen match's animation exactly as it enters view, not before — but the slide-in itself was overflowing past the card's rounded border during the animation's early frames (the 80px starting offset extended beyond the card's padded edge). Fixed with `overflow: hidden` on `.match-card` — clips anything sliding past the edge cleanly, without affecting the card's own `box-shadow` (a box's shadow is drawn outside its border as a separate rendering step, unaffected by its own `overflow` property) or the landing page's pulse animation.

**Verified for real:** confirmed the pulse/overlap/border still render correctly on the landing page hero after adding `overflow: hidden`, and the user directly confirmed the scroll-triggered animation now stays visually contained within the card on their own real browser.

### Landing page, part 6 — clipping fine-tuning, two rounds

User's real-browser check found the coral (left) avatar was invisible for most of the slide — its starting offset (80px) pushed it past the card's left padding entirely, into the clipped zone, while the right avatar had more slack and stayed visible. First attempt: shrank the slide distance (80px → 40px) and added `padding-left: 40px` specifically to `.match-card-avatars` for extra buffer. That fixed the clipping but broke visual alignment — the avatars ended up indented further right than the label/text above and below them, since only that one element got the extra padding, not the card's other content.

Corrected: reverted the avatars-only padding, shrank the slide distance further (40px → 22px, safely inside the card's existing 24px padding), and — for the final "barely clips" sliver — nudged the *card's own* left padding slightly (24px → 30px on that one side) instead of any single inner element, so every piece of content (label, avatars, text) shifts right together as one unit, preserving alignment while still giving the animation just enough buffer.

**Verified for real:** confirmed alignment stayed correct on the landing page hero after each change, and the user directly confirmed on their own real browser, across several fresh test matches, that both avatars now stay fully visible and contained throughout the slide with no clipping and no misalignment.

## Big multi-part request, mapped out before implementation (user was stepping away, asked for a written plan to resume from)

Independent tester feedback (5 recommendations) reviewed and folded into the plan: matching correctness (old availability still matching, timezone mismatches, duplicate friend requests) — all confirmed valid, some newly identified; full-journey gaps (Friends/Matches don't refetch after actions, no "your accepted outings" view, no real notification) — all valid, notification flagged as likely too large for remaining time; tests/CI — valid, already on backlog; deployment safety (hardcoded `localhost:8000` everywhere in the frontend, DB port publicly exposed in `docker-compose.yml`, JWT secret needing a real check) — all valid, deployment-blocking; "get 5-10 real friends to use it" — valid advice, not a coding task.

**Agreed order**: A) shared logged-in nav (Login redirects to `/`, landing page shows Dashboard button when logged in, Dashboard gets a logo-link back to `/` — Login/Signup explicitly do *not* get this logo) → B) Dashboard width + two-column Friends/Friend-Requests layout → C) real bug fixes (refetch-after-action gaps, duplicate friend requests, expired-availability matching, timezone handling) → D) an actual "your outings" section → E) richer match-card details (after C, D, and after the user's own "how it works" section) → F) username field (isolated, most invasive) → then back to the original backlog: tests/CI, deployment-safety prep, deployment, dark mode.

### Part A — shared logged-in navigation

`LoginPage` now redirects to `/` instead of `/dashboard` on success. `LandingPage` reads `!!localStorage.getItem("token")` once on mount (a lazy `useState` initializer, so it only checks once, not every render) and conditionally renders either `Dashboard` (logged in) or `Login`/`Sign up` (logged out) in the nav, using a React Fragment (`<>...</>`) to group the two logged-out links without an extra wrapper div. `DashboardPage` gained its own small nav bar (reusing the landing page's `nav` styling) containing just a clickable "Circle" logo linking back to `/` — this required moving the nav *outside* `DashboardPage`'s existing `.page-container` div (which caps width at 640px), since nesting it inside would have squeezed the nav to that same narrow width instead of spanning full-width like the landing page's version.

**Verified for real:** cleared `localStorage` and confirmed the landing page shows Login/Sign up when logged out; logged in through the real form and confirmed it lands on `/` (not `/dashboard`) with the nav now showing just "Dashboard"; clicked through to the real dashboard and confirmed its new logo link correctly returns to `/`, which still correctly showed "Dashboard" (not Login/Sign up) afterward. Checked both pages at a 375px mobile width too — nav and page-header both still stack and render cleanly.

### Part A follow-up — hero CTA + small hover polish

User caught one inconsistency: the hero's own "Sign up" CTA (separate from the nav button) still said "Sign up" even while logged in. Fixed by giving `LandingPage` a real `handleSignOut` (clears the token, updates `isLoggedIn` state, navigates to `/login` — same shape as `DashboardPage`'s existing `handleLogout`) and conditionally rendering a `<button>` instead of the `<Link>` when logged in. Since it's a real `<button>` now, not an `<a>`, the existing `.hero-text a` CSS rule needed extending to `.hero-text a, .hero-text button` so it keeps the same visual weight either way.

Also added two small hover touches: the "Circle" nav logo's text now shifts to coral on hover (a `transition: color` on the span, triggered via `nav a.nav-logo:hover span`) so it visibly reads as clickable instead of just being plain bold text; and the match-card (purple box) now lifts up slightly and deepens its shadow on hover (`transform: translateY(-6px)` + a stronger `box-shadow`, both transitioned smoothly) as a small "this is alive" touch, applying to every match-card on the site (landing hero and dashboard) since they all share the same class.

**Verified for real:** confirmed the hero shows "Sign out" while logged in, clicked it for real, and confirmed it correctly cleared the token and landed back on `/login`.

### Part B — Dashboard width + Friends/Friend-Requests layout (went through two real redesigns)

First attempt: `.page-container` (only ever used by `DashboardPage` — confirmed via a repo-wide search before touching it) widened 640px→960px, Friends and Friend Requests wrapped in a flex row (Friends narrower, Requests wider). Worked, but the user's actual mental picture was different — a real three-column dashboard: Friends as a persistent rail on the left, Friend Requests as a rail on the right, and *all* the other sections (Send Friend Request, Availability, Matches, Outing Invites, Create Outing) forming one center column between them, not just Friends/Requests paired at the top with everything else stacked below.

Rebuilt as a genuine CSS Grid: `.dashboard-layout { display: grid; grid-template-columns: 200px minmax(0,1fr) 240px; }` — Friends and Friend Requests as fixed-width side rails, everything else moved into a new `.dashboard-center` flex column in the middle track. (Right rail's 240px vs. left's 200px is deliberate — Friend Requests needs room for Accept/Decline side-by-side without cramping, the exact tradeoff flagged as a concern before building it.) A `--no-right-rail` modifier drops to two tracks when there are no pending requests, so Friends doesn't end up looking like an orphaned column.

First pass at this also briefly explored a **sticky-rail** variant (rails pin in place while you scroll the center) as a second option to compare against a plain static one. Real bug hit building it: `align-items: start` on the grid shrinks each rail's box down to its own content height, leaving `position: sticky` no room to move within — fixed (before it was decided against) by splitting each rail into an outer stretched grid cell plus an inner sticky card, the standard "sticky sidebar in CSS Grid" pattern. Verified the fix was real, not just visually assumed: `getBoundingClientRect()` at two different `scrollY` values both returned the same pinned `top: 96`, proving it actually stuck — needed because this tool's own browser pane doesn't reliably repaint mid-scroll for a screenshot (same limitation hit earlier with the match animation), so a screenshot alone right after scrolling wasn't trustworthy evidence.

User picked **static**, not sticky — but caught a real remaining problem even in static: the rail cards were only as tall as their own content, leaving visible blank page background below them while the center column kept going, and asked to fix that specifically. Fixed by dropping the sticky-only wrapper split (no longer needed) and letting the rails be direct grid children again — CSS Grid's default `align-items: stretch` (simply not overriding it) then stretches each rail's own visible card down to match the tallest column's height, so their white background/border fills the space instead of leaving it blank. Also caught the center column was too narrow relative to the two rails (456px of a 960px page, well under half) despite the goal being to keep the middle "big" — fixed by widening `.page-container` again, 960px→1200px, giving the center ~696px without shrinking either rail.

**Verified for real:** confirmed in the browser that both rails' backgrounds now stretch the full height to match the center column with no blank gap below them; confirmed the center column measures ~696px of the 1200px container (up from 456/960); confirmed at 375px mobile width everything correctly drops to one stacked column with rails back to natural (unstretched) height.

### Part B, round 3 — equal rails, wider middle, real overflow fix, then a legitimate second look at the width

User picked the earlier full-stretch treatment over content-height, but flagged it back with an annotated screenshot: rails uneven width (200/240), the middle still not wide enough, a lot of unused cream margin outside the container on their monitor, and the original text-overflow bug still real in the live app (a mockup had shown the fix, but it hadn't been ported into actual CSS yet). Before touching code, built three static comparison mockups on a design canvas (content-height / full-stretch / a modest partial-fill) since the user asked to see pictures before another live iteration — the user picked the partial-fill direction (Option 3).

Implemented for real: `.dashboard-layout` grid columns changed to equal `260px minmax(0,1fr) 260px`, rails given a flat `min-height: 320px` (not tied to the center's actual height — a fixed value, same trick the mockup used) with `align-items: start` so they no longer auto-stretch to full height, and a small `+ Add another friend` prompt line pinned to the bottom of the Friends card via `margin-top: auto` so the extra height reads as intentional. `.page-container` widened 1200px→1800px per "we want them touching the side." The real overflow fix: `.dashboard-rail-left .list-row` switched to `display: block` + `text-overflow: ellipsis` (Friends rows are plain text, safe to convert from flex), and for Friend Requests (which has an email span *and* a button-group span sharing the row) only the email span gets `min-width: 0` + ellipsis while `.row-actions` gets `flex-shrink: 0`, so buttons never get squeezed.

Asked for an honest opinion afterward, unprompted by any complaint: 1800px genuinely edge-to-edge looked wrong, not because "wide" is bad but because the actual content (short lists, one-line form fields) is sparse — a 680px-wide email input just looks empty, unlike apps (Gmail/Slack) that fill real width with real content like tables. Recommended and applied a middle ground: `.page-container` pulled back 1800px→1400px, and — the more important fix — capped `.dashboard-center input[...]` at `max-width: 420px` so form fields stay a sane size regardless of how wide the container is, instead of chasing the "right" container width forever.

**Verified for real:** confirmed equal 260px/260px/320px-min rails, confirmed the Friend Requests row still shows full-size Accept/Decline buttons with the email truncating first, confirmed the "+ Add another friend" line renders, confirmed inputs no longer stretch edge-to-edge inside the wide center column, confirmed 375px mobile still stacks cleanly with rail min-height correctly dropping to 0.

### Part B, round 4 — the real fix: stop fighting the content, merge to one sidebar

Even with the 420px input cap, the *section boxes themselves* (Send Friend Requests, Availability) still stretched to fill the wide center track, leaving big blank interior space to the right of the actual input — same underlying problem as before, just moved location again. Recognized this as a structural mismatch, not a tuning problem: three fixed-width columns (two rails + a stretchy center) fundamentally fights content this sparse (a short list, one-line forms), no matter how many individual elements get capped.

Rebuilt around a different, equally common pattern the user hadn't heard of by name but asked about: one combined sidebar (Friends and Friend Requests merged into a single card, divided by a plain border) next to one main column, mirroring how Gmail/Slack/Notion structure a sidebar + content pane — explained the tradeoffs of a few well-known patterns (fixed-width centered content, sidebar+main, full-bleed dashboards, tabs) before building, since the user asked what's popular and isn't a web developer.

The actual root-cause fix: stopped forcing `.dashboard-layout` to stretch to fill `.page-container`'s width. `width: fit-content` + `margin: 0 auto` on the grid means it's now sized to exactly what its tracks need (sidebar + gap + center) and centered — any leftover screen width becomes ordinary page margin *outside* the content, the same way most content-focused websites work, instead of forced dead space *inside* a box. Dropped the per-rail `min-height`/stretch hacks entirely — no longer needed once the box isn't being stretched into space it doesn't need.

**Verified for real:** measured the actual rendered grid — 916px total (260px sidebar + 16px gap + 640px center), centered with ~175–190px roughly-equal margin on both sides at a 1280px viewport; confirmed the merged sidebar shows Friends then a divider then Friend Requests with no forced empty gap; reconfirmed mobile still stacks correctly.

### Part B, round 5 — widen it a bit more, and match the nav to it

User liked the sidebar+main structure but wanted the whole thing (and the nav bar, which had its own separate `max-width: 1100px` that didn't match the dashboard content's 916px) a bit wider, eating into some of that new margin rather than leaving it all as blank space. Bumped `nav`'s `max-width` 1100px→1120px and grew the dashboard grid's center track 640px→844px (sidebar stays 260px) so the whole content block is exactly 1120px too — nav and dashboard content now share the same width and left edge instead of being two different, mismatched widths.

**Verified for real:** measured both `nav` and `.dashboard-layout` at exactly 1120px wide with matching left offsets at a 1280px viewport (margin dropped from ~180px to ~72px per side) — confirmed by the user as the version to keep.

---

## 2026-09-24 — Phase C, all five real bug fixes

1. **Refetch Friends after accept** — `displayFriends` was defined *inside* its own `useEffect`, so nothing outside that effect (like `handleAccept`) could call it; `handleAccept` only ever refetched the pending-requests list. Pulled it out to a named function (same pattern `displayFriendsList` already used) and called it from `handleAccept`. `handleDecline` doesn't need it — declining never changes the Friends list.
2. **Refetch Matches after posting availability** — same shape of bug: `displayMatched` lived inside its own `useEffect`. Pulled it out and called it from `handlePostAvailabilty` on a successful post. The existing "seen match" `useRef` snapshot logic didn't need any change — calling `displayMatched()` again correctly treats a genuinely new match as new without re-reading `localStorage`.
3. **Block duplicate friend requests** — `send_friend_request` had zero check for an existing request before inserting one. Added a query for any existing `pending` or `accepted` `FriendRequest` between the two users *in either direction* (`or_`/`and_` on requester/recipient both ways), returning "you are already friends" or "friend request already pending" instead of silently creating a duplicate row.
4. **Stop expired availability from matching** — `get_availability_matches` had no time filtering at all; a window from last year would happily "match" forever. Added `Availability.end_time > now` to both the current user's and friends' window queries.
5. **Timezone handling** — the real fix, touching both sides. `datetime-local` inputs were sent to the backend as bare local-time strings with zero timezone info, and the `Availability.start_time`/`end_time` columns were plain naive `TIMESTAMP` (no timezone stored at all) — meaning two friends in different timezones posting "7pm" would incorrectly "overlap" even if actually hours apart in real time. Fixed properly: frontend now does `new Date(value).toISOString()` before `POST`ing (browser correctly treats a bare `datetime-local` string as local time, per spec, and converts to true UTC); backend model columns changed to `DateTime(timezone=True)` via a real Alembic migration (`alembic revision --autogenerate`, checked the generated `alter_column` before applying); the new expiry check's `now` changed from naive `datetime.utcnow()` to timezone-aware `datetime.now(timezone.utc)` to stay consistent with the now-aware column.

**Verified for real, not just assumed:** accepted a real pending request in the browser and watched it move into Friends with zero reload; sent a request to an existing friend (blocked as "you are already friends") and to someone with a request already pending in the other direction (blocked as "friend request already pending"); posted a `20:00–22:00` local availability window through the real form and confirmed via the network response it was stored as `19:00:00Z–21:00:00Z` (this environment's browser is UTC+1) — proving the conversion is real, not assumed; created a genuinely overlapping availability pair between two *already-expired* (year-2020) windows via the API directly and confirmed the match list correctly excluded it, while a real current overlap (with Emma) still correctly appeared.

### Two small nav bugs the user found by just clicking around

1. **Logged-out visit to `/dashboard` landed on the landing page, not the dashboard, after logging in.** `DashboardPage`'s own login check redirected to `/login` with no memory of where the user actually wanted to go, and `LoginPage` always navigated to `/` on success regardless — a real gap in Phase A's "login goes to `/`" change, which was only ever thought through for the landing page's *own* login link, not someone trying to reach `/dashboard` directly (bookmark, typed URL, old link). Fixed with the standard "remember where you were going" pattern: `DashboardPage` now redirects with `navigate("/login", { state: { from: "/dashboard" } })`, and `LoginPage` reads `useLocation().state?.from` and goes there on success, falling back to `/` exactly like before when there's no `from` (i.e. the normal landing-page login flow is untouched).
2. **Clicking "Sign out" on the landing page bounced you to `/login` instead of just staying on the landing page.** `handleSignOut` already correctly did `setIsLoggedIn(false)` — enough on its own to flip the nav/hero back to Login/Sign up — but then called `navigate("/login")` right after anyway, yanking the user off the page that was already showing the right thing. Removed that line (and the now-unused `useNavigate` import).

**Verified for real:** logged out, hit `/dashboard` directly, got bounced to `/login`, logged in, landed on `/dashboard` (not `/`); separately, on the landing page while logged in, clicked "Sign out" and confirmed it stayed on `/` with the nav/hero switching to Login/Sign up immediately, no navigation at all.

### Phase D, part 1 — a real "Current Outings" section

User raised three related visibility gaps at once, agreed to take one at a time: (1) neither party could see a confirmed outing anywhere — it just silently updated in the background; (2) no reminder of availability you'd already posted; (3) a match doesn't show *which* specific time window overlapped. Starting with (1), the biggest piece.

New backend endpoint, `GET /outings/current`: returns every outing where the current user is either the *creator* (regardless of whether anyone's responded yet) or an invitee who *accepted* — explicitly excluding outings where the user only has a pending or declined invite, since those already have their own place (Outing Invites) or the user opted out. Each result includes `creator_email` and `accepted_invitee_emails` (built manually per outing, same manual-construction style already used for `OutingInviteOut`), so both sides see who's actually confirmed, not just who was invited.

"Removed automatically when its time passes" needed one extra thing first: `Outing.proposed_time` had the *exact same* untreated timezone gap `Availability.start_time`/`end_time` had before today's Phase C fix — a plain naive `TIMESTAMP` column fed by an unconverted `datetime-local` string. Since the whole point of this feature is comparing proposed_time against "now" correctly, shipping it on top of a known-broken time comparison would just bake the same bug into a new feature. Applied the identical fix: model column → `DateTime(timezone=True)`, a real migration (`alembic revision --autogenerate`, reviewed before applying), and `handleCreateOuting` now does `new Date(proposedTime).toISOString()` before sending, exactly like the availability fix.

Frontend: `displayCurrentOutings` (same fetch-and-set pattern as everything else), called on mount and refetched after both creating an outing and accepting an invite — so it appears instantly on the creator's side at creation and on the invitee's side the moment they accept, no reload needed either way. New `Current Outings` section sits between Outing Invites (needs action) and Create Outing (the form) in the center column, each row showing the title, location, a human-readable date/time (`toLocaleString()`, not a raw ISO string), and who's actually confirmed going.

**Verified for real, both directions:** created a real outing from `phaseb_tester` inviting `phaseb_friend` — confirmed it appeared immediately on the creator's side showing "with just you so far" (nobody had accepted yet); accepted it as `phaseb_friend` and confirmed *both* accounts now show it with `phaseb_friend@example.com` listed as confirmed; separately created a deliberately backdated (year-2020) outing and confirmed it correctly never appears in Current Outings at all.

### Phase D, part 2 — a reminder of your own posted availability

There was no way to see what you'd already told the app — post "free 6-8pm" and it just vanished into the backend with no confirmation anywhere. Per the user's own framing, this didn't need a whole new section, just a small reminder tucked into the existing Availability card.

New backend endpoint, `GET /availability/mine` — the current user's own upcoming availability windows (same `end_time > now` expiry filter as everywhere else that deals with time, ordered soonest-first). No new schema needed, since `AvailabilityOut` already covers exactly this shape.

Frontend: a small `You're currently marked as free:` block appears right above the Availability form, listing every window with a human-readable date range (`toLocaleString()`, not raw ISO text), only when at least one exists. Refetches on mount and immediately after a successful post, same pattern as everything else today.

**Verified for real:** two pre-existing test windows showed up correctly on load; posted a brand-new window through the actual form and watched it appear in the reminder list instantly, no reload, alongside the two that were already there.

### Phase D, part 3 — show the actual overlapping time on the match card

Last of the three-part request: a match card just said "You and X are free" with no indication of *when* — the whole point of the feature is a specific overlapping window, and it was the one piece of information missing from its own result.

`overlaps(start_a, start_b, end_a, end_b)` in `utils.py` already computes `max(start_a, start_b)`/`min(end_a, end_b)` internally to decide *whether* an overlap exists, but only ever returned a boolean — it throws away the exact window it just calculated. Rather than change that function's return shape (it's a small, already-tested pure function, used in exactly one place, so widening its contract felt like the wrong kind of change for what's needed here), `get_availability_matches` now redoes that same `max`/`min` once more, only for windows `overlaps()` already confirmed cross — same formula, kept in the one place that actually needs the values.

New response shape: added `MatchOut` (id, email, created_at, plus `overlap_start`/`overlap_end`) replacing the old plain `UserOut` response for this one endpoint — `matched_overlaps` is now a dict keyed by friend id holding the overlap window, built alongside the existing matching loop instead of a bare id list. Frontend: one new line on the match card, reusing the `.match-card-time` CSS class that already existed (originally written for the landing page's static mock card) — `{new Date(overlap_start).toLocaleString()} – {new Date(overlap_end).toLocaleString()}`.

**Verified for real, math checked by hand:** tester's window (19:00–21:00 UTC) against Emma's (20:00–22:00 UTC) should overlap exactly 20:00–21:00 UTC — the match card displayed "9:00 PM – 10:00 PM", which is exactly that window in this environment's local UTC+1, confirming the computed overlap and its timezone conversion are both correct, not just present.

---

## RESUME HERE — All three parts of the user's outings/availability/match visibility request are done. Next: tests/CI (item 7), then the README deferred-items note (item 8), then Day 2 is complete.

### Outing leave vs. delete — a fourth round of user-found gaps

User surfaced four more real gaps at once: no way to back out of or remove an outing; ugly raw dates in Availability/Matches/Outings; whether an expired match auto-disappears (asked for opinions on all four before building any of them, same "one at a time, check, commit" rhythm). Gave honest pushback before starting: recommended against giving the *creator* a separate "remove myself" action distinct from delete (an outing with no creator actively tracking it but still "confirmed" for others is a confusing half-state — creator should just get delete), and recommended against a hover-only reveal for the friend-remove button (this app gets checked at mobile widths, and hover doesn't exist on a touchscreen). Also pointed out the "auto-delete matches once expired" ask was already fully solved by yesterday's Phase C fix (`end_time > now` on both windows already guarantees a match can never outlive either person's window). User agreed to the adjusted plan.

Built first: **accepted invitees get "Leave," the creator gets "Delete."** New endpoints: `POST /outings/{outing_id}/leave` (invitee's own `OutingInvite` flips from `accepted` to a new status, `left` — a plain string field, no schema change needed, same pattern `accepted`/`declined` already use) and `POST /outings/{outing_id}/delete` (creator-only, sets `Outing.status = "cancelled"` — this is a *soft* delete, not a real row delete, matching what the `Outing` model's existing `status`/`cancellation_message` columns were clearly already designed for, just never wired up to anything yet). `/outings/current` now also filters out `status == "cancelled"` for both the creator's and invitees' queries, so a deleted outing disappears for literally everyone at once. Frontend shows the right button per row by comparing `outing.creator_email` to the logged-in user's own email — no new field needed for that.

**Verified for real, both directions plus the security check:** had `phaseb_friend` leave a real outing — confirmed it vanished from *their* Current Outings only, while it stayed fully visible for the creator (`phaseb_tester`), now correctly showing nobody else as confirmed. Separately, had `phaseb_tester` (the real creator) delete a different outing — confirmed it disappeared entirely. Also tried to delete someone else's outing as a non-creator directly against the API — correctly rejected with "only the creator can delete this outing," proving the permission check isn't just cosmetic (a hidden button) but actually enforced server-side.

---

## RESUME HERE — Outing leave/delete is done and committed. Next: relative date formatting (Monday/Tuesday for anything within a week), then the always-visible friend-remove button — same one-at-a-time rhythm.

**Status**: Phase C and Phase D (all 3 original parts) are fully done and committed. Day 2's original items 7–8 (tests/CI, README deferred-items note) are still outstanding, now queued behind this new round of fixes the user found by using the app. Nothing half-finished.

### Relative date formatting — weekday names within a week, real dates beyond it

Every date/time shown anywhere (Availability reminder, Match overlap, Current Outings) was a raw `toLocaleString()` dump — technically correct, not pleasant to read. Added two small helpers at module scope in `DashboardPage.jsx` (not inside the component — they don't touch state/props, so no reason to recreate them every render): `formatDateTime(date)` shows a weekday name (`"Thursday, 8:00 PM"`) when the date is 0–6 days out, otherwise falls back to a real localized date; `formatRange(start, end)` builds on it and additionally collapses the common case where both ends fall on the same calendar day into one weekday plus a compact time range (`"Thursday, 8:00 PM – 10:00 PM"`) instead of repeating the weekday twice — matching the exact "Saturday, 6-8pm" convention the very first landing-page match-card mockup already used, just never carried through to the real dashboard until now. All three raw-date call sites swapped over; nothing else about those sections changed.

**Verified for real:** near dates (today through 6 days out) correctly show as a weekday name across Availability, Matches, and Current Outings; a deliberately far outing (~6 months out) correctly fell back to a real calendar date (`"3/15/2027, 3:00 PM"`) instead of a weekday, proving the 7-day cutoff actually works, not just the near case; checked at 375px mobile width too, no layout regression.

---

### Remove-friend capability — an always-visible button, not hover-reveal

Last item of this round. Recommended against the user's original hover-to-reveal idea before building it: this app gets checked at mobile widths throughout the project, and hover doesn't exist on a touchscreen — a hover-only button would be genuinely unreachable on a phone. Built as a small, always-visible "Remove" button next to each friend instead, matching the same visible-button pattern Friend Requests and Outing Invites already use.

New endpoint, `POST /friends/{friend_id}/remove`: finds the `accepted` `FriendRequest` row between the two users (checking both directions, same `or_`/`and_` pattern the duplicate-request check already uses) and flips it to a new status, `removed` — a plain string value, no schema change, same "never delete the row, just change its status" pattern every other friend/outing action already follows. Because `removed` isn't `pending` or `accepted`, the existing duplicate-request guard doesn't block a future re-request between the same two people — removing someone and later re-adding them just works.

Real CSS bug hit while wiring the button in: the base `.list-row` class sets `flex-wrap: wrap`, which the Friends row (now with two children — email and the new button) inherited, pushing the button onto its own line below the email instead of staying beside it. Fixed with an explicit `flex-wrap: nowrap` on the sidebar's row rule, letting the email's existing `min-width: 0` + ellipsis truncation do its job instead of the row wrapping.

**Verified for real, both sides plus the "can I still make friends again" check:** removed a friend from `phaseb_tester`'s side and confirmed it disappeared from *both* accounts' friend lists (and from the Create Outing invite checklist, which shares the same `friends` data — no extra work needed there); confirmed sending a fresh friend request to that same removed person afterward succeeded normally instead of being incorrectly blocked as a duplicate.

---

### Two small polish fixes found by real clicking-around

1. **Logout/Remove/Decline/Leave buttons' hover barely looked like anything.** They all use `.btn-secondary`, whose hover only shifted background from transparent to `--cream-deep` (`#fff6ed`) — a near-invisible change against the page's own cream background, unlike the landing page's "Sign out" button which visibly darkens from `--coral` to `--coral-hover`. Changed `.btn-secondary:hover` to use `--border` (`#f0dcc0`, a properly warm tan) for the background plus `--text` for the text color — confirmed via `getComputedStyle` before and after, not just eyeballed, that this is now a real, clearly perceptible change everywhere that class is used.
2. **Hovering a truncated friend/request email showed nothing.** The sidebar intentionally truncates long emails with an ellipsis (from yesterday's overflow fix), but there was no way to see the full value without guessing. Added a native `title` attribute to both truncated spans (Friends and Friend Requests) — the browser's own built-in tooltip now shows the full email on hover, no custom tooltip component needed.

---

### Phase G — "How it works," now mine to build

Given the time left, the user handed over what was originally their own task (writing the landing page's "how it works" section) instead of doing it themselves. Built a 4-step section right below the hero: Add your friends → Share when you're free → Get matched automatically → Plan the outing — each with a numbered circle badge (alternating `--coral`/`--plum`, matching the match-card avatar colors already used elsewhere) and a short two-line description, matching the site's existing Poppins/Inter + cream/coral/plum system rather than introducing anything new. Grid of 4 across on desktop, stacks to one column under 800px.

**Verified for real:** confirmed all four steps render with correct content and alternating badge colors on desktop; confirmed a clean single-column stack at 375px mobile width with no overflow.

---

### Phase F — the username field, now in scope after all

Explicitly deferred in yesterday's honest re-cut of the plan (biggest/most invasive remaining piece, low payoff for a demo, and rushed migrations under time pressure are exactly where real bugs happen) — but the user asked for it directly now, aware of the tradeoff, so it goes in properly rather than rushed.

**Scope decision made up front:** username is a *display* property only. Login/signup still authenticate by email — no reason to touch JWTs or the auth flow to add a second identifier. Everywhere the app shows someone's email as their identity (Friends, Friend Requests, Matches — card text and avatar initials, Current Outings — creator and confirmed attendees, "Logged in as," Create Outing checkboxes), it now shows their username instead, once they have one.

**The real problem, solved up front:** every existing account (all of today's and yesterday's test users) has no username — they were created before the field existed. Made the column nullable rather than required, so nothing breaks retroactively; new signups get a required, uniqueness-checked username (same "already taken" pattern the email check already used). A `display_name` property on the `User` model (`username or email`) resolves the fallback in exactly one place — and because Pydantic's `from_attributes` can read a plain Python `@property` just like a real column, endpoints that already returned raw `User` rows (like `/friends`) picked this up with zero extra code, no manual construction needed. Endpoints that build their response by hand (friend requests, matches, current outings) got the same `x.username or x.email` logic added explicitly, via new `*_display_name` fields added alongside the existing `*_email` ones — the raw email fields were kept, not replaced, so nothing else relying on them broke.

One deliberate exception, called out so it isn't mistaken for an oversight: the "am I the creator of this outing" check (which decides whether a Current Outings row shows Delete or Leave) still compares by **email**, not display name — display names aren't guaranteed unique the way emails are, so a comparison that decides UI behavior shouldn't key off them, even though the actual permission is enforced server-side regardless. Same reasoning applied to the "who else is confirmed" list: dedup and self-exclusion happen by email internally, and only the final rendered text uses the display name.

**Verified for real, systematically, both directions of the relationship — not spot-checked:** created a real second account with an actual username (`CoolUsername42`) and befriended, matched, and shared an outing with an existing no-username account (`phaseb_tester`). Checked all six display sites from *both* sides: from `CoolUsername42`'s dashboard, `phaseb_tester` correctly still shows as their email everywhere (Friends, Matches, Current Outings, Create Outing checklist) while `CoolUsername42` sees their own username at the top; from `phaseb_tester`'s dashboard, `CoolUsername42` correctly shows as their username in the exact same six spots, mixed in a list alongside other friends still showing email. Also tested signup's new duplicate-username rejection directly against the API, and ran a real signup through the actual browser form (not curl) to confirm the new Username field works end-to-end, including at 375px mobile width.

---

## RESUME HERE — Username field is fully implemented and verified, not yet committed (user is away from their laptop and asked me to wait for them before committing). Next, once committed: back to Day 2's original remaining items — tests/CI, then the README deferred-items note.

### Post-launch: demo data cleanup + a real truncation bug the new usernames exposed

Username field committed (`4fcde0d`). Immediately after, asked to clean up the dev database: 31 old test/throwaway accounts deleted (with their dependent `FriendRequest`/`Availability`/`Outing`/`OutingInvite` rows cleaned up first, in dependency order, to avoid a foreign-key violation), down to 4 kept accounts renamed to clean demo identities (`alex`, `jordan`, `sam`, `taylor`) plus one new account (`priya`) added specifically to demonstrate the pending-Friend-Request state, since none of the 4 originally kept had one left. Also renamed the one surviving real outing from "Username Test Outing" to "Coffee with Taylor" and deleted two empty test-only outings — same reasoning: leftover test-y titles would have undercut the point of cleaning up "for demonstration." This was pure database data, not code — nothing to commit for it, it's just live in the dev Postgres now.

That cleanup immediately surfaced a real bug: a short username like `priya` in the Friend Requests row was rendering as `p...` — almost completely truncated, unlike a long email which at least showed several real characters before its ellipsis kicked in. Root cause: the Accept/Decline buttons at their normal size (`8px 16px` padding, 14px font) ate most of the 260px sidebar's width, leaving the name almost nothing to truncate *from*. Fixed on both sides at once, per the user's explicit ask to make it "universal, not just one spot": added `.dashboard-sidebar button { padding: 5px 10px; font-size: 13px; }`, shrinking Remove/Accept/Decline consistently everywhere in the sidebar (not just Friend Requests), and widened the sidebar itself 260px→300px. Grew the *whole* layout (nav to 1160px, dashboard content to match) rather than stealing the extra 40px from the center column, so the wider sidebar doesn't protrude past the nav or throw off the width the two already shared — confirmed via `getBoundingClientRect()` that nav and the dashboard content are still exactly the same width and left-aligned after the change.

**Verified for real:** `priya`'s row now shows the full name comfortably next to full-size-looking-but-actually-smaller Accept/Decline buttons; measured nav and dashboard content both at exactly 1160px wide with matching left offsets at 1300px viewport; checked 375px mobile — still stacks cleanly with plenty of room.

### Create Outing's invite list — a scalability problem the demo data was too small to show

User spotted this from a screenshot with only 3 friends, but correctly reasoned ahead to the real problem: the invite checklist was a single vertical column, which would get awkwardly tall with a real friend list while all the width next to it went unused.

Wrapped the checkboxes in `.invite-friends-grid`: `display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));`. Deliberately chose `auto-fill`/`minmax` over a hardcoded fixed column count (the user's own suggestion, "3 for example") — auto-fill asks "how many 160px-or-wider columns actually fit this box," so it naturally shows ~3-4 columns at this layout's width, collapses to a single column on mobile with no separate breakpoint needed, and won't need revisiting if the box's width changes later for some other reason. One CSS gotcha: the form is a flex column with `align-items: flex-start`, which shrink-wraps children to their content size rather than stretching them — the grid needed an explicit `width: 100%` or auto-fill would've had no real width to divide into columns and just collapsed to its minimum.

**Verified for real, not just at the 3-friend scale where the bug wouldn't show:** temporarily created 7 additional friend accounts (11 total) and measured the actual rendered grid via `getBoundingClientRect()` — confirmed 3 columns × 4 rows, not one 11-item column. Cleaned the temporary accounts back out afterward to keep the demo data tidy; in the process of batch-accepting their requests, `priya`'s request to `alex` got accidentally swept up and accepted along with them — caught this and reverted her `FriendRequest` row back to `pending`, since demonstrating that UI state was the entire reason she was added in the first place.

---

**Deadline update**: user wants to be done *before traveling* (2 days left, ~3hrs/day, soft deadline — not hard, but real) so they have time to focus on job applications afterward. That is not enough time for the full original backlog below, so the plan was honestly re-cut rather than carried forward as-is:

**Keep — concrete day-by-day plan (2 days, ~3hrs/day, ~6hrs total):**

**Day 1 — Phase C, real bug fixes — ✅ done, see the 2026-09-24 section above for what actually shipped.**

**Day 2 — Phase D + tests/CI (~2–2.5 hrs total), then stop and call it CV-ready:**
6. **Phase D** — add an actual "your outings" section: check what the backend already exposes for accepted outings (may need a small new endpoint), then a frontend section listing them — accepted outings currently vanish with nowhere to see them again. (~60–90 min)
7. **Tests/CI** — a handful of real pytest tests on core logic (`overlaps()`, maybe the new duplicate-friend-request check), plus a GitHub Actions workflow file to run them on push. Cheap relative to payoff, reads well on a CV even if small. (~45–60 min)
8. Update the README: note F/E/dark-mode/deployment as explicit "known next steps," not silently missing.

If Day 1 runs long (likely, given item 5), let item 6 slide rather than rushing timezone handling — a correct, well-tested Phase C matters more for a demo than a finished Phase D.

**Originally recommended to defer — status update, most of this list turned out to get done anyway:**
- ~~**F** — Username field.~~ Done (see above) — user asked for it directly, aware of the tradeoff.
- ~~**E** — Richer match-card details.~~ Done — the overlap-time feature (Phase D part 3) covers this.
- ~~**G** — "How it works" section.~~ Done — handed to me given the time crunch, built and committed.
- **Still genuinely deferred:** dark mode (cosmetic, skip) and actual deployment (flagged as the highest-variance item since day one — if time runs out, cut this first, keep a polished local demo + README + screenshots). Deployment-safety prep (env-configurable API URL, hiding the DB port, a real JWT secret) only matters once deployment is actually happening, so it waits alongside it.

**Workflow reminder**: one piece at a time, explain what changed in plain language after each, commit, then move to the next — user confirms before continuing.

## Tests + CI

Re-explained `assert` and what "CI" actually means (Continuous Integration: every push automatically gets a fresh machine that installs everything from scratch and runs the test suite, catching a break the moment it happens instead of whenever someone next runs tests by hand) before writing either.

**Tests** (`backend/tests/`), scoped to logic that's genuinely worth testing rather than padding: `overlaps()` (a real overlap, one under the 30-minute minimum, and no overlap at all — the three cases that actually matter for that function), `get_friend_ids()` (finds an accepted friend from either side of the relationship, correctly ignores a still-pending one), and `User.display_name` (the username-or-email fallback from yesterday). `get_friend_ids` needs a real database to query against, so added a `conftest.py` fixture using an in-memory SQLite database, created fresh per test — genuinely exercises the SQLAlchemy query, not mocked, but doesn't need the real Postgres container running. Added `pytest` via a separate `requirements-dev.txt` (`-r requirements.txt` plus `pytest`) rather than the main `requirements.txt`, so test tooling doesn't ship with the actual app.

**Verified for real, not just assumed:** ran the full suite inside the actual backend container (`docker compose exec backend python -m pytest tests/ -v`) — all 7 tests pass.

**CI** (`.github/workflows/ci.yml`): two jobs. `backend-tests` installs from `requirements-dev.txt` and runs `pytest` — no Postgres service needed in the workflow at all, since the tests use SQLite in-memory. `frontend-build` runs the existing `oxlint` script plus `vite build`, catching a syntax error or broken build before it'd ever reach a demo. Checked both frontend steps actually pass locally before trusting the workflow file: lint exits 0 (it has pre-existing warnings — unused `response` variables, a few missing `useEffect` dependencies — but warnings don't fail the command, and fixing them wasn't part of what was asked here), and `vite build` completes cleanly.

Not yet committed — ready for review.

## Independent audit — fixing the confirmed bugs, one at a time

User had an independent source review the whole project and returned 22 findings. Verified the biggest claims directly before trusting any of them — reproduced #1 (CI actually broken), #2 (cancelled outings stay acceptable), #6 (empty signup succeeds), confirmed #3 (hardcoded JWT default) and #4 (match overlap can show almost no real time left) by reading the code, and specifically tried to reproduce #18's "malformed token returns 500" claim with four different malformed-token shapes — none reproduced a 500, all correctly returned 401/403, so that specific line isn't being acted on. Agreed order: fix the 5 confirmed real bugs first, one at a time, before deployment prep.

### Audit fix #1 — CI was actually broken

Reproduced it properly before touching anything: ran the test suite inside the container with `DATABASE_URL` unset, simulating exactly what a fresh GitHub Actions runner looks like (no `.env` file ever exists there). It crashed before a single test collected — `app/config.py`'s `Settings.database_url` has no default, and `settings = Settings()` runs at import time, so just importing the app (which `conftest.py` does to reach `Base`) blew up with a Pydantic validation error.

Fix: added a `DATABASE_URL` env var directly in the `backend-tests` job in `ci.yml`. The tests never actually connect through it — they use the separate in-memory SQLite engine in `conftest.py` — but `create_engine()` isn't as lazy as it looks: it imports the DB driver module matching the URL's scheme immediately, even without opening a connection. First attempt used a plain `postgresql://` dummy URL and hit a *second*, more subtle failure — that scheme defaults to the legacy `psycopg2` driver, which isn't installed (this project uses `psycopg` v3, referenced explicitly as `postgresql+psycopg://` in the real `.env`). Checked the real `.env` to get the exact scheme right, fixed the dummy URL to `postgresql+psycopg://unused:unused@localhost/unused`, and re-ran the same fresh-environment simulation again — all 7 tests now genuinely pass with no real database anywhere in reach, proving the fix rather than assuming it.

### Audit fix #2 — cancelled outings stayed acceptable

Root cause: `accept_outing_invite`/`decline_outing_invite` only ever checked the *invite's own* status (`pending`/`accepted`/`declined`) — never the parent `Outing`'s status, so a cancelled outing's still-`pending` invite was completely unaffected by the cancellation. Separately, `my_outing_invites` (the pending-invites list an invitee actually sees) had the same gap, so the dead invite didn't just remain acceptable, it stayed visibly sitting in their UI as if nothing happened.

Fixed both halves: `accept`/`decline` now look up the outing and reject with a clear `400 "this outing was cancelled"` if its status is `cancelled`, before touching the invite at all; `my_outing_invites` now excludes any invite whose `outing_id` belongs to a cancelled outing, via a `NOT IN` filter against the current set of cancelled outing ids.

**Verified for real, reproducing the exact original repro:** created a fresh outing inviting `jordan`, cancelled it, confirmed it no longer appears in `jordan`'s pending list at all, then — going further than the original repro — tried to `accept` *and* `decline` that same invite directly by id anyway (bypassing the UI entirely, as a determined user could), and both correctly returned 400 instead of silently succeeding. Re-ran the full test suite afterward, still 7/7 passing.

### Audit fix #3 — the JWT secret had a working, public fallback

User asked what a JWT secret actually is first, since the guess ("password for the database") was a real, common mix-up worth untangling: it's unrelated to database credentials (that's `DATABASE_URL`'s job entirely). A JWT secret is what the server uses to *sign* a login token — like a wax seal only the server can produce — so it can later verify a token wasn't forged just by recomputing the seal, with no database lookup needed. `config.py` had `jwt_secret: str = "dev-secret-change-me"` — a real, working fallback sitting in the public repo. Anyone who read that file could compute a valid seal for any user id they wanted; that's exactly what let the audit forge a token for someone else's account with no password and no database access at all.

Fix: removed the default entirely (`jwt_secret: str`, matching `database_url`'s existing no-default pattern) and added a validator that also rejects the specific placeholder string and anything under 32 characters — "require a *strong* secret," not merely a present one. Checked the actual `.env` first rather than assuming: it already had `JWT_SECRET` set, but to the literal placeholder text `change_me_to_a_random_string`, never actually changed. Generated a real one (`secrets.token_urlsafe(48)`) and updated the local `.env` (gitignored, never touches git) — restarting the backend recreated the container (`docker compose` treats a changed `.env` as relevant to both services sharing it, even though only `backend` uses `JWT_SECRET`), which is harmless since Postgres data lives in a named volume independent of the container. Added a matching dummy value to `ci.yml` (same reasoning as `DATABASE_URL` — CI needs *some* valid-shaped secret to import the app, never a real one), and a comment in the committed `.env.example` explaining the requirement and how to generate a real value.

**Verified for real, both directions:** confirmed the app starts and a real login/token round-trip still works with the new secret (`alex` logged in successfully post-restart); separately, fed the exact old placeholder value back in and confirmed the app now correctly *refuses to start*, `ValidationError` and all — proving the guard rejects the known-bad case, not just accepts the good one. Re-ran the full simulated-CI environment (both dummy `DATABASE_URL` and `JWT_SECRET` together, no real `.env` in reach) — still 7/7 passing.

### Audit fix #4 — matches counted total overlap length, not remaining usable time

Root cause, traced by hand before touching code: the 30-minute gate in `overlaps()` checked the *entire* overlap window's length (`min(end_a,end_b) - max(start_a,start_b)`), with no idea what time it currently is. A window that started hours ago and a friend's much wider window could produce a technically-huge total overlap while almost all of it was already in the past — exactly the "9 minutes left" case the audit described.

Fix: gave `overlaps()` an optional `now=` parameter (default `None`, so the 3 existing tests calling it without `now` are completely unaffected) that clips the overlap's start forward to `now` when provided, before measuring its length. `get_availability_matches` now passes `now=now` into the gate check, and — this part matters as much as the gate itself — also clips the *stored* `overlap_start` it returns to `now`, so a match never displays a window that appears to start in the past. Considered extending `overlaps()`'s own signature-free internals instead of adding a parameter, but that would've broken its existing tests and its single responsibility (comparing two ranges) for something that's really this *caller's* concern (what "now" means) — the optional parameter keeps the utility generic while giving this one caller what it needs.

Added two new tests reproducing the audit's own scenario almost exactly: a ~3-hour total overlap with only 15 real minutes left from `now` (rejected) and the same shape with enough real time left (accepted) — 9/9 tests passing.

**Verified for real against the live API, not just the unit tests, isolating out a confound along the way:** first attempt used `alex`/`jordan`'s real accounts and got a misleading result — `jordan` still showed as a match, but investigating showed it was through a *different*, genuinely valid, fully-future overlap `alex` already had, not the near-elapsed one just posted; the fix wasn't wrong, the test wasn't isolated. Re-ran with two fresh throwaway accounts and only the one window pair in play: a ~4h48m total overlap ending 5 real minutes from now correctly produced **no match at all**; the same accounts with a window ending 45 real minutes out correctly **did** match, with the returned `overlap_start` showing the actual current moment rather than the stale historical start. Cleaned up both the throwaway accounts and the two leftover test windows on `alex`/`jordan` afterward.

### Audit fix #6 (last of the five) — empty signups succeeded, and empty datetime fields could crash the frontend

Backend half, reproduced first: `{"email":"","username":"","password":""}` created a real, broken account (`display_name` came back as `""`, an empty string). `UserCreate`'s fields were plain `str` with no constraints — Pydantic only checked they were strings, not that they were non-empty or shaped like anything real. Fixed with `email: EmailStr` (added the `email-validator` package specifically for this — Pydantic's own real email-format validator rather than a hand-rolled regex) and `Field(min_length=1)` on `username`/`password`, plus `max_length=50` on `username` matching the DB column. Hit a real deployment snag applying this: installed the new package into the running container, but the already-running server process didn't pick it up — a full `docker compose restart backend` was needed for a clean process start.

That fix immediately exposed a second, real bug on the frontend it would have caused: `SignupPage` did `setMessage(data.detail)` assuming errors are always a plain string — true for the old hand-written `HTTPException`s ("email already registered"), false for Pydantic's own validation errors, which come back as a list of `{msg, loc, ...}` objects. Left as-is, a validation failure would've rendered React trying to display an array of objects instead of readable text. Added a small `formatErrorDetail()` helper that joins array-shaped details into one readable message, string details through unchanged.

Frontend half of the original finding — empty datetime fields can throw a `RangeError` before a request is even sent, since `new Date("").toISOString()` throws on an Invalid Date: added `required` to all three `datetime-local` inputs (Availability's start/end, Create Outing's "When") as the first line of defense — native browser validation blocks the empty submit entirely, no request, no crash — plus an explicit non-empty check at the top of both `handlePostAvailabilty` and `handleCreateOuting` as a second layer, in case `required` is ever bypassed.

**Verified for real, every layer:** confirmed empty signup now returns 422 with three separate field errors; confirmed a malformed email (`"not-an-email"`) is rejected the same way; confirmed a normal valid signup still succeeds unchanged. Confirmed in the actual browser that submitting the signup form fully empty is blocked natively with no network request at all; separately, deliberately fed a 63-character username (passes native checks, fails server-side) through the real form and confirmed the error rendered as clean readable text ("String should have at most 50 characters"), proving the array-formatting fix works, not just that it doesn't crash. Confirmed the Availability form's empty submit is also natively blocked. Re-ran the full test suite one final time — 9/9 passing.

---

All five audit-confirmed bugs were fixed, verified, and committed (last commit before this section: `51ef333`). Deployment prep + deployment are saved for the final day, then the README last. In the meantime, user asked to work through three more deferred audit items today, in this exact order: **#5 (integration tests) → #7 (race conditions/atomicity) → #9 (Plan-something button)**, then come back once at the end to review and commit all three together — this is that check-in point. **None of what follows is committed yet.**

## Audit #5 — integration tests covering the real signup→outing journey

New file `backend/tests/test_integration.py`, using FastAPI's real `TestClient` against the actual `app` object (not a simulation) — a genuine HTTP-level test, going through real signup/login to get a real JWT, not bypassing auth. Needed a database that persists *within* one test (so a signup in request 1 is visible to a login in request 2) but resets *between* tests (so tests can't see each other's data) — solved with a single SQLite in-memory engine using `StaticPool` (keeps one connection alive for the whole test file) plus an `autouse` fixture that creates all tables before each test and drops them after.

Five tests: the full two-person journey end to end (signup ×2 → friend request → accept → overlapping availability → real match appears → outing created → invite accepted → shows in both people's Current Outings → one leaves → the other deletes it — matching literally every step the audit named), plus three permission/regression checks: a random third party can't accept someone else's friend request (403), only an outing's creator can delete it (403), and a cancelled outing's invite can't be accepted (400) — this last one directly re-verifies audit fix #2 as a permanent, automated test instead of relying on today's one-off manual curl checks forever.

**A real, honest discovery while writing these, not a bug in the app:** the full-journey test crashed on the "check for a match" step with `TypeError: can't compare offset-naive and offset-aware datetimes`. Root cause: SQLite has no real timezone-aware storage — a value written as UTC-aware comes back **naive** on read, while the matching endpoint's `now = datetime.now(timezone.utc)` is always aware. This is a genuine SQLite-for-testing limitation, not a flaw in the real app — today's audit fix #4 was already extensively verified against the *real* Postgres database, which correctly preserves timezone awareness (re-confirmed again just now: a live `/availability/matches` call against `alex` still returns correct aware timestamps). Fixed properly rather than working around it: added `UTCDateTime`, a small `TypeDecorator` in `models.py` wrapping `DateTime(timezone=True)` that re-attaches `tzinfo=UTC` on read *only if* the driver returned a naive value — a complete no-op for Postgres (which never returns naive values, so the condition never fires) and a real fix for SQLite. Confirmed via `alembic revision --autogenerate` that this produces **zero schema diff** ("No new upgrade operations detected") — proof it doesn't change the real database at all, purely a test-compatibility fix. Applied to `Availability.start_time`/`end_time` and `Outing.proposed_time`, the same three columns fixed for timezone-awareness back in Phase C/D.

Also needed `httpx` (FastAPI's `TestClient` requires it) — added to `requirements-dev.txt` alongside `pytest`, not the main `requirements.txt`.

**Verified for real:** all 5 new tests pass; re-ran the *entire* suite afterward (14/14 at that point) to confirm the `UTCDateTime` change didn't disturb the existing unit tests; separately confirmed against the live Postgres-backed app that a real match still returns correctly.

## Audit #7 — race conditions and non-atomic writes

Three separate fixes, each targeting a specific claim from the audit.

**"No duplicate active friendships," made real at the database level, not just app logic:** the existing app-level check (query-then-insert) is a classic TOCTOU race — two simultaneous requests between the same pair could both pass the check before either commits. Added `low_user_id`/`high_user_id` columns to `FriendRequest` (order-independent copy of the pair — `min`/`max` of the two real ids, so A→B and B→A collide on the same values) auto-populated by a SQLAlchemy `before_insert` event listener (not something every call site has to remember — even the existing unit tests' direct `FriendRequest(...)` construction gets it for free), plus a **partial unique index** on those two columns that only applies `WHERE status IN ('pending','accepted')` — deliberately scoped so a `declined` or `removed` row never permanently blocks a future request between the same two people, which would otherwise break an already-working, intentional flow. `send_friend_request`'s commit is now wrapped in `try/except IntegrityError`, converting a genuine race (the rare case that actually gets past the app-level check) into the same friendly "friend request already pending" message instead of a raw 500.

**"One invite per person per outing":** added a plain `UniqueConstraint("outing_id","invitee_id")` on `OutingInvite`, plus de-duplicating `invitee_ids` in `create_outings` before looping (`list(dict.fromkeys(...))`, preserves order) — covers both the realistic case (someone sends the same id twice in one request) and stands as a real backstop either way.

**"Create an outing and its invites in one transaction":** was two separate commits — `db.add(outing); db.commit()` (commit #1) *then* the invite loop *then* a second `db.commit()`. A crash in between left an orphaned outing with zero invites. Changed the first `db.commit()` to `db.flush()` (assigns the new id without ending the transaction), so the outing and every invite now succeed or fail together as one atomic unit.

Needed a real migration (new columns + two new constraints on tables that already have live rows) — generated, then hand-edited before applying, same discipline as every migration this project: add the two new `FriendRequest` columns as **nullable first**, backfill every existing row (`UPDATE ... SET low_user_id = LEAST(...), high_user_id = GREATEST(...)`), *then* tighten to `NOT NULL`, *then* create the partial index — the naive auto-generated version would have tried to add a `NOT NULL` column straight onto a table with existing rows and failed outright. Checked for any pre-existing data that would already violate either new constraint before applying (`GROUP BY ... HAVING COUNT(*) > 1` against both tables) — found none.

Three new tests in `test_models.py`, each bypassing the application's own check entirely (constructing the conflicting rows directly) to prove the *database* is what actually stops it, not just app code a fast-enough race could slip past: a reversed-direction duplicate friendship is rejected, a declined request does *not* block a fresh one (proving the partial-index scoping is correct, not just present), and a duplicate outing invite is rejected. (`make_user`, previously duplicated locally in `test_utils.py`, moved to `conftest.py` so both files share one definition.)

**Verified for real against the live Postgres database, not only SQLite:** `\d friend_requests` and `\d outing_invites` on the real database confirm both the partial unique index and the plain unique constraint genuinely exist; sent a real `POST /outings` with the same friend's id listed twice in `invitee_ids` and confirmed exactly one invite row was created, not two or an error; full test suite afterward, 17/17.

## Audit #9 — "Plan something" button on a match card

Landing page's own "How it works" copy already promises this step ("Plan the outing... Turn a match into a real invite"), but the dashboard required manually reopening a separate form and re-selecting the friend and time by hand. Added a `toDatetimeLocalValue()` helper (converts a real `Date` into the exact `YYYY-MM-DDTHH:MM` local-time shape the `datetime-local` input needs — can't just slice the ISO string, that would keep UTC, not local, wall-clock time) and a `handlePlanFromMatch(friend)` handler: sets the invitee checklist to *just* that friend (deliberately replacing, not appending, to whatever was already selected — this is starting a fresh plan from a specific match, not adding onto an unrelated in-progress form), prefills the time to that match's actual overlap start, and smooth-scrolls the Create Outing form into view. New button styled in the match card's own plum theme (`--plum`/`--plum-hover`) rather than the site-wide default coral, matching the section's existing purple palette.

**Verified for real, via direct DOM inspection rather than a screenshot** (screenshots were hitting the tool's known post-scroll compositing lag again): clicked "Plan something" on the real `sam` match card and confirmed via JS — not visually assumed — that the outing-time input's actual value became `2026-09-24T21:00` (matching `sam`'s real overlap start) and that exactly one checkbox, `sam`'s, ended up checked.

---

## RESUME HERE — all three of today's deferred-audit-item tasks (#5 integration tests, #7 race conditions, #9 Plan-something button) are implemented and verified. **None of it is committed.** User's own instruction was to do all three then come back once to review and commit — that check-in is happening now, interrupted by a compaction-prep request. Next action on resume: give the user the plain-language walkthrough of what was built (they asked for it, calling this "the most thinking so far"), then wait for them to say go before committing — likely as 2-3 separate commits (tests / race-conditions+migration / plan-button), matching the "one commit per real change" pattern used all session, though the user may just want it batched given they asked to review all three together this time. Ask if unsure rather than assuming.

**Still fully pending after this:** README (deliberately last), deployment prep, deployment (final day). Also still-deferred-by-design from the earlier audit triage: #8 (mutual-reveal copy), #15 (fresh-migration verification — note: partially exercised just now, since this round's migration *was* applied to the real running Postgres, just not to a from-scratch fresh one), #16 (edit/remove availability), #17 (consistent error handling on action buttons), #19 (accessibility pass), #20 (splitting the large dashboard component), dark mode.
