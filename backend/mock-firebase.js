// In-memory mock database and auth for Firebase Admin SDK.
// Allows the PreçoFixo17 app to function fully in development / preview
// even when external Firebase Admin credentials have not been configured.

function createInMemoryStore() {
  const store = {
    users: {
      admin_default_uid: {
        uid: 'admin_default_uid',
        email: 'admin@uberclone.com',
        password: 'UberClone@2026!',
        name: 'Administrador',
        userType: 'admin',
        role: 'admin',
        isOnline: false,
        createdAt: new Date().toISOString(),
      },
      admin_precofixo_uid: {
        uid: 'admin_precofixo_uid',
        email: 'admin@precofixo17.com',
        password: 'Admin@2026!',
        name: 'Administrador PreçoFixo17',
        userType: 'admin',
        role: 'admin',
        isOnline: false,
        createdAt: new Date().toISOString(),
      },
      driver_sample_uid: {
        uid: 'driver_sample_uid',
        email: 'motorista@precofixo17.com',
        password: 'Driver@2026!',
        name: 'Carlos Santos',
        phone: '(67) 99999-1111',
        userType: 'driver',
        driverApprovalStatus: 'approved',
        isOnline: true,
        rating: 4.9,
        ratingAverage: 4.9,
        ratingCount: 15,
        currentLocation: { lat: -21.6149, lng: -55.1683, latitude: -21.6149, longitude: -55.1683 },
        driverProfile: {
          fullName: 'Carlos Santos',
          phone: '(67) 99999-1111',
          cpf: '123***89',
          driverLicense: '12***89',
          vehicle: { model: 'Toyota Corolla', color: 'Prata', licensePlate: 'BRA2E19', year: 2022 },
          address: { address: 'Rua Principal, 100', city: 'Maracaju', state: 'MS' },
        },
        createdAt: new Date().toISOString(),
      },
      passenger_sample_uid: {
        uid: 'passenger_sample_uid',
        email: 'passageiro@precofixo17.com',
        password: 'User@2026!',
        name: 'Mariana Oliveira',
        phone: '(67) 98888-2222',
        userType: 'passenger',
        rating: 5.0,
        totalRides: 2,
        isOnline: false,
        createdAt: new Date().toISOString(),
      },
    },
    locations: {
      driver_sample_uid: {
        latitude: -21.6149,
        longitude: -55.1683,
        lat: -21.6149,
        lng: -55.1683,
        timestamp: Date.now(),
      },
    },
    rides: {},
    driverApplications: {},
    driverNotifications: {},
    ratings: {},
    ratingClaims: {},
  };

  function clone(val) {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return JSON.parse(JSON.stringify(val));
  }

  function resolvePath(pathStr) {
    if (!pathStr || pathStr === '/') return [];
    return String(pathStr)
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);
  }

  function getIn(parts) {
    let curr = store;
    for (const part of parts) {
      if (curr === null || curr === undefined || typeof curr !== 'object') return undefined;
      curr = curr[part];
    }
    return clone(curr);
  }

  function setIn(parts, value) {
    if (parts.length === 0) return;
    let curr = store;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') {
        curr[p] = {};
      }
      curr = curr[p];
    }
    const last = parts[parts.length - 1];
    if (value === undefined || value === null) {
      delete curr[last];
    } else {
      let resolvedVal = value;
      if (typeof resolvedVal === 'object' && resolvedVal !== null) {
        resolvedVal = clone(resolvedVal);
        replaceServerValues(resolvedVal);
      }
      curr[last] = resolvedVal;
    }
  }

  function replaceServerValues(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && v['.sv'] === 'timestamp') {
        obj[k] = Date.now();
      } else if (v && typeof v === 'object') {
        replaceServerValues(v);
      }
    }
  }

  function updateIn(parts, patch) {
    if (!patch || typeof patch !== 'object') return;
    for (const [k, v] of Object.entries(patch)) {
      if (k.includes('/')) {
        const subParts = [...parts, ...resolvePath(k)];
        setIn(subParts, v);
      } else {
        const subParts = [...parts, k];
        setIn(subParts, v);
      }
    }
  }

  function removeIn(parts) {
    setIn(parts, null);
  }

  function createSnapshot(val, key = null) {
    return {
      key: key || (val && typeof val === 'object' && val.uid) || null,
      val: () => clone(val),
      exists: () => val !== null && val !== undefined,
      child: (childPath) => {
        if (!val || typeof val !== 'object') return createSnapshot(null, childPath);
        const subParts = resolvePath(childPath);
        let curr = val;
        for (const p of subParts) {
          if (curr === null || curr === undefined || typeof curr !== 'object') {
            curr = undefined;
            break;
          }
          curr = curr[p];
        }
        return createSnapshot(curr, subParts[subParts.length - 1] || null);
      },
      forEach: (callback) => {
        if (!val || typeof val !== 'object') return;
        for (const [k, v] of Object.entries(val)) {
          const stop = callback(createSnapshot(v, k));
          if (stop === true) break;
        }
      },
    };
  }

  function createRef(pathStr) {
    const parts = resolvePath(pathStr);
    const key = parts[parts.length - 1] || null;

    const ref = {
      key,
      path: parts.join('/'),
      child: (sub) => createRef(parts.concat(resolvePath(sub)).join('/')),
      get: async () => {
        const val = getIn(parts);
        return createSnapshot(val, key);
      },
      once: async (_evt) => {
        const val = getIn(parts);
        return createSnapshot(val, key);
      },
      set: async (value) => {
        setIn(parts, value);
        return true;
      },
      update: async (patch) => {
        updateIn(parts, patch);
        return true;
      },
      remove: async () => {
        removeIn(parts);
        return true;
      },
      push: (val) => {
        const pushKey = 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        const newRef = createRef(parts.concat(pushKey).join('/'));
        if (val !== undefined) {
          newRef.set(val);
        }
        return newRef;
      },
      transaction: async (updateFn) => {
        const current = getIn(parts);
        const next = updateFn(current);
        setIn(parts, next);
        return {
          committed: true,
          snapshot: createSnapshot(next, key),
        };
      },
      orderByChild: (childProp) => {
        return createQuery(parts, childProp);
      },
      limitToFirst: (limit) => {
        return createQuery(parts, null, null, limit);
      },
    };

    return ref;
  }

  function createQuery(parts, orderProp = null, equalVal = null, limit = null) {
    const query = {
      equalTo: (val) => createQuery(parts, orderProp, val, limit),
      limitToFirst: (n) => createQuery(parts, orderProp, equalVal, n),
      get: async () => {
        let val = getIn(parts);
        if (val && typeof val === 'object' && (equalVal !== null || orderProp !== null)) {
          const filtered = {};
          for (const [k, item] of Object.entries(val)) {
            if (item && typeof item === 'object') {
              if (equalVal !== null) {
                if (String(item[orderProp]) === String(equalVal)) {
                  filtered[k] = item;
                }
              } else {
                filtered[k] = item;
              }
            }
          }
          val = filtered;
        }
        if (limit && val && typeof val === 'object') {
          const limited = {};
          let count = 0;
          for (const [k, v] of Object.entries(val)) {
            if (count >= limit) break;
            limited[k] = v;
            count++;
          }
          val = limited;
        }
        return createSnapshot(val, parts[parts.length - 1] || null);
      },
      once: async () => query.get(),
    };
    return query;
  }

  const database = () => ({
    ref: (path) => createRef(path),
    app: () => ({ options: { databaseURL: 'in-memory://precofixo17' } }),
  });
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };

  const auth = () => ({
    getUserByEmail: async (email) => {
      const normalized = String(email || '').trim().toLowerCase();
      for (const u of Object.values(store.users)) {
        if (String(u.email || '').toLowerCase() === normalized) {
          return { uid: u.uid, email: u.email, displayName: u.name, disabled: Boolean(u.disabled), password: u.password };
        }
      }
      const err = new Error(`User not found: ${email}`);
      err.code = 'auth/user-not-found';
      throw err;
    },
    getUser: async (uid) => {
      const u = store.users[uid];
      if (!u) {
        const err = new Error(`User not found: ${uid}`);
        err.code = 'auth/user-not-found';
        throw err;
      }
      return { uid: u.uid, email: u.email, displayName: u.name, disabled: Boolean(u.disabled), password: u.password };
    },
    createUser: async ({ email, password, displayName }) => {
      const normalized = String(email || '').trim().toLowerCase();
      for (const u of Object.values(store.users)) {
        if (String(u.email || '').toLowerCase() === normalized) {
          const err = new Error('Email already registered');
          err.code = 'auth/email-already-exists';
          throw err;
        }
      }
      const uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const user = { uid, email: normalized, password, displayName: displayName || email.split('@')[0], disabled: false };
      store.users[uid] = user;
      return user;
    },
    updateUser: async (uid, patch) => {
      const u = store.users[uid];
      if (u) {
        Object.assign(u, patch);
      }
      return { uid, ...(u || patch) };
    },
    verifyIdToken: async (idToken) => {
      const tokenStr = String(idToken || '').trim();
      for (const u of Object.values(store.users)) {
        if (u.uid === tokenStr || u.email === tokenStr) {
          return { uid: u.uid, email: u.email, name: u.name || u.displayName };
        }
      }
      return { uid: tokenStr || 'dev_user_1', email: 'user@precofixo17.com', name: 'Usuário' };
    },
  });

  return { database, auth, store };
}

function setupFirebaseMock(admin) {
  if (admin.apps && admin.apps.length > 0 && admin.apps[0].options?.databaseURL !== 'in-memory://precofixo17') return;
  const mock = createInMemoryStore();
  const mockApp = {
    name: '[DEFAULT]',
    options: { databaseURL: 'in-memory://precofixo17' },
    database: mock.database,
    auth: mock.auth,
  };
  Object.defineProperty(admin, 'apps', { value: [mockApp], configurable: true, writable: true });
  Object.defineProperty(admin, 'app', { value: () => mockApp, configurable: true, writable: true });
  Object.defineProperty(admin, 'database', { value: mock.database, configurable: true, writable: true });
  Object.defineProperty(admin, 'auth', { value: mock.auth, configurable: true, writable: true });
  Object.defineProperty(admin, 'credential', { value: { cert: (obj) => obj }, configurable: true, writable: true });
  console.log('⚡ PreçoFixo17: Firebase Admin running with in-memory database and auth stub.');
}

module.exports = { setupFirebaseMock, createInMemoryStore };
