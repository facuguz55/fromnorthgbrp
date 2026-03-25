-- Tabla para cachear los mails de la bandeja de entrada
-- Ejecutar en Supabase → SQL Editor

create table if not exists mails_cache (
  id         integer primary key default 1,
  mails      jsonb        not null default '[]',
  updated_at timestamptz  not null default now(),
  -- Constraint para que solo exista 1 fila
  constraint mails_cache_single_row check (id = 1)
);

-- Insertar fila inicial vacía si no existe
insert into mails_cache (id, mails, updated_at)
values (1, '[]', now())
on conflict (id) do nothing;

-- Habilitar RLS y permitir lectura/escritura anónima
alter table mails_cache enable row level security;

create policy "anon read"  on mails_cache for select using (true);
create policy "anon write" on mails_cache for update using (true);
