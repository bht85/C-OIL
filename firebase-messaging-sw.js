importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBElhvMeXAuUkyWf6r0volTumE2LRcxggQ",
  authDomain: "compose-oil.firebaseapp.com",
  projectId: "compose-oil",
  storageBucket: "compose-oil.firebasestorage.app",
  messagingSenderId: "319952705434",
  appId: "1:319952705434:web:63b7bc10aa96d2ad258c23"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
