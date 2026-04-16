import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match?.[1] ?? null;

  return new Response(
    JSON.stringify({
      ok: true,
      projectRef,
      hasAnthropicKey: !!Deno.env.get("ANTHROPIC_API_KEY"),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
