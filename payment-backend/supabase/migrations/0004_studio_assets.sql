-- 工作室稿件图片：私有桶，所有读取/写入均经过 Vercel API 的 service role。
insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', false)
on conflict (id) do update set public = false;

-- 不开放 anon/authenticated 直读，避免绕过组织权限读取稿件。
drop policy if exists studio_assets_public_read on storage.objects;
drop policy if exists studio_assets_public_write on storage.objects;
