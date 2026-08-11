do $$
begin
  if exists (select 1 from admin_accounts) then
    raise exception 'Refusing to remove authentication schema while an administrator account exists';
  end if;
  if exists (select 1 from admin_sessions) then
    raise exception 'Refusing to remove authentication schema while sessions exist';
  end if;
  if exists (
    select 1 from admin_login_guard
    where failed_attempts <> 0
       or window_started_at is not null
       or blocked_until is not null
  ) then
    raise exception 'Refusing to remove authentication schema while login guard state is not initial';
  end if;
end $$;

drop index if exists admin_sessions_absolute_expiry_idx;
drop index if exists admin_sessions_active_idle_expiry_idx;
drop index if exists admin_sessions_account_idx;
drop table admin_sessions;
drop table admin_login_guard;
drop table admin_accounts;
delete from schema_migrations where version = '0006_admin_console_authentication';
