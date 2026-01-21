/**
 * @fileoverview WebLLM Worker - runs MLC engine in a Web Worker.
 * Prevents main thread blocking for background processing.
 * @module workers/webllm-worker
 */

import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.78";

/** @type {webllm.WebWorkerMLCEngineHandler} */
const handler = new webllm.WebWorkerMLCEngineHandler();

/**
 * Message handler for the WebLLM worker.
 * @param {MessageEvent} msg - The message event.
 */
self.onmessage = (msg) => {
  handler.onmessage(msg);
};
