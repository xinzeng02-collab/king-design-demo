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

  async function restoreLogin() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (!user) return null;
    const { data: profile, error: profileError } = await client
      .from("profiles").select("id, role, display_name").eq("id", user.id).single();
    if (profileError) throw profileError;
    return { user, profile };
  }

  async function listWorks() {
    const { data, error } = await client.from("works")
      .select("*, owner_profile:profiles!works_owner_id_fkey(role, display_name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function getWork(id) {
    const { data, error } = await client.from("works")
      .select("*, owner_profile:profiles!works_owner_id_fkey(role, display_name)")
      .eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function updateWork(id, patch) {
    const { data, error } = await client.from("works")
      .update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteWork(id, storageKey) {
    const { error } = await client.from("works").delete().eq("id", id);
    if (error) throw error;
    if (storageKey) {
      const { error: storageError } = await client.storage.from("artworks").remove([storageKey]);
      if (storageError) throw storageError;
    }
  }

  async function uploadWork({ title, file, onCreated }) {
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new Error("请先登录云端账号");
    const { data: work, error: createError } = await client.from("works")
      .insert({ owner_id: user.id, title, status: "uploading" }).select().single();
    if (createError) throw createError;
    // Let the UI and other clients show the task immediately. The binary
    // upload continues after this database event.
    try { await onCreated?.(work); } catch (previewError) { console.warn("cloud upload placeholder render failed", previewError); }
    const safeName = String(file.name || "artwork").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${user.id}/${work.id}/${safeName}`;
    const { error: uploadError } = await client.storage.from("artworks").upload(storageKey, file, { upsert: false });
    if (uploadError) {
      await client.from("works").update({ status: "failed", storage_key: null }).eq("id", work.id);
      throw uploadError;
    }
    const { data: ready, error: updateError } = await client.from("works")
      .update({
        status: "ready",
        storage_key: storageKey,
        file_name: file.name || safeName,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }).eq("id", work.id).select().single();
    if (updateError) {
      await client.storage.from("artworks").remove([storageKey]).catch(() => {});
      await client.from("works").update({ status: "failed", storage_key: null }).eq("id", work.id).catch(() => {});
      throw updateError;
    }
    return ready;
  }

  async function createPreviewUrl(storageKey) {
    if (!storageKey) return "";
    const { data, error } = await client.storage.from("artworks").createSignedUrl(storageKey, 600);
    if (error) throw error;
    return data.signedUrl;
  }

  function subscribeWorks(handler, statusHandler) {
    return client.channel("works-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "works" }, handler)
      .subscribe((status, error) => statusHandler?.(status, error));
  }

  window.KingCloud = { client, login, restoreLogin, listWorks, getWork, updateWork, deleteWork, uploadWork, createPreviewUrl, subscribeWorks };
})();
