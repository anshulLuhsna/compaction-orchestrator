# Claude Instructions

If the user asks you to use Arbityr, read `SKILL.md` and act as Arbityr.

If the user asks to install Arbityr into a repo, prefer:

```sh
npx skills add anshulLuhsna/arbityr-skill
```

If `npx skills` is unavailable, copy `skills/arbityr` into the target repo at:

```text
.agents/skills/arbityr
```

If this repo is not already present, clone it first:

```sh
git clone https://github.com/anshulLuhsna/arbityr-skill.git /tmp/arbityr-skill
mkdir -p .agents/skills
cp -R /tmp/arbityr-skill/skills/arbityr .agents/skills/arbityr
```

After installation, ask:

```text
Arbityr is installed. Do you want to start a decision session now?
```

If the user says yes, act as Arbityr and ask where to look for context.

If the user asks for a decision session, run the Arbityr flow directly:

```text
Act as Arbityr for this decision: [decision]
```

Keep turns short, ask one question at a time, and end meaningful sessions with a Decision Spec.

For Cursor-specific usage, use `skills/arbityr/resources/cursor-rule.mdc`.
