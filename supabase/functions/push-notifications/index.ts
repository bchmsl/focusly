import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getOrCreateVapidKeys(supabaseAdmin: any) {
  // Check if keys already exist
  const { data: existing } = await supabaseAdmin
    .from("push_config")
    .select("key, value")
    .in("key", ["vapid_public_key", "vapid_private_key"]);

  if (existing && existing.length === 2) {
    const pub = existing.find((r: any) => r.key === "vapid_public_key")?.value;
    const priv = existing.find((r: any) => r.key === "vapid_private_key")?.value;
    return { publicKey: pub, privateKey: priv };
  }

  // Generate new VAPID keys using Web Crypto API (ECDSA P-256)
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKeyBase64 = base64UrlEncode(new Uint8Array(publicKeyRaw));
  const privateKeyBase64 = privateKeyJwk.d!;

  // Store in database
  await supabaseAdmin.from("push_config").upsert([
    { key: "vapid_public_key", value: publicKeyBase64 },
    { key: "vapid_private_key", value: privateKeyBase64 },
  ]);

  return { publicKey: publicKeyBase64, privateKey: privateKeyBase64 };
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 12 * 60 * 60; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiry, sub: subject };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const publicKeyBytes = base64UrlDecode(vapidPublicKey);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vapidPrivateKey,
    x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
    y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r|s format if needed
  const sigBytes = new Uint8Array(signature);
  const signatureB64 = base64UrlEncode(sigBytes);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
  };
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
) {
  const p256dhBytes = base64UrlDecode(p256dhKey);
  const authBytes = base64UrlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    p256dhBytes.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  // HKDF for auth info
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...p256dhBytes,
    ...localPublicKeyRaw,
  ]);

  const ikmKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // PRK from auth
  const prkAuth = await crypto.subtle.importKey(
    "raw",
    authBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkAuth, sharedSecret)
  );

  // Derive IKM
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const ikm = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      prkKey,
      new Uint8Array([...authInfo, 1])
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for content encryption key and nonce
  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prkCE = new Uint8Array(
    await crypto.subtle.sign("HMAC", saltKey, ikm)
  );

  const prkCEKey = await crypto.subtle.importKey(
    "raw",
    prkCE,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cekFull = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      prkCEKey,
      new Uint8Array([...cekInfo, 1])
    )
  );
  const cek = cekFull.slice(0, 16);

  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonceFull = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      prkCEKey,
      new Uint8Array([...nonceInfo, 1])
    )
  );
  const nonce = nonceFull.slice(0, 12);

  // Encrypt payload
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array([...payloadBytes, 2]); // 2 = final record delimiter

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm content encoding header
  const recordSize = encrypted.length;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  const view = new DataView(header.buffer);
  view.setUint32(16, recordSize + 16 + 4 + 1 + localPublicKeyRaw.length);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header, 0);
  body.set(encrypted, header.length);

  return body;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const payloadStr = JSON.stringify(payload);

  try {
    const encryptedPayload = await encryptPayload(
      payloadStr,
      subscription.p256dh,
      subscription.auth
    );

    const vapidHeaders = await createVapidAuthHeader(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      "mailto:noreply@focusly.app"
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        ...vapidHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "2419200",
        Urgency: "high",
      },
      body: encryptedPayload,
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error("Push send error:", error);
    return { success: false, status: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET vapid public key
    if (req.method === "GET" && action === "vapid-key") {
      const keys = await getOrCreateVapidKeys(supabaseAdmin);
      return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions require auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Subscribe
    if (action === "subscribe") {
      const { endpoint, p256dh, auth } = body;
      await supabaseAdmin.from("push_subscriptions").upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" }
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unsubscribe
    if (action === "unsubscribe") {
      const { endpoint } = body;
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send push to all user's devices
    if (action === "send") {
      const { title, body: notifBody } = body;
      const keys = await getOrCreateVapidKeys(supabaseAdmin);

      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", user.id);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = await Promise.allSettled(
        subscriptions.map((sub: any) =>
          sendPushNotification(
            sub,
            { title, body: notifBody },
            keys.publicKey,
            keys.privateKey
          )
        )
      );

      // Clean up failed subscriptions (410 Gone = expired)
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value.status === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", subscriptions[i].endpoint);
        }
      }

      const sent = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;

      return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
