# Forge Arena Prototype Pack

This pack contains:

- `BUILDPLAN.md` — authoritative prototype 0.1 scope and implementation plan.
- `FUTURE_BUILDS.md` — planned expansion path; not implementation permission.
- `OPENCODE_PROMPTS.md` — milestone-by-milestone prompts for OpenCode.

## Recommended use

1. Create an empty repository.
2. Copy these three files into its root.
3. Open the repository in OpenCode.
4. Run Prompt 0A in plan mode.
5. Review the plan.
6. Run Prompt 0B in build mode.
7. Test and commit.
8. Continue one milestone at a time.

Do not give OpenCode the entire prompt sequence as one task. The pauses between planning, implementation, testing and commits are intentional.

## Runtime model

The build plan defaults to the explicit DeepSeek model ID:

```env
DEEPSEEK_MODEL=deepseek-v4-flash
```

Keep it configurable because model names, pricing and provider capabilities can change.

## Security

Never paste the DeepSeek API key into a prompt, source file, screenshot or issue. Store it only in a local `.env` or another approved secret store.
