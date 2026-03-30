-- Eski migrasyonda co2_grams oluşturulduysa: co2_avoided ekle ve veriyi taşı
alter table public.scans
  add column if not exists co2_avoided double precision;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scans'
      and column_name = 'co2_grams'
  ) then
    execute $sql$
      update public.scans
      set co2_avoided = co2_grams
      where co2_avoided is null and co2_grams is not null
    $sql$;
  end if;
end $$;
