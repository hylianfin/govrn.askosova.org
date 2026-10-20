// Lightweight mock Supabase client used only when env vars are missing,
// so the app renders in demo/empty mode instead of crashing.

function makeBuilder() {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: any) => resolve({ data: [], error: null, count: 0 });
      }
      if (prop === "data") return [];
      if (prop === "error") return null;
      return (..._args: any[]) => makeBuilder();
    },
  };
  return new Proxy({}, handler);
}

export function createMockClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: { message: "Supabase not configured" } }),
      signUp: async () => ({ error: { message: "Supabase not configured" } }),
    },
    from: (..._args: any[]) => makeBuilder(),
    rpc: (..._args: any[]) => makeBuilder(),
    storage: { from: (..._args: any[]) => makeBuilder() },
  } as any;
}