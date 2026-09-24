# Authentication and credential handoff

Use this reference whenever an EvalGate workflow needs hosted product state,
repository intelligence, traces, MCP product tools, or another operation that
is not local and offline. Authentication is organization-scoped and approval-
anchored: a person signs in, selects an organization, reviews the requested
scopes, and explicitly approves credential issuance.

This reference is the canonical handoff for the public skills distribution. The
runtime authority is the published [authentication walkthrough](https://www.evalgate.com/auth.md),
[OpenAPI document](https://www.evalgate.com/openapi.json), and advertised
OAuth metadata. Do not infer a capability from this document if the runtime
discovery documents disagree.

Invoke every CLI command as `npx @evalgate/sdk <cmd>`. Never run
`npx evalgate` — the unscoped npm package is a third-party package.

## Decide whether a credential is needed

- Local `init`, repository inspection, custom in-process evaluations, and
  `gate --offline` can run without a hosted credential.
- Hosted evaluations, organization-scoped evidence, repository intelligence,
  trace upload, and product MCP tools require an attributable bearer credential
  with the operation's documented scope, **or** a saved `login` session that
  the CLI can read.
- The public documentation MCP at
  `https://www.evalgate.com/api/mcp/docs` is anonymous, read-only, and has no
  organization context. Do not send a bearer token to it unless its current
  documentation explicitly requires one.
- An EvalGate API key identifies an organization and approved scopes. It does
  not provide model-provider credentials, repository access, billing access, or
  administrative privileges by implication.
- Either a saved `login` session or `EVALGATE_API_KEY` works for CLI `repo`,
  `check`, and `trace`. `whoami` shows which credential source is active. The
  SDK library (`new AIEvalClient()`) still needs an explicit key; only the CLI
  reads the saved session.

Start local discovery without exposing secrets:

```bash
npx @evalgate/sdk whoami
npx @evalgate/sdk status --json
npx @evalgate/sdk capabilities --format json
```

`whoami` reports credential source, scopes, expiry, and workspace without
printing the secret. Readiness comes from `status --json`
(`readiness.hostedAuthenticated`, `readiness.hostedLinked`, and
`link.status`). Neither command alone proves that a particular operation is
authorized. Check the command's current help and OpenAPI scope metadata before
making a hosted call. The removed `auth` family (`auth status`,
`auth configure`, `auth provision`) returns `COMMAND_REMOVED` and must not be
used.

## Supported human and agent paths

### Interactive account path

A person creates or joins an account through the documented GitHub or Google
sign-in flow. Organization membership and key issuance remain attributable to
that signed-in person. EvalGate does not use an email/password pair or a
separate EvalGate verification email in this flow.

### Interactive CLI login

For a person at a terminal, run:

```bash
npx @evalgate/sdk login
```

`login` starts a browser device flow, shows the requested scopes before
approval, and stores the CLI session locally without printing it. Verify with
`whoami` and readiness with `status --json`.

### Existing organization-scoped API/install key

An organization administrator may provision an install key, or an approved
operator may provide an existing least-privilege API key through the documented
handoff. For CI and headless environments, inject `EVALGATE_API_KEY` from a
secret store. Verify only with `whoami` and `status --json`. The agent must
never ask a person to paste the value into chat, print it, infer it, or place
it in repository configuration. Do not run the removed
`auth configure --api-key` command.

### RFC 8628 device handoff

Clients that implement the OAuth device grant should discover the advertised
authorization-server metadata first. The published runtime currently exposes:

```text
POST https://www.evalgate.com/oauth/device/authorization
POST https://www.evalgate.com/oauth/token
client_id=evalgate-agent
grant_type=urn:ietf:params:oauth:grant-type:device_code
```

Request only the least-privilege scopes required by the operation. Keep the
returned `device_code` ephemeral and secret. Show the person only the
`verification_uri` and human-readable `user_code`; the person signs in,
selects the organization, reviews every requested scope, and approves or
denies the handoff.

Poll the token endpoint no faster than the returned interval. Handle the
standard `authorization_pending`, `slow_down`, `access_denied`,
`expired_token`, and `invalid_grant` responses explicitly. Approval returns an
opaque bearer credential, approved scopes, and expiry. Treat that credential as
an organization-scoped EvalGate API key and deliver it exactly once to the
approved client. Never print it, put it in a prompt, or commit it.

The shared public client ID is a routing identifier, not proof of agent
identity. It does not replace the displayed code, signed-in person,
organization selection, or scope consent.

### JSON compatibility handoff

Clients without an RFC 8628 implementation can use the documented JSON adapter:

```bash
curl -X POST https://www.evalgate.com/api/agent-setup/start \
  -H 'Content-Type: application/json' \
  --data '{"client_name":"repository assistant","requested_scopes":["eval:read","runs:read"]}'

curl -X POST https://www.evalgate.com/api/agent-setup/poll \
  -H 'Content-Type: application/json' \
  --data '{"device_code":"<device_code>"}'
```

The start response contains a high-entropy `device_code`, human-readable
`user_code`, verification URI, expiry, and minimum polling interval. Pending
polls return `202`; polling too quickly returns `429` with `Retry-After` and an
increased interval. Approval returns the bearer key, approved scopes, and
expiry exactly once. Denied, expired, or consumed requests never return a
credential.

Neither start endpoint creates an account, key, hosted evaluation, or billable
action before human approval.

## Store and use the credential

For local CLI use by a person, prefer `login` so the session is stored outside
the repository. For CI, inject `EVALGATE_API_KEY` through the secret store
rather than writing a local credential file:

```bash
npx @evalgate/sdk login
npx @evalgate/sdk whoami
npx @evalgate/sdk status --json
```

The CLI stores a login session outside the repository in the operating-system
user configuration directory. The published runtime documents these defaults:

- Windows: `%APPDATA%\\evalgate\\config.json`
- macOS: `~/Library/Application Support/evalgate/config.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/evalgate/config.json`

Managed environments may use an absolute `EVALGATE_CONFIG_HOME`. Repository
configuration must not supply a bearer key or redirect a saved/environment key
to an untrusted API origin.

### Headless CI authentication

CI is not a browser login and is not a device handoff. Bind a pre-approved,
organization-scoped key to the job's secret/environment mechanism, restrict
its scopes and repository audience, and let the CLI/API read it without echoing
the value. Do not generate anonymous credentials in CI, persist keys in build
artifacts, or substitute a future OIDC/workload identity flow for an API key
until the runtime advertises that capability.

When using MCP or REST directly, send the credential only in an HTTPS
`Authorization: Bearer` header. Discover the endpoint and required scope from
OpenAPI or the protected-resource metadata; do not guess routes or scopes.

## Interpret failures without changing the boundary

- `401 Unauthorized`: the credential is missing, invalid, expired, or revoked.
  Read the `WWW-Authenticate` challenge and its `resource_metadata` link.
- `403 Forbidden`: the credential is valid but lacks a required scope or
  organization permission. Request a least-privilege replacement from an
  authorized organization member; do not guess broader scopes. Prefer the
  machine envelope's `retryable` and `failureClass` (for example
  `insufficient_scope`) over remembering that exit 4 is always retryable.
- `429 Too Many Requests`: honor `Retry-After` and the advertised rate-limit
  headers. Do not poll faster or retry indefinitely.
- Link `code: human_action_required` (legacy `GITHUB_ACCESS_REQUIRED`): the
  person must open the returned install URL. Do not retry in a loop.
- Link `GITHUB_INSTALL_UNAVAILABLE` (503): the operator has not configured the
  GitHub App. Report it; do not retry as if it were transient.
- A pending, denied, expired, or unavailable handoff is an authentication or
  infrastructure outcome—not evidence that an organization, project, or
  evaluation is absent.

Revoke keys through the authorized organization control plane or the documented
OAuth revoke endpoint. Remove revoked secrets from local and CI stores and
rotate them if they may have entered logs or history. Use
`npx @evalgate/sdk logout` to clear a saved CLI session.

## Explicitly unsupported claims

The current public contract does not support or advertise:

- third-party identity assertions;
- `identity_assertion` or `id-jag` credential exchange;
- a public `claim_uri` flow;
- an `agent_auth` registration service;
- OAuth refresh tokens;
- OIDC workload federation or client-credentials substitution.

Do not claim that an API key handoff is OIDC federation, and do not implement a
fallback that accepts an identity assertion or silently substitutes a different
credential. If a required identity provider or workload-federation boundary is
missing, report the limitation and keep the workflow local/offline until an
authorized product path exists.

## Verification checklist

Before reporting hosted readiness, record:

1. the runtime discovery or documentation source used;
2. the API origin and exact operation;
3. the credential type and approved scope, without recording its value;
4. the organization boundary returned by the authenticated operation;
5. the machine-readable response status and evidence identifiers; and
6. any unexercised provider, authorization, or policy boundary.

Do not report `whoami` or `status --json` alone as proof of hosted access. Do
not report successful public discovery as proof of organization authorization.
Hosted evidence remains separate from local offline evidence and must be
classified by the canonical `evaluate-ai-change` decision contract.
