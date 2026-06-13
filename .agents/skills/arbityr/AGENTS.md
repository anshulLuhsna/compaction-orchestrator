# AGENTS.md

This repo ships Arbityr as a small public Agent Skill.

## Mission

Make Arbityr easy for humans and agents to discover, install, and use on a real developer decision.

Do not turn this repo into an app, MCP server, telemetry system, or large product surface unless Anshul explicitly asks.

## Source Of Truth

- `SKILL.md` is the canonical skill for the simplest `npx skills add anshulLuhsna/arbityr-skill` install.
- `skills/arbityr/SKILL.md` mirrors the root skill for agents that expect repo-local skill folders.
- `skills/arbityr/resources/cursor-rule.mdc` is the Cursor-specific rule version.
- `README.md` is the public install and release guide.

When changing the skill behavior, keep `SKILL.md` and `skills/arbityr/SKILL.md` identical.

## Agent Workflow

When asked to use Arbityr:

1. Read `SKILL.md`.
2. Act as Arbityr.
3. Ask for context before pressure-testing if no relevant code, diff, doc, or brief is visible.
4. Ask one question at a time.
5. End meaningful sessions with the decision spec.

When asked to install Arbityr into another repo:

1. Prefer `npx skills add anshulLuhsna/arbityr-skill`.
2. If `npx skills` is unavailable and this repo is not already present, clone `https://github.com/anshulLuhsna/arbityr-skill.git` to a temporary location.
3. Copy `skills/arbityr` from this repo or the temporary clone into the target repo's `.agents/skills/arbityr`.
4. For native Cursor rules only, copy `skills/arbityr/resources/cursor-rule.mdc` to `.cursor/rules/arbityr.mdc`.
5. Do not modify application code during installation.
6. After installation, ask: "Arbityr is installed. Do you want to start a decision session now?"
7. If the user says yes, act as Arbityr and ask where to look for context.

## Editing Rules

- Keep `SKILL.md` short enough to be usable inside coding agents.
- Do not add generic advice sections.
- Do not make Arbityr a pros/cons bot.
- Do not make the decision for the developer.
- Do not add logging, analytics, or external calls.
- Keep Cursor-specific details in `skills/arbityr/resources/cursor-rule.mdc`, not in the core skill unless they apply generally.

## Release Check

Before committing:

```sh
test -f SKILL.md
test -f skills/arbityr/SKILL.md
cmp -s SKILL.md skills/arbityr/SKILL.md
test -f skills/arbityr/resources/cursor-rule.mdc
npx skills add . --list
```
