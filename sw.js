'use strict';

// Tăng số phiên bản này (v1 -> v2 ...) mỗi khi bạn cập nhật code để buộc
// trình duyệt tải bản mới thay vì dùng cache cũ.
const CACHE_NAME = 'shambhavi-cache-v1';

// Các file lõi bắt buộc phải cache được ngay từ đầu (không được lỗi).
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Chiến lược: "stale-while-revalidate"
// - Có sẵn trong cache -> trả về ngay lập tức (dùng được khi offline).
// - Đồng thời âm thầm tải bản mới từ mạng (nếu có mạng) để cập nhật cache
//   cho lần sau. Điều này cũng giúp: khi bạn bổ sung file audio mới vào
//   thư mục audio/ và mở app lúc có mạng, file đó sẽ tự được cache lại
//   mà không cần sửa code hay tăng version.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // chỉ xử lý tài nguyên cùng domain

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // không có mạng -> dùng cache nếu có

        return cachedResponse || networkFetch;
      })
    )
  );
});
