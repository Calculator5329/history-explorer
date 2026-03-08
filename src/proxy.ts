import { createClient } from "@calculator-5329/cloud-proxy";

export const proxy = createClient({
  baseUrl: import.meta.env.VITE_PROXY_URL,
  token: import.meta.env.VITE_PROXY_TOKEN,
});
