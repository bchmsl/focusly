import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePushNotifications = () => {
  const { user, session } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  const getVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("push-notifications", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      // Use fetch directly for GET with query params
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications?action=vapid-key`;
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.publicKey;
    } catch {
      return null;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !session) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID key
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.error("Failed to get VAPID key");
        return false;
      }

      // Convert VAPID key to Uint8Array
      const vapidKeyBytes = urlBase64ToUint8Array(vapidKey);

      // Subscribe to push
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes.buffer as ArrayBuffer,
        });
      }

      subscriptionRef.current = subscription;

      // Store subscription on server
      const subJson = subscription.toJSON();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications?action=subscribe`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      return false;
    }
  }, [user, session, getVapidKey]);

  const sendNotification = useCallback(
    async (title: string, body: string) => {
      if (!session) return;
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications?action=send`;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ title, body }),
        });
      } catch (err) {
        console.error("Send notification error:", err);
      }
    },
    [session]
  );

  // Auto-subscribe on login
  useEffect(() => {
    if (user && session && permission === "granted" && !subscribed) {
      subscribe();
    }
  }, [user, session, permission, subscribed, subscribe]);

  return {
    permission,
    subscribed,
    subscribe,
    sendNotification,
    isSupported: typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
