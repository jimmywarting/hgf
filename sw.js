self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

const map = new Map()

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
globalThis.addEventListener('message', evt => {
  const data = evt.data
  map.set(data.url, data)
  console.log('recv postmessage', data)
})

globalThis.addEventListener('fetch', evt => {
  const url = evt.request.url
  console.log('sw url', url)
  console.log('sw map', map)
  const data = map.get(url)
  console.log('sw data', data)
  if (!data) return null
  map.delete(url)
  evt.respondWith(new Response(data.rs, {
    headers: data.headers
  }))
})
