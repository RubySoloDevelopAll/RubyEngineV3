/* =========================================
   RubyEngine — Auth Module v3.0
   Firebase Firestore version
   All functions are now ASYNC (return Promise)
========================================= */
(function () {
  'use strict';

  var USERS_COL   = 'users';
  var SESSION_KEY = 're_session';
  var DAY_MS      = 86400000;

  /* =========================================
     HELPERS
  ========================================= */

  // Hash password pakai SHA-256
  async function hashPassword(password) {
    var buf = new TextEncoder().encode(String(password));
    var hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // Ambil Firestore instance
  function getDB() {
    if (!window.db) throw new Error('Firebase belum ready');
    return window.db;
  }

  // Lowercase username (untuk doc ID)
  function norm(username) {
    return String(username || '').trim().toLowerCase();
  }

  /* =========================================
     QUERY
  ========================================= */
  async function findUser(username) {
    var key = norm(username);
    if (!key) return null;
    try {
      var doc = await getDB().collection(USERS_COL).doc(key).get();
      if (!doc.exists) return null;
      var data = doc.data();
      data.id = doc.id;
      return data;
    } catch (e) {
      console.error('[Auth] findUser error:', e);
      return null;
    }
  }

  /* =========================================
     EXPIRY HELPERS
  ========================================= */
  function isPermanent(user) {
    return !user || user.expiresAt === 'permanent' || !user.expiresAt;
  }
  function isExpired(user) {
    if (!user) return false;
    if (isPermanent(user)) return false;
    return Date.now() > user.expiresAt;
  }
  function getRemainingMs(user) {
    if (isPermanent(user)) return Infinity;
    return Math.max(0, user.expiresAt - Date.now());
  }
  function getRemainingDays(user) {
    var ms = getRemainingMs(user);
    if (ms === Infinity) return Infinity;
    return Math.ceil(ms / DAY_MS);
  }
  function getExpiryLevel(user) {
    if (isPermanent(user)) return 'permanent';
    var ms = getRemainingMs(user);
    if (ms <= 0) return 'expired';
    var days = ms / DAY_MS;
    if (days >= 7) return 'safe';
    if (days >= 3) return 'warn';
    if (days >= 1) return 'danger';
    return 'critical';
  }

  /* =========================================
     LOGIN / LOGOUT / SESSION
  ========================================= */
  async function login(username, password) {
    var u = await findUser(username);
    if (!u) return { ok: false, reason: 'not_found' };
    if (!u.active) return { ok: false, reason: 'disabled' };
    if (isExpired(u)) return { ok: false, reason: 'expired' };

    var hashedInput = await hashPassword(password);
    if (u.password !== hashedInput) {
      return { ok: false, reason: 'wrong_password' };
    }

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        username: u.username,
        role: u.role,
        loginAt: Date.now()
      }));
    } catch (_) {}
    return { ok: true, user: u };
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function current() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function isAdmin() {
    var c = current();
    return !!(c && c.role === 'admin');
  }

  /* =========================================
     GUARDS
  ========================================= */
  function requireLogin(redirect) {
    var c = current();
    if (!c) { location.href = redirect || 'login.html'; return null; }
    return c;
  }
  function requireAdmin(redirect) {
    var c = current();
    if (!c || c.role !== 'admin') {
      location.href = redirect || 'login.html';
      return null;
    }
    return c;
  }

  /* =========================================
     CRUD USER
  ========================================= */
  async function addUser(username, password, role, durationDays) {
    username = String(username || '').trim();
    password = String(password || '').trim();
    role = role === 'admin' ? 'admin' : 'user';

    if (!username || !password) return { ok: false, reason: 'empty' };
    if (username.length < 3) return { ok: false, reason: 'short_username' };
    if (password.length < 4) return { ok: false, reason: 'short_password' };
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return { ok: false, reason: 'invalid_username' };

    var key = norm(username);
    var existing = await findUser(key);
    if (existing) return { ok: false, reason: 'exists' };

    var expiresAt;
    if (role === 'admin' || durationDays === 'permanent' || !durationDays || Number(durationDays) >= 9999) {
      expiresAt = 'permanent';
    } else {
      expiresAt = Date.now() + (Number(durationDays) * DAY_MS);
    }

    try {
      var hashed = await hashPassword(password);
      await getDB().collection(USERS_COL).doc(key).set({
        username: username,
        password: hashed,
        role: role,
        active: true,
        createdAt: Date.now(),
        expiresAt: expiresAt
      });
      return { ok: true };
    } catch (e) {
      console.error('[Auth] addUser error:', e);
      return { ok: false, reason: 'firebase_error' };
    }
  }

  async function updateUser(username, patch) {
    var key = norm(username);
    try {
      // Jika patch berisi password, hash dulu
      var out = Object.assign({}, patch);
      if (out.password) {
        out.password = await hashPassword(out.password);
      }
      await getDB().collection(USERS_COL).doc(key).update(out);
      return { ok: true };
    } catch (e) {
      console.error('[Auth] updateUser error:', e);
      return { ok: false, reason: 'firebase_error' };
    }
  }

  async function deleteUser(username) {
    var key = norm(username);
    try {
      var all = await getAllUsers();
      var admins = all.filter(function (u) {
        return u.role === 'admin' && u.active;
      });
      var target = all.filter(function (u) {
        return norm(u.username) === key;
      })[0];

      if (target && target.role === 'admin' && admins.length <= 1) {
        return { ok: false, reason: 'last_admin' };
      }

      await getDB().collection(USERS_COL).doc(key).delete();
      return { ok: true };
    } catch (e) {
      console.error('[Auth] deleteUser error:', e);
      return { ok: false, reason: 'firebase_error' };
    }
  }

  async function extendUser(username, days) {
    var key = norm(username);
    try {
      var u = await findUser(key);
      if (!u) return { ok: false, reason: 'not_found' };

      var now = Date.now();
      var newExp;

      if (days === 'permanent' || Number(days) >= 9999) {
        newExp = 'permanent';
      } else {
        var base = (u.expiresAt && u.expiresAt !== 'permanent' && u.expiresAt > now)
          ? u.expiresAt
          : now;
        newExp = base + (Number(days) * DAY_MS);
      }

      await getDB().collection(USERS_COL).doc(key).update({
        expiresAt: newExp,
        active: true
      });
      return { ok: true };
    } catch (e) {
      console.error('[Auth] extendUser error:', e);
      return { ok: false, reason: 'firebase_error' };
    }
  }

  async function resetExpiry(username, days) {
    var key = norm(username);
    try {
      var newExp;
      if (days === 'permanent' || Number(days) >= 9999) {
        newExp = 'permanent';
      } else {
        newExp = Date.now() + (Number(days) * DAY_MS);
      }
      await getDB().collection(USERS_COL).doc(key).update({
        expiresAt: newExp,
        active: true
      });
      return { ok: true };
    } catch (e) {
      console.error('[Auth] resetExpiry error:', e);
      return { ok: false, reason: 'firebase_error' };
    }
  }

  async function getAllUsers() {
    try {
      var snap = await getDB().collection(USERS_COL).get();
      var out = [];
      snap.forEach(function (doc) {
        var data = doc.data();
        data.id = doc.id;
        out.push(data);
      });
      return out;
    } catch (e) {
      console.error('[Auth] getAllUsers error:', e);
      return [];
    }
  }

  function genPassword(len) {
    len = len || 8;
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  /* =========================================
     EXPOSE
  ========================================= */
  window.Auth = {
    // Session
    login: login,
    logout: logout,
    current: current,
    isAdmin: isAdmin,
    requireLogin: requireLogin,
    requireAdmin: requireAdmin,
    // CRUD (all async)
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    extendUser: extendUser,
    resetExpiry: resetExpiry,
    getAllUsers: getAllUsers,
    findUser: findUser,
    genPassword: genPassword,
    // Helpers
    hashPassword: hashPassword,
    isExpired: isExpired,
    isPermanent: isPermanent,
    getRemainingMs: getRemainingMs,
    getRemainingDays: getRemainingDays,
    getExpiryLevel: getExpiryLevel
  };
})();