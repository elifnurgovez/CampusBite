-- Dinamik su ve CO₂ metrikleri (Gemini analizi)
alter table public.scans
  add column if not exists water_liters double precision;

alter table public.scans
  add column if not exists co2_avoided double precision;
