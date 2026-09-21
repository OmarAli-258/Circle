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
