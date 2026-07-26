# Security Baseline

## Environment secrets

- `DEEPSEEK_API_KEY` is read from environment variables only.
- `.env` is gitignored and never committed.
- `.env.example` contains placeholders, never real keys.
- The API key is never accepted as a CLI argument (shell history risk).
- The full API key is never printed in logs or error messages.
- Request headers containing the key are redacted from diagnostic output.

## Provider calls

- All provider API calls happen server-side in Node.js.
- No browser or client code makes provider requests.
- Provider responses are validated with Zod before use.

## Bounded model use

- Every model call has a timeout (configurable, default 60 seconds).
- Every model call has a maximum response size.
- Every model call has a finite retry count (configurable, default 2).
- No unbounded agent loop is permitted.
- Schema validation rejects malformed model output.

## Input safety

- Model output is treated as untrusted data.
- Model output never determines file paths, shell commands or URLs.
- Model output never triggers code execution.
- Model output is limited to structured JSON matching documented schemas.
- Prompt injection boundaries are enforced by schema validation.

## Match record safety

- Match records contain no environment secrets.
- Match records contain no full request headers.
- Match records contain provider metadata (model ID, usage stats) but no API keys.
- File names for saved matches do not use untrusted model-provided text.

## Dependencies

- Dependencies are pinned in `package.json` and `package-lock.json`.
- Unnecessary dependencies are avoided.
- Security-relevant updates are reviewed when flagged by `npm audit`.

## Logging

- Structured logging via `pino`.
- Secrets and API keys are never logged at any level.
- Error messages are safe for display (no internal paths or secrets).
