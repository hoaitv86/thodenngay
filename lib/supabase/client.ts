import { createBrowserClient } from '@supabase/ssr';
import { DEMO_ACTION_BLOCK_MESSAGE, DEMO_SESSION_STORAGE_KEY } from '@/lib/demo-accounts';
import { forgetOfflineAuthenticatedUser, getOfflineAuthenticatedUser, rememberOfflineAuthenticatedUser } from '@/lib/offline/session';

const makeDemoError = () => ({
  name: "DemoReadonlyError",
  message: DEMO_ACTION_BLOCK_MESSAGE,
});

const makeBlockedMutation = () => {
  const result = { data: null, error: makeDemoError() };
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return Promise.resolve(result).then.bind(Promise.resolve(result));
        if (prop === "catch") return Promise.resolve(result).catch.bind(Promise.resolve(result));
        if (prop === "finally") return Promise.resolve(result).finally.bind(Promise.resolve(result));
        return () => proxy;
      },
    }
  );

  return proxy;
};

const isDemoSession = () =>
  typeof window !== "undefined" && window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY) === "true";

const withDemoReadonlyGuard = <T extends object>(client: T): T => {
  if (typeof window === "undefined") return client;

  return new Proxy(client, {
    get(target, prop, receiver) {
      const targetClient = target as any;
      if (prop === "auth") {
        return new Proxy(targetClient.auth, {
          get(authTarget, authProp, authReceiver) {
            if (authProp === "signInWithPassword") {
              return async (...args: unknown[]) => {
                window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
                const authMethod = Reflect.get(authTarget, authProp, authReceiver);
                const result = await authMethod.apply(authTarget, args);
                if (result?.data?.user) rememberOfflineAuthenticatedUser(result.data.user);
                return result;
              };
            }
            if (authProp === "signOut") {
              return async (...args: unknown[]) => {
                window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
                forgetOfflineAuthenticatedUser();
                const authMethod = Reflect.get(authTarget, authProp, authReceiver);
                return authMethod.apply(authTarget, args);
              };
            }
            if (authProp === "getUser") {
              return async (...args: unknown[]) => {
                const getUser = Reflect.get(authTarget, authProp, authReceiver);
                const result = await getUser.apply(authTarget, args);
                if (result?.data?.user) {
                  rememberOfflineAuthenticatedUser(result.data.user);
                  return result;
                }
                if (!window.navigator.onLine) {
                  const offlineUser = getOfflineAuthenticatedUser();
                  if (offlineUser) return { data: { user: offlineUser }, error: null };
                }
                return result;
              };
            }
            if (authProp === "getSession") {
              return async (...args: unknown[]) => {
                const getSession = Reflect.get(authTarget, authProp, authReceiver);
                const result = await getSession.apply(authTarget, args);
                if (result?.data?.session?.user) rememberOfflineAuthenticatedUser(result.data.session.user);
                return result;
              };
            }
            if (authProp === "updateUser") {
              return (...args: unknown[]) => {
                if (isDemoSession()) return Promise.resolve({ data: null, error: makeDemoError() });
                const updateUser = Reflect.get(authTarget, authProp, authReceiver);
                return updateUser.apply(authTarget, args);
              };
            }
            return Reflect.get(authTarget, authProp, authReceiver);
          },
        });
      }

      if (prop === "from") {
        return (table: string) => {
          const builder = targetClient.from(table);
          if (!isDemoSession()) return builder;

          return new Proxy(builder, {
            get(builderTarget, builderProp, builderReceiver) {
              if (["insert", "update", "upsert", "delete"].includes(String(builderProp))) {
                return () => makeBlockedMutation();
              }
              return Reflect.get(builderTarget, builderProp, builderReceiver);
            },
          });
        };
      }

      if (prop === "storage") {
        return new Proxy(targetClient.storage, {
          get(storageTarget, storageProp, storageReceiver) {
            if (storageProp === "from") {
              return (bucket: string) => {
                const storageBucket = targetClient.storage.from(bucket);
                if (!isDemoSession()) return storageBucket;

                return new Proxy(storageBucket, {
                  get(bucketTarget, bucketProp, bucketReceiver) {
                    if (["upload", "update", "remove"].includes(String(bucketProp))) {
                      return () => Promise.resolve({ data: null, error: makeDemoError() });
                    }
                    return Reflect.get(bucketTarget, bucketProp, bucketReceiver);
                  },
                });
              };
            }
            return Reflect.get(storageTarget, storageProp, storageReceiver);
          },
        });
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as T;
};

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 30,
      },
    }
  );

  return withDemoReadonlyGuard(client);
}
