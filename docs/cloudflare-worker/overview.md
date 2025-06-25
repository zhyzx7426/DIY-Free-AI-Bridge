# Cloudflare Worker 核心功能概览

* **多模型路由**：根据 `provider` 字段把请求转发到不同上游（`provider-a` / `provider-b`）。
* **多格式解析**：支持 `JSON`、`application/x-www-form-urlencoded`、`multipart/form-data`（含图片）。
* **统一 OpenAI Chat 封装**：把文本或图片封装成 OpenAI `messages` 结构。
* **SSE 流聚合**：如上游返回 `text/event-stream`，自动汇总为一次性 JSON。
* **CORS & 预检**：全局放行 `OPTIONS` 以及跨域头，方便网页 / 快捷指令调用。
* **基础防护**：10 MB 图片大小限制、`422 INVALID_PROVIDER` 错误提示、60 s 上游超时。
