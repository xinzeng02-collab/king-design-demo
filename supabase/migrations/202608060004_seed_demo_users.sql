create or replace function public.seed_demo_user(
  account_email text,
  account_password text,
  account_role text,
  account_name text
) returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  account_id uuid;
begin
  select id into account_id from auth.users where email = account_email;
  if account_id is null then
    account_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', account_id,
      'authenticated', 'authenticated', account_email,
      crypt(account_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', account_name),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), account_id::text, account_id,
      jsonb_build_object('sub', account_id::text, 'email', account_email),
      'email', now(), now(), now()
    );
  end if;
  update public.profiles
  set role = account_role, display_name = account_name
  where id = account_id;
end;
$$;

select public.seed_demo_user('xinzeng02@gmail.com', 'admin123', 'admin', '管理员');
select public.seed_demo_user('xinzeng02+designer@gmail.com', 'designer123', 'designer', '设计师');
select public.seed_demo_user('xinzeng02+painter@gmail.com', 'painter123', 'painter', '手绘师');
select public.seed_demo_user('xinzeng02+sales@gmail.com', 'sales123', 'sales', '销售');

drop function public.seed_demo_user(text, text, text, text);
