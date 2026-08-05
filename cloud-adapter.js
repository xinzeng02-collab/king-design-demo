(() => {
  const config = window.KING_RELEASE_CONFIG?.supabase;
  if (!config?.url || !config?.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  async function login(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    let profile;
    let profileError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await client
        .from("profiles").select("id, role, display_name").eq("id", data.user.id).single();
      profile = result.data;
      profileError = result.error;
      if (!profileError) break;
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
    }
    if (profileError) throw profileError;
    return { user: data.user, profile };
  }

  async function signup(email, password, displayName) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    if (!data.user) throw new Error("注册未返回用户信息");
    // The database trigger creates the profile. Sign in once explicitly so
    // the caller always receives the same shape as a normal login.
    return login(email, password);
  }

  async function listWorks() {
    const { data, error } = await client.from("works").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function uploadWork({ title, file }) {
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new Error("请先登录云端账号");
    const { data: work, error: createError } = await client.from("works")
      .insert({ owner_id: user.id, title, status: "uploading" }).select().single();
    if (createError) throw createError;
    const safeName = String(file.name || "artwork").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${user.id}/${work.id}/${safeName}`;
    const { error: uploadError } = await client.storage.from("artworks").upload(storageKey, file, { upsert: false });
    if (uploadError) {
      await client.from("works").update({ status: "failed" }).eq("id", work.id);
      throw uploadError;
    }
    const { data: ready, error: updateError } = await client.from("works")
      .update({ status: "ready", storage_key: storageKey }).eq("id", work.id).select().single();
    if (updateError) throw updateError;
    return ready;
  }

  async function createPreviewUrl(storageKey) {
    if (!storageKey) return "";
    const { data, error } = await client.storage.from("artworks").createSignedUrl(storageKey, 600);
    if (error) throw error;
    return data.signedUrl;
  }

  function subscribeWorks(handler) {
    return client.channel("works-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "works" }, handler)
      .subscribe();
  }

  window.KingCloud = { client, login, signup, listWorks, uploadWork, createPreviewUrl, subscribeWorks };
})();
