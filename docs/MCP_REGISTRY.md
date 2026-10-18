# Publish EvalGate MCP metadata

EvalGate's direct product MCP endpoint is `https://www.evalgate.com/api/mcp`.
[`server.json`](../server.json) defines its official MCP Registry metadata under
the name `io.github.evalgate/evalgate`.

This public Skills repository maintains discovery metadata and its publishing
workflow. It does not contain or host the private EvalGate application. The
manifest intentionally omits `repository`, which would identify the server's
source code. Publishing this metadata does not deploy the product MCP or change
its permissions.

## Versioning

`1.0.0` is the initial registry metadata version. It is independent of the Skills
distribution, SDK, and MCP server runtime versions. Increment `server.json`'s
version whenever its description, connection configuration, or other metadata
changes. Published versions are immutable; reusing one fails rather than
overwriting the existing entry.

## Publish and update

1. Edit `server.json`, keeping the description within 100 characters. The bearer
   value is a template: users supply their own organization key when connecting.
   Never replace `{EVALGATE_API_KEY}` with a credential.
2. Run `npm test` and `mcp-publisher validate server.json` with the publisher
   version pinned in the workflow. Review the complete metadata change.
3. Merge the reviewed manifest into `main`. The
   [`Publish MCP Registry` workflow](../.github/workflows/publish-mcp-registry.yml)
   runs both validation gates before its isolated publishing job. GitHub OIDC
   authorizes the `io.github.evalgate/*` namespace without a stored publishing
   secret. No npm publication or EvalGate product credential is needed.
4. For a manual attempt, run that workflow on `main`. Repeating a successfully
   published version is expected to fail; verify the existing entry before
   deciding whether new metadata needs a version bump.

Pull requests validate without publishing. Automatic publication is triggered
by a `server.json` change on `main`; changing the workflow alone does not publish.
Actions and the official publisher are pinned, and both jobs verify the
publisher archive's SHA-256 before running it.

## Verify the published entry

```bash
curl --fail --silent --show-error \
  'https://registry.modelcontextprotocol.io/v0.1/servers/io.github.evalgate%2Fevalgate/versions/latest'
```

Confirm `server.name`, `server.version`, the direct remote URL, and the secret
bearer input match the reviewed manifest. A registry entry confirms published
connection metadata; it does not prove authenticated write execution. Product
operations remain scope- and role-filtered. Follow
[scoped MCP authoring](../skills/use-evalgate-mcp/references/scoped-authoring.md)
for authorized product verification. The separate documentation MCP remains
public and read-only at `https://www.evalgate.com/api/mcp/docs`.

## Registry references

- [Remote servers](https://modelcontextprotocol.io/registry/remote-servers)
- [GitHub Actions and OIDC](https://modelcontextprotocol.io/registry/github-actions)
- [Immutable versions](https://modelcontextprotocol.io/registry/versioning)
- [Current manifest schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)
