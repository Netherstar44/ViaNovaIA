import { httpServerHandler } from "cloudflare:node";
import { createExpressServer } from "./app.js";

const { httpServer } = await createExpressServer();

httpServer.listen(8080);

export default httpServerHandler({ port: 8080 });
