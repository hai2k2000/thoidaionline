import http from "node:http";

const target = new URL(process.argv[2] ?? "");
const port = Number(process.env.E2E_GATEWAY_PORT);
if (target.protocol !== "http:" || !/^127\.0\.0\.1:\d+$/.test(target.host)) throw new Error("sandbox gateway target must be localhost HTTP");
if (!Number.isInteger(port) || port < 1024) throw new Error("E2E_GATEWAY_PORT is required");

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    const prefix = request.url?.startsWith("/rest/v1") ? "/rest/v1" : request.url?.startsWith("/storage/v1") ? "/storage/v1" : "";
    if (!prefix) {
      response.writeHead(404).end();
      return;
    }
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await new Promise((resolve, reject) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => resolve(Buffer.concat(chunks)));
      request.on("error", reject);
    });
    const forwardedHeaders = Object.fromEntries([...request.headers].filter(([name]) => !["connection", "content-length", "host", "transfer-encoding"].includes(name)));
    const upstreamUrl = new URL(request.url.slice(prefix.length) || "/", target);
    const upstream = await new Promise((resolve, reject) => {
      const upstreamRequest = http.request(upstreamUrl, { method: request.method, headers: forwardedHeaders }, (upstreamResponse) => resolve(upstreamResponse));
      upstreamRequest.on("error", reject);
      if (body) upstreamRequest.write(body);
      upstreamRequest.end();
    });
    const responseHeaders = Object.fromEntries(Object.entries(upstream.headers).filter(([name]) => !["connection", "content-encoding", "content-length", "transfer-encoding"].includes(name)));
    response.writeHead(upstream.statusCode ?? 502, responseHeaders);
    upstream.pipe(response);
  } catch (error) {
    console.error(`sandbox gateway request failed: ${error?.cause?.code ?? error?.code ?? error?.name ?? "unknown"} ${error?.cause?.message ?? ""}`.trim());
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
    response.end("sandbox gateway upstream failure");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`sandbox gateway listening on 127.0.0.1:${port}`));
