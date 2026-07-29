# Project instructions for Claude Code

## Spec-kit branch-per-feature workflow

This repo has no `.specify/extensions.yml` git hook installed, so `/speckit-specify`'s
built-in branch-creation step is a no-op by default (specs 001–023 were all built directly
on `main`). Going forward, branch per feature instead:

1. **On every `/speckit-specify` invocation**, before writing `spec.md`:
   - Make sure the working tree is clean (stash or ask if it isn't — see the standing git
     safety rules).
   - `git checkout main && git pull` (skip the pull if there's no remote tracking branch
     configured, e.g. offline work).
   - `git checkout -b <feature-branch-name>`, where `<feature-branch-name>` is the exact
     name that will also be used for the `specs/<feature-branch-name>/` directory (e.g.
     `024-some-feature`) — same numbering/short-name resolution as always.
   - Then proceed with the normal specify flow on that new branch.
2. **`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`** for that feature continue on
   the same branch — no extra branch handling needed for those.
3. **Opening a PR**: once implementation is complete (or whenever the user explicitly asks
   for it), offer to push the feature branch and open a PR against `main` via `gh pr
   create`, with a title/body summarizing the feature from its spec and tasks. Always
   confirm with the user before actually pushing or opening the PR — pushing and opening
   PRs are visible, hard-to-reverse actions per the standing safety rules, so a stated
   preference for the *workflow* is not a standing authorization to skip that confirmation
   on each one.

This only applies going forward. Specs 001–023 are already merged into `main` and are not
retroactively re-branched.
