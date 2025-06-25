// DIY-Free-AI-Bridge
const UPSTREAMS: Record<string, string> = {
  "provider-a": "https://api.provider-a.example/v1/chat/completions",
  "provider-b": "https://api.provider-b.example/v1/chat/completions"
};

const ALLOWED_PATHS = [
  "/v1/chat/completions",
  "/compatible-mode/v1/chat/completions"
];

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    const { pathname } = new URL(req.url);
    if (req.method !== "POST" || !ALLOWED_PATHS.includes(pathname)) {
      return json({ error: "Only POST " + ALLOWED_PATHS.join(" or ") }, 404);
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let provider: string | null = null;
    let parsedBody: any;

    try {
      if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        provider = (form.get("provider") as string) || "";
        parsedBody = await handleMultipart(form);
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const raw = await req.text();
        const params = new URLSearchParams(raw);
        provider = params.get("provider");
        parsedBody = await handleFormUrlEncoded(params);
      } else {
        const jsonData = await req.json();
        provider = jsonData.provider;
        parsedBody = await handleJson(jsonData);
      }
    } catch (e: any) {
      return json({ error: `Invalid request body: ${e.message}` }, 400);
    }

    if (!provider || !UPSTREAMS[provider]) {
      return json({
        error: "Invalid provider",
        error_code: "INVALID_PROVIDER",
        message: `The provider \"${provider}\" is not supported. Use one of: ${Object.keys(UPSTREAMS).join(", ")}.`
      }, 422);
    }

    const upstreamURL = UPSTREAMS[provider];
    const headers = new Headers(req.headers);
    headers.set("content-type", "application/json");
    headers.delete("host");
    headers.delete("content-length");

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamURL, {
        method: "POST",
        headers,
        body: JSON.stringify(parsedBody),
        cf: { timeout: 60_000 }
      } as RequestInit);
    } catch (err: any) {
      return json({ error: "Upstream fetch failed", detail: err.message }, 502);
    }

    const resType = upstreamRes.headers.get("content-type") || "";
    if (!resType.startsWith("text/event-stream")) {
      const passthroughHeaders = new Headers(upstreamRes.headers);
      passthroughHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: passthroughHeaders });
    }

    const final = await parseSSE(upstreamRes.body as ReadableStream<Uint8Array>);
    return json(final);
  }
};

async function handleMultipart(form: FormData) {
  const file = form.get("image") as File | null;
  const text = (form.get("text") as string) ?? "";
  const model = (form.get("model") as string) ?? "default-model";
  const stream = form.get("stream") === "true";

  if (file && file.size > 10 * 1024 * 1024) throw new Error("File size exceeds 10MB limit.");

  const parts: any[] = [];
  if (file && file.size > 0) {
    const dataURL = "data:image/png;base64," + (await fileToBase64(file));
    parts.push({ type: "image_url", image_url: { url: dataURL } });
  }

  if (parts.length) return { model, stream, messages: [{ role: "user", content: parts }] };
  if (text) return { model, stream, messages: [{ role: "user", content: text }] };
  throw new Error("Request must include text or file content.");
}

function handleFormUrlEncoded(params: URLSearchParams) {
  const text = params.get("text") ?? params.get("prompt") ?? "";
  if (!text) throw new Error("Missing text input.");
  const model = params.get("model") ?? "default-model";
  const stream = params.get("stream") === "true";
  return { model, stream, messages: [{ role: "user", content: text }] };
}

function handleJson(json: any) {
  if (Array.isArray(json.messages)) {
    const { provider: _ignored, ...rest } = json;
    return rest;
  }
  const text = json.text ?? json.prompt ?? "";
  if (!text) throw new Error("Missing text or messages.");
  return {
    model: json.model ?? "default-model",
    stream: json.stream === true,
    messages: [{ role: "user", content: text }]
  };
}

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function parseSSE(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "", resultText = "", finish = "stop";
  const meta = { id: "", created: 0, model: "" };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (let line of lines) {
      line = line.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") { reader.cancel(); break; }
      let parsed: any;
      try { parsed = JSON.parse(payload); } catch { continue; }
      if (!meta.id && parsed.id) meta.id = parsed.id;
      if (!meta.created && parsed.created) meta.created = parsed.created;
      if (!meta.model && parsed.model) meta.model = parsed.model;
      const delta = parsed.choices?.[0]?.delta || {};
      if (delta.content) resultText += delta.content;
      if (parsed.choices?.[0]?.finish_reason) finish = parsed.choices[0].finish_reason;
    }
  }

  return {
    id: meta.id || crypto.randomUUID(),
    object: "chat.completion",
    created: meta.created || Math.floor(Date.now() / 1000),
    model: meta.model,
    choices: [{ index: 0, message: { role: "assistant", content: resultText }, finish_reason: finish }]
  };
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors() } });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "*"
  } as Record<string, string>;
}
