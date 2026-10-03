-- ============================================================
-- Repos — Stockage des photos (à exécuter après schema.sql)
-- Crée le bucket public "assets" + politiques d'accès.
-- ============================================================

-- Bucket public pour les photos des établissements
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update set public = true;

-- Lecture publique des photos
drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read"
  on storage.objects for select
  using (bucket_id = 'assets');

-- Téléversement via la clé anon (initialisation).
-- À restreindre en production (ex. : uniquement les tenanciers
-- authentifiés via auth.uid()).
drop policy if exists "assets_anon_upload" on storage.objects;
create policy "assets_anon_upload"
  on storage.objects for insert
  with check (bucket_id = 'assets');
