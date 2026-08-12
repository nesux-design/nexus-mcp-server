export default {
      async fetch(request, env, ctx) {
          const url = new URL(request.url);
              const pathname = url.pathname;

                  if (pathname === "/") {
                        return new Response("Nexus MCP Server is running ✅", { status: 200 });
                            }

                                return new Response("Not Found", { status: 404 });
                                  }
                                  };