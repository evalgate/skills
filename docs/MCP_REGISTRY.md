# EvalGate MCP Registry metadata

The primary full MCP identity is `com.evalgate/evalgate` at
`https://www.evalgate.com/api/mcp`. Its public, read-only documentation companion
is `com.evalgate/evalgate-docs` at `https://www.evalgate.com/api/mcp/docs`.
Both use DNS-verified ownership of evalgate.com.

This Skills repository distributes connection metadata and agent instructions.
It does not host the application or publish registry entries. The platform
release pipeline owns publication and domain-verification credentials. The
[`Validate MCP Registry metadata` workflow](../.github/workflows/publish-mcp-registry.yml)
validates this repository's metadata without a publishing credential.

[`server.json`](../server.json) mirrors the canonical full MCP manifest. Keep
its name, metadata version and connection settings aligned with the reviewed
platform manifest. Metadata versions are independent of Skills and SDK versions.
The full server supports OAuth discovery or scoped organization credentials;
its registry metadata does not require a pasted bearer key. Never commit keys.

## Updating metadata

1. Prepare the canonical manifest change in the platform release pipeline.
2. Validate, publish and read back that version through the domain-verified
   publisher. Identical published versions are verified without republishing;
   changed metadata requires a new version.
3. Mirror the accepted full-server metadata here and run `npm test`.
4. Merge the reviewed Skills change. This workflow validates; it cannot publish
   under the historical GitHub namespace or recreate its URL conflict.

The former `io.github.evalgate/evalgate` listing must be retired as part of the
namespace migration: the registry reserves each remote URL for one server name,
including when the same operator owns both namespaces. Both GitHub repositories
remain available. Existing clients keep their direct MCP URLs and credentials.

## Verify the canonical entries

```bash
curl --fail --silent --show-error \
  'https://registry.modelcontextprotocol.io/v0.1/servers/com.evalgate%2Fevalgate/versions/latest'
curl --fail --silent --show-error \
  'https://registry.modelcontextprotocol.io/v0.1/servers/com.evalgate%2Fevalgate-docs/versions/latest'
```

Confirm active status, names, versions and direct remote URLs. Registry metadata
does not establish authenticated execution or a change in product availability.
Product operations remain scope- and role-filtered; follow
[scoped MCP authoring](../skills/use-evalgate-mcp/references/scoped-authoring.md).

## Registry references

- [Remote servers and URL uniqueness](https://modelcontextprotocol.io/registry/remote-servers)
- [Publisher status commands](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md)
- [Current manifest schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)
