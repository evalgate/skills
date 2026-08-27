# EvalGate Agent Plugin

Public, bounded agent workflows for evaluating AI changes with EvalGate. This
repository contains only supported integration contracts: Agent Skills, Agent
Plugin manifests, and MCP server configuration. It does not contain the EvalGate
application source, customer data, proprietary scoring logic, or private prompts.

## Install the skills

```bash
npx skills add evalgate/agent-plugin
```

The skills help agents:

- set up a reviewed EvalGate project;
- run a local regression gate;
- collect bounded agent traces;
- ask evidence-backed questions about an authorized repository snapshot; and
- connect to EvalGate's public documentation and authenticated product MCP
  servers.

Each skill defines when it should be used, required inputs, validation, and a
safety boundary. Cloud operations require an attributable organization-scoped
EvalGate API key. Discovery and local planning do not grant access to customer
data.

## MCP servers

- Product MCP: `https://www.evalgate.com/api/mcp` (scoped API key required for
  product tools)
- Documentation MCP: `https://www.evalgate.com/api/mcp/docs` (public,
  read-only documentation)

The standard Agent Plugin configuration is published in [`mcp.json`](mcp.json).

## Public references

- [Developer hub](https://www.evalgate.com/developers)
- [Machine-readable developer index](https://www.evalgate.com/developers.md)
- [Authentication walkthrough](https://www.evalgate.com/auth.md)
- [OpenAPI 3.2](https://www.evalgate.com/openapi.json)
- [Privacy](https://www.evalgate.com/privacy)
- [Terms](https://www.evalgate.com/terms)

## License

MIT
