import http from "node:http";

const proxyPort = Number(process.env.PROXY_PORT ?? 54320);
const restPort = Number(process.env.REST_PORT ?? 55432);

const server = http.createServer((request, response) => {
  if (!request.url?.startsWith("/rest/v1/")) {
    response.writeHead(501, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_in_e2e_rig" }));
    return;
  }
  const target = `http://127.0.0.1:${restPort}${request.url.slice("/rest/v1".length)}`;
  const upstream = http.request(target, { method: request.method, headers: request.headers }, (source) => {
    response.writeHead(source.statusCode ?? 502, source.headers);
    source.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "rest_unavailable" }));
  });
  request.pipe(upstream);
});

server.listen(proxyPort, "127.0.0.1", () => {
  console.log(`RBAC_E2E_PROXY port=${proxyPort} rest_port=${restPort}`);
});
