import { vi } from "vitest";

export type SupabaseResponse = { data?: any; error?: any };

export type SupabaseMockOptions = {
  responses?: Record<string, Record<string, SupabaseResponse | SupabaseResponse[]>>;
  rpc?: Record<string, SupabaseResponse | SupabaseResponse[]>;
  auth?: {
    signInWithPassword?: SupabaseResponse;
    getUser?: SupabaseResponse;
    signOut?: SupabaseResponse;
    admin?: {
      createUser?: SupabaseResponse;
      deleteUser?: SupabaseResponse;
    };
  };
  storage?: {
    upload?: SupabaseResponse;
  };
};

export type SupabaseCall = {
  table?: string;
  action: string;
  payload?: any;
  filters?: { column: string; value: any }[];
  options?: any;
};

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const responses = options.responses || {};
  const rpcResponses = options.rpc || {};
  const calls: SupabaseCall[] = [];

  const responseQueues: Record<string, Record<string, SupabaseResponse[]>> = {};
  for (const [table, actions] of Object.entries(responses)) {
    responseQueues[table] = {};
    for (const [action, res] of Object.entries(actions)) {
      responseQueues[table][action] = Array.isArray(res) ? [...res] : [res];
    }
  }

  const rpcQueues: Record<string, SupabaseResponse[]> = {};
  for (const [fn, res] of Object.entries(rpcResponses)) {
    rpcQueues[fn] = Array.isArray(res) ? [...res] : [res];
  }

  function takeResponse(table: string, action: string): SupabaseResponse {
    const queue = responseQueues?.[table]?.[action];
    if (!queue || queue.length === 0) return { data: null, error: null };
    return queue.shift() || { data: null, error: null };
  }

  function takeRpc(fn: string): SupabaseResponse {
    const queue = rpcQueues?.[fn];
    if (!queue || queue.length === 0) return { data: null, error: null };
    return queue.shift() || { data: null, error: null };
  }

  function makeBuilder(table: string) {
    let action: string | undefined;
    let payload: any;
    let options: any;
    const filters: { column: string; value: any }[] = [];
    let resolved: SupabaseResponse | null = null;

    function resolve(): SupabaseResponse {
      if (resolved) return resolved;
      const act = action || "select";
      const response = takeResponse(table, act);
      calls.push({ table, action: act, payload, filters: [...filters], options });
      resolved = response;
      return response;
    }

    const builder = {
      select(_columns?: string) {
        if (!action) action = "select";
        return builder;
      },
      insert(data: any) {
        action = "insert";
        payload = data;
        return builder;
      },
      update(data: any) {
        action = "update";
        payload = data;
        return builder;
      },
      upsert(data: any, opts?: any) {
        action = "upsert";
        payload = data;
        options = opts;
        return builder;
      },
      delete() {
        action = "delete";
        return builder;
      },
      eq(column: string, value: any) {
        filters.push({ column, value });
        return builder;
      },
      order(_column: string, _opts?: any) {
        return builder;
      },
      single: async () => resolve(),
      maybeSingle: async () => resolve(),
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  const auth = {
    signInWithPassword: vi.fn(async () => options.auth?.signInWithPassword || { error: null }),
    getUser: vi.fn(async () => options.auth?.getUser || { data: { user: null } }),
    signOut: vi.fn(async () => options.auth?.signOut || { error: null }),
    admin: {
      createUser: vi.fn(async () => options.auth?.admin?.createUser || { data: { user: null }, error: null }),
      deleteUser: vi.fn(async () => options.auth?.admin?.deleteUser || { error: null }),
    },
  };

  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn(async () => options.storage?.upload || { error: null }),
    })),
  };

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn(async (fn: string, args?: any) => {
      const response = takeRpc(fn);
      calls.push({ action: "rpc", payload: { fn, args } });
      return response;
    }),
    auth,
    storage,
    __calls: calls,
  };

  return supabase;
}
