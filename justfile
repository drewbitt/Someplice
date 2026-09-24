reset-db:
    pnpm run db:reset

db-migrate-single m="":
    pnpm run db:migrate:single -- {{m}}

insert-fake-data:
    pnpm run db:seed
