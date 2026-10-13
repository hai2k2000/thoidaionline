import http from "node:http";

const target = new URL(process.argv[2] ?? "");
const port = Number(process.env.E2E_GATEWAY_PORT);
if (target.protocol !== "http:" || !/^127\.0\.0\.1:\d+$/.test(target.host)) throw new Error("sandbox gateway target must be localhost HTTP");
if (!Number.isInteger(port) || port < 1024) throw new Error("E2E_GATEWAY_PORT is required");

const server = http.createServer(async (request, response) => {
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
  const upstream = await fetch(new URL(request.url.slice(prefix.length) || "/", target), {
    method: request.method,
    headers: request.headers,
    body,
  });
  response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
  response.end(Buffer.from(await upstream.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => console.log(`sandbox gateway listening on 127.0.0.1:${port}`));
