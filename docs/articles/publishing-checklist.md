# Publishing Checklist

## Article

- Title: `Your Agent Does Not Need One Summary. It Needs a Compaction Plan.`
- Draft: `docs/articles/compaction-control-layer.md`
- Repo link: `https://github.com/anshulLuhsna/compaction-orchestrator`

## Images

- Hero image: `docs/images/article-hero.png`
- Product screenshot: `docs/images/ui.png`

Use the hero at the top of the post and the UI screenshot near the section that explains what ships in the alpha.

## Reader CTA

Ask readers to do one of three things:

- Try the UI with `npm run dev` and `npm run dev:web`.
- Run the fixtures with `npm run demo:coding`, `npm run demo:voice`, and `npm run eval:accs`.
- Fork the repo and add their own compaction strategy or use-case fixture.

## Short Social Post

Your agent does not need one summary.

It needs a compaction plan.

I built an open-source Compaction Orchestrator for custom agents. It stores the raw session, classifies context, chooses a strategy per segment, and returns a smaller runtime context plus an inspectable plan.

The repo includes SDK, CLI, HTTP API, SQLite persistence, a UI demo, three fixtures, ACCS evaluation, and optional live DeepSeek probes.

Repo: https://github.com/anshulLuhsna/compaction-orchestrator
