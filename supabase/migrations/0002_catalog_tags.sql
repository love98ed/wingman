-- Claude's product tags and try-on image picks, so a catalog refresh only pays for products
-- whose title, description or photos changed. Written by npm run catalog:fetch.

create table if not exists catalog_tags (
  product_id text primary key,                 -- `${store}-${shopifyProductId}`
  store text not null,
  source_hash text not null,                   -- sha256 of what the tagger reads; a change re-tags
  tag jsonb,                                   -- menswear, category, colour, formality, occasions
  image_checked boolean not null default false,
  image text,                                  -- chosen try-on image; null when none is usable
  image_colour text,                           -- colour seen in that image, wins over tag colour
  updated_at timestamptz not null default now()
);
create index if not exists catalog_tags_store_idx on catalog_tags (store);

alter table catalog_tags enable row level security;
