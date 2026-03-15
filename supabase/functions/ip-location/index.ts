const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("ipapi failed");
    const data = await res.json();
    return new Response(JSON.stringify({
      lat: data.latitude,
      lon: data.longitude,
      city: data.city || "Your location",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch {
    try {
      const res = await fetch("https://ip-api.com/json/?fields=lat,lon,city");
      const data = await res.json();
      return new Response(JSON.stringify({
        lat: data.lat,
        lon: data.lon,
        city: data.city || "Your location",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
});
