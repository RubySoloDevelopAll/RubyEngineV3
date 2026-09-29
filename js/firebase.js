/* =========================================
   RubyEngine — Firebase Config & Init
   Firebase v8 (UMD) — compatible tanpa build tools
========================================= */

/* Config dari Firebase Console */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBI2vYtBnITd89jSj1qi3zgmnb9ZHPbQ-0",
  authDomain: "rubyengine-613c5.firebaseapp.com",
  projectId: "rubyengine-613c5",
  storageBucket: "rubyengine-613c5.firebasestorage.app",
  messagingSenderId: "72304979319",
  appId: "1:72304979319:web:c074547b6fb40ed98d8572"
};

/* Init Firebase */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('[Firebase] SDK belum di-load. Cek script tag di HTML.');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    window.db = firebase.firestore();
    window.firebaseReady = true;
    console.log('[Firebase] ✅ Initialized');
  } catch (e) {
    console.error('[Firebase] ❌ Error init:', e);
    window.firebaseReady = false;
  }
})();