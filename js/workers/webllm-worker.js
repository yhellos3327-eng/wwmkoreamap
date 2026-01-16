/**
 * WebLLM Worker - MLC 엔진을 Web Worker에서 실행
 * 메인 스레드 블로킹 방지를 위한 백그라운드 처리
 */

import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.78";

// Worker 컨텍스트에서 WebLLM의 WebWorkerMLCEngineHandler 사용
const handler = new webllm.WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
  handler.onmessage(msg);
};
