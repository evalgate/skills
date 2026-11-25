# Client configuration for EvalGate MCP

Use the format documented for the client you are actually running in. The
servers are the same everywhere:

- Documentation: `https://www.evalgate.com/api/mcp/docs` (anonymous, read-only)
- Product: `https://www.evalgate.com/api/mcp` (bearer credential required)

## Claude Code, Cursor and Claude Desktop

The example below is for
**Claude Code project `.mcp.json`**, which expands `${EVALGATE_API_KEY}` from
the process environment. It is not a universal Desktop or Cursor configuration.
Never commit a literal token.

```json
{
  "mcpServers": {
    "evalgate-docs": {
      "type": "http",
      "url": "https://www.evalgate.com/api/mcp/docs"
    },
    "evalgate-product": {
      "type": "http",
      "url": "https://www.evalgate.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${EVALGATE_API_KEY}"
      }
    }
  }
}
```

For **Cursor `.cursor/mcp.json`**, use URL entries and its `${env:NAME}` syntax:

```json
{
  "mcpServers": {
    "evalgate-docs": { "url": "https://www.evalgate.com/api/mcp/docs" },
    "evalgate-product": {
      "url": "https://www.evalgate.com/api/mcp",
      "headers": { "Authorization": "Bearer ${env:EVALGATE_API_KEY}" }
    }
  }
}
```

For **Claude Desktop / claude.ai**, add the remote docs URL through the custom
connector UI. Remote connectors differ from local Desktop server configuration;
do not paste Claude Code JSON into `claude_desktop_config.json`. Product access
requires a client-supported authentication flow. Do not assume arbitrary bearer
headers or EvalGate OAuth interoperability were tested in the Desktop connector.
If the client cannot supply the required credential, use an authorized client
with header support instead of claiming it is connected.

Client syntax sources (reviewed 2026-09-30):
[Claude Code MCP](https://code.claude.com/docs/en/mcp),
[Cursor MCP](https://cursor.com/docs/mcp), and
[Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
These are documented formats; no live client handshake was performed here.

The docs server is anonymous and public-content-only. The product server needs
a token: anonymous tool calls return `401`. Keep the bearer value in the
client's secret store, not in a checked-in header.

Published plugin manifests in this repository (`mcp.json`, `.mcp.json`) list
the same URLs without credentials. `mcp.json` uses the Agent Plugins schema
transport name `streamable-http`; `.mcp.json` uses Claude Code's `http` name.
Both describe Streamable HTTP, not different endpoints.

