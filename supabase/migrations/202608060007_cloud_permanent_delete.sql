create policy "owners and admins can delete works"
on public.works for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

create policy "owners and admins can delete artwork files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'artworks'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
