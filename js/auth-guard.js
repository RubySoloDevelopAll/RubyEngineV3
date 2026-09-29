(function () {
  'use strict';

  console.log('[AuthGuard] ===== LOADED =====');

  if (!window.Auth) {
    console.error('[AuthGuard] ✗ window.Auth not found');
    return;
  }
  console.log('[AuthGuard] ✓ Auth module found');

  var me = Auth.current();
  console.log('[AuthGuard] Auth.current() =', me);

  if (!me || !me.username) {
    console.warn('[AuthGuard] ✗ No active session');
    return;
  }
  console.log('[AuthGuard] ✓ Session:', me.username);

  var _loggingOut = false;
  var _unsubscribe = null;

  function forceLogout(msg) {
    if (_loggingOut) return;
    _loggingOut = true;

    try { if (window.SFX && SFX.err) SFX.err(); } catch (e) {}

    alert('SESSION ENDED\n\n' + msg.replace(/<[^>]+>/g, ''));

    setTimeout(function () {
      try { Auth.logout(); } catch (e) {}
      try { sessionStorage.setItem('re_kick_msg', msg); } catch (e) {}
      window.location.replace('login.html?kicked=1');
    }, 800);
  }

  function validate(userData) {
    if (!userData) { forceLogout('Akun kamu sudah dihapus oleh admin.'); return; }
    if (userData.active === false) { forceLogout('Akun dinonaktifkan oleh admin.'); return; }
    if (typeof Auth.isExpired === 'function' && Auth.isExpired(userData)) {
      forceLogout('Masa aktif akun habis.');
      return;
    }
  }

  function attachListener() {
    if (!window.firebase || !firebase.firestore) {
      console.warn('[AuthGuard] Waiting firebase...');
      setTimeout(attachListener, 1000);
      return;
    }
    if (_unsubscribe) return;

    try {
      console.log('[AuthGuard] Attaching listener for:', me.username);

      _unsubscribe = firebase.firestore()
        .collection('users')
        .where('username', '==', me.username)
        .limit(1)
        .onSnapshot(function (snap) {
          console.log('[AuthGuard] Snapshot. empty=' + snap.empty);
          if (snap.empty) { validate(null); return; }
          validate(snap.docs[0].data());
        }, function (err) {
          console.error('[AuthGuard] Listener error:', err);
        });

      console.log('[AuthGuard] ✓ Listener attached');
    } catch (e) {
      console.error('[AuthGuard] Attach failed:', e);
    }
  }

  if (window.firebaseReady) {
    attachListener();
  } else {
    window.addEventListener('firebase-ready', attachListener, { once: true });
    setTimeout(function () {
      if (window.firebaseReady) attachListener();
    }, 2000);
  }

  // Fallback check tiap 15 detik
  setInterval(function () {
    if (_loggingOut) return;
    if (!window.firebaseReady) return;
    firebase.firestore()
      .collection('users')
      .where('username', '==', me.username)
      .limit(1)
      .get()
      .then(function (snap) {
        if (snap.empty) validate(null);
        else validate(snap.docs[0].data());
      })
      .catch(function () {});
  }, 15000);

})();