# nexus-mcp-server

Production-grade Cloudflare Worker gateway for Nexus MCP connectors and OAuth integrations.

## Google Developer Knowledge

Nexus can proxy Google's official Developer Knowledge MCP server at:

```text
/mcp/googleDeveloperKnowledge
```

The upstream server is:

```text
https://developerknowledge.googleapis.com/mcp
```

Configure the Google Developer Knowledge API key as a Cloudflare Worker secret named:

```text
DEVELOPERKNOWLEDGE_API_KEY
```

Do **not** commit the key to Git. The Worker injects it as the `X-Goog-Api-Key` header when forwarding requests to Google's Developer Knowledge MCP server.

The key should be restricted in Google Cloud to the **Developer Knowledge API**. Google recommends applying API restrictions and, where appropriate, application restrictions as well.

Google Developer Knowledge provides `search_documents` and `get_document` capabilities through its official MCP server, giving Nexus access to Google's current public developer documentation.
