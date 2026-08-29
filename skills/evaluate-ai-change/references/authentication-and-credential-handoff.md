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

## Decide whether a credential is needed

- Local `init`, repository inspection, custom in-process evaluations, and
  `gate --offline` can run without a hosted credential.
- Hosted evaluations, organization-scoped evidence, repository intelligence,
  trace upload, and product MCP tools require an attributable bearer credential
  with the operation's documented scope.
- The public documentation MCP at
  `https://www.evalgate.com/api/mcp/docs` is anonymous, read-only, and has no
  organization context. Do not send a bearer token to it unless its current
  documentation explicitly requires one.
- An EvalGate API key identifies an organization and approved scopes. It does
  not provide model-provider credentials, repository access, billing access, or
  administrative privileges by implication.

Start local discovery without exposing secrets:

```bash
evalgate auth status
npx @evalgate/sdk capabilities --format json
```

`auth status` is a local configuration check, not proof that a particular
operation is authorized. Check the command's current help and OpenAPI scope
metadata before making a hosted call.

## Supported human and agent paths

### Interactive account path

A person creates or joins an account through the documented GitHub or Google
sign-in flow. Organization membership and key issuance remain attributable to
that signed-in person. EvalGate does not use an email/password pair or a
separate EvalGate verification email in this flow.

### Existing organization-scoped API/install key

An organization administrator may provision an install key, or an approved
operator may provide an existing least-privilege API key through the documented
handoff. Configure it with `evalgate auth configure --api-key <key>` and verify
only with `evalgate auth status`. The agent must never ask a person to paste the
value into chat, print it, infer it, or place it in repository configuration.

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

For local CLI use, configure the returned key through the documented command:

```bash
evalgate auth configure --api-key <key>
evalgate auth status
```

The CLI stores it outside the repository in the operating-system user
configuration directory. The published runtime documents these defaults:

- Windows: `%APPDATA%\\evalgate\\config.json`
- macOS: `~/Library/Application Support/evalgate/config.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/evalgate/config.json`

Managed environments may use an absolute `EVALGATE_CONFIG_HOME`. Repository
configuration must not supply a bearer key or redirect a saved/environment key
to an untrusted API origin. CI should inject `EVALGATE_API_KEY` through its
secret store rather than writing a local credential file.

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
  authorized organization member; do not guess broader scopes.
- `429 Too Many Requests`: honor `Retry-After` and the advertised rate-limit
  headers. Do not poll faster or retry indefinitely.
- A pending, denied, expired, or unavailable handoff is an authentication or
  infrastructure outcome—not evidence that an organization, project, or
  evaluation is absent.

Revoke keys through the authorized organization control plane or the documented
OAuth revoke endpoint. Remove revoked secrets from local and CI stores and
rotate them if they may have entered logs or history.

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

Do not report `auth status` alone as proof of hosted access. Do not report
successful public discovery as proof of organization authorization. Hosted
evidence remains separate from local offline evidence and must be classified by
the canonical `evaluate-ai-change` decision contract.
