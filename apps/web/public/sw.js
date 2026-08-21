const CACHE = "rustcontrol-shell-v1"
const SHELL = ["/", "/manifest.webmanifest", "/icons/rustcontrol.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.destination !== "document") {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        return cached || (event.request.mode === "navigate" ? caches.match("/") : Response.error())
      })
  )
})

self.addEventListener("push", (event) => {
  const payload = event.data
    ? event.data.json()
    : { title: "RustControl", body: "You have a new update." }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.some((client) => client.focused)) {
        return undefined
      }
      return self.registration.showNotification(payload.title || "RustControl", {
        body: payload.body || "",
        icon: "/icons/rustcontrol.svg",
        badge: "/icons/rustcontrol.svg",
        tag: payload.tag || "rustcontrol-update",
        renotify: true,
        data: { href: payload.href || "/" },
        vibrate: [120, 60, 120],
      })
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const href = new URL(event.notification.data?.href || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existing) {
        existing.focus()
        return existing.navigate(href)
      }
      return self.clients.openWindow(href)
    })
  )
})
