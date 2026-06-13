# Arbityr Skill

Arbityr is a decision checkpoint for developers building with AI.

Use it before you ask an AI agent to build something non-trivial, so you can defend the decision before the code exists.

## Install

Install Arbityr with one command:

```sh
npx skills add anshulLuhsna/arbityr-skill
```

Then ask your agent:

```text
Use Arbityr on this decision: [your real decision]
```

Or:

```text
Before I build this, run Arbityr on the current diff.
```

The repo includes a root `SKILL.md` so `npx skills add` can install it directly from GitHub.

## Manual Install

If an agent cannot run `npx skills`, it can still clone this public repo and copy the skill:

```sh
git clone https://github.com/anshulLuhsna/arbityr-skill.git /tmp/arbityr-skill
mkdir -p .agents/skills
cp -R /tmp/arbityr-skill/skills/arbityr .agents/skills/arbityr
```

Then ask:

```text
Read .agents/skills/arbityr/SKILL.md and act as Arbityr.
```

## Point An Agent At This Repo

Ask your coding agent:

```text
Install Arbityr for this repo.

Use the simplest install path:
npx skills add anshulLuhsna/arbityr-skill

If npx skills is unavailable, clone it:
git clone https://github.com/anshulLuhsna/arbityr-skill.git /tmp/arbityr-skill

Then install manually:
mkdir -p .agents/skills
cp -R /tmp/arbityr-skill/skills/arbityr .agents/skills/arbityr

If this repo is already present, copy skills/arbityr from the repo into .agents/skills/arbityr.

After installation, ask the user:
"Arbityr is installed. Do you want to start a decision session now?"

If yes, start by asking where to look for context.
```

## Repo Structure

```text
arbityr-skill/
  SKILL.md
  skills/
    arbityr/
      SKILL.md
      resources/
        cursor-rule.mdc
  AGENTS.md
  CLAUDE.md
  README.md
  LICENSE
```

The core skill is:

```text
SKILL.md
```

For agents that expect repo-local skill folders, the same skill is mirrored at:

```text
skills/arbityr/SKILL.md
```

The Cursor rule version is:

```text
skills/arbityr/resources/cursor-rule.mdc
```

## Cursor Native Rule

The recommended Cursor install is the same one-command path:

```sh
npx skills add anshulLuhsna/arbityr-skill
```

If you specifically want a Cursor project rule instead, copy:

```text
skills/arbityr/resources/cursor-rule.mdc
```

Into your project as:

```text
.cursor/rules/arbityr.mdc
```

Then open Cursor chat and say:

```text
Use Arbityr on this decision: [your real decision]
```

## Claude, Codex, Cursor, OpenCode, Or Other Agents

After installation, ask:

```text
Use Arbityr on this decision: [your real decision]
```

Or:

```text
Before I build this, run Arbityr on the current diff.
```

Agents with skills support should discover Arbityr from the installed `SKILL.md`. Agents without skill discovery can still read `skills/arbityr/SKILL.md` directly.

## What To Test

Use Arbityr only on a real decision you are about to make.

Good decisions:

- Should I add Redis here or keep state in Postgres?
- Should this feature ship as a manual workflow first or as automation?
- Should this schema change happen now or wait until the next version?
- Should I let the AI agent implement this whole flow or split the work?

Bad tests:

- "Try the prompt and tell me if it sounds good."
- "Ask me random questions."
- "Review this code."

## What Arbityr Produces

Arbityr runs a short decision session and ends with a decision spec:

```md
## Decision Spec

**Decision:** ...
**Why:** ...
**Load-bearing assumption:** ...
**Challenge:** ...
**Held / Changed:** ...
**This decision was wrong if:** ...
```

## Discoverability Checklist

- GitHub topics: `agent-skills`, `ai-skill`, `claude-skills`, `cursor`
- Install command: `npx skills add anshulLuhsna/arbityr-skill`
- Public catalogs: submit after more field usage

## Privacy

This repo has no server and no telemetry.

Arbityr runs inside your existing AI coding session. Nothing is sent anywhere by this skill repo.
