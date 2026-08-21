/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/uploads\//],
  }),
);

type Payload = {
  title?: string;
  body?: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: { url?: string };
};

self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? {}) as Payload;
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Schichtklar", {
      body: data.body,
      icon: data.icon,
      image: data.image,
      badge: data.badge,
      tag: data.tag,
      data: data.data ?? { url: "/app" },
      lang: "de",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/app";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        await client.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
