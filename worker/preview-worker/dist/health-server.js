import http from "node:http";
import { config } from "./config.js";
import { log } from "./logger.js";
export function startHealthServer() {
    const port = Number(process.env.PORT ?? process.env.HEALTH_PORT ?? 8080);
    const server = http.createServer((_req, res) => {
        const body = JSON.stringify({ status: "ok", workerId: config.workerId });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
    });
    server.listen(port, () => {
        log("info", "health server listening", { port });
    });
}
