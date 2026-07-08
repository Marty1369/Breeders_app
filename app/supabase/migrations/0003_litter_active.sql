-- Litter Planner — explicit active/inactive flag for litters.
-- "Current" litter (which one the LITTER-scoped UI focuses on) is a client-side
-- selection; "active" is a persisted status: many litters can be active at once,
-- and deactivating shelves a litter without closing it. Apply after 0002.

alter table litters add column is_active boolean not null default true;
