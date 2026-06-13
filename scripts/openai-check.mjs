const baseUrl = process.env.API_URL ?? "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return body;
}

const status = await request("/v1/openai/status");
if (!status.configured) {
  console.log(JSON.stringify({
    configured: false,
    model: status.model,
    nextStep: "Create .env from .env.example and set OPENAI_API_KEY."
  }, null, 2));
  process.exit(0);
}

const test = await request("/v1/openai/test", { method: "POST" });
console.log(JSON.stringify(test, null, 2));
