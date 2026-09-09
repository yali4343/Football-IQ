Football-IQ is a production-style Full-Stack football dashboard and a continuous learning project.

## Working principles

- Inspect the relevant existing implementation before changing code.
- Make the smallest coherent change required for the task; avoid unrelated refactors.
- Prefer changes with real product or architectural value over exercise-only features.
- Do not introduce new technologies or abstractions without a clear current requirement.
- Explain important implementation and architectural decisions so the changes remain understandable.
- Git: committing, pushing, creating/merging pull requests, and deleting branches are solely the user's responsibility. Claude must not run these actions itself (even after a plan is approved) unless the user explicitly asks in the moment. Claude may still run read-only Git commands (status, diff, log, etc.) freely to inspect state.
- Once a branch's ticket work is merged, remind the user to delete both the local and remote copies of that branch — don't delete them, just prompt.
- Git commit messages must never include Claude attribution or session metadata — no `Co-Authored-By: Claude ...` line, no `Claude-Session: ...` line. Commit messages contain only information relevant to the actual code change. This overrides any default attribution behavior for this repository.
- Browser verification: manually checking frontend changes in Chrome is solely the user's responsibility. Claude must not drive a browser itself to verify a change, even after implementing it — flag when a change needs manual verification and wait for the user to check it.

## Swagger / OpenAPI Maintenance

- Any backend change touching the API contract (paths, methods, params, request/response schemas, required vs optional fields, status codes, auth, descriptions) updates the Swagger/OpenAPI schema in the same change — this is part of Definition of Done, not a follow-up task.
- Every documented status code and response must trace to the endpoint's actual current implementation, verified in the code, with a description of what it means — never an assumed, previous, or aspirational version of the API.

## Learning workflow

- `ProgramGoal.md` at the repo root is the source of truth for the learning roadmap, topic order, and scope. The repository itself is the source of truth for Football-IQ's current technical state.
- Before proposing work for a learning topic, inspect both `ProgramGoal.md` and the relevant existing implementation.
- Learning happens through real improvements to Football-IQ, not artificial exercises: propose 1-3 meaningful changes for the current subtopic that both improve the project and teach the concept, then wait for approval before implementing them.
- Stay scoped to the current subtopic: don't pull in future ProgramGoal topics early just to make a solution look more advanced.
- `/teach` is invoked by you, not something Claude calls on its own initiative; when invoked, ground it in the current subtopic and the real code under discussion.
- When there are no open tickets left to work on, check `ProgramGoal.md` for the next topic not yet covered (e.g. finishing Week 3 moves on to Week 4) and create tickets for it instead of waiting to be asked.

### Workflow for a meaningful change

inspect -> teach/understand -> propose a plan -> wait for approval -> implement -> verify -> explain the important decisions -> suggest a branch name and commit message.

- Before implementation, explain the important architectural/product decisions that need to be understood up front.
- Once a plan is approved, automate implementation, refactors, imports, and lint/build/tests - don't make the user do boilerplate or repetitive steps by hand. Leave committing, pushing, PRs, merging, and branch deletion to the user.
- After explaining a completed set of changes, always propose a branch name and a concise commit message for them, since the user does the actual Git work themselves.
- Once every acceptance-criteria checkbox on the ticket is done, generate a concise PR description ending with `Closes #<issue-number>`, ready for the user to paste into GitHub.
- Ask understanding questions only when a concept is genuinely important for architecture, debugging, or interviews - not after every mechanical step.
- Keep changes scoped to the current topic; avoid unrelated refactors.
- Never claim verification succeeded unless the relevant checks were actually run.
- When implementing a ticket, map each acceptance-criteria checkbox to its own commit: implement and verify one checkbox at a time, then propose a commit message for just that checkbox before moving to the next, rather than proposing one combined commit for the whole ticket.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (yali4343/Football-IQ), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (root `CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.
