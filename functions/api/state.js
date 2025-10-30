// Cloudflare Pages Function - store and retrieve meal plan
export async function onRequestGet(context) {
  const value = await context.env.MEAL_KV.get("plan");
  return new Response(value || "{}", { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost(context) {
  const data = await context.request.json();
  await context.env.MEAL_KV.put("plan", JSON.stringify(data));
  return new Response("OK");
}
