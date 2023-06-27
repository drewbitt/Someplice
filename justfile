reset-db:
        rm ./src/lib/db/db.sqlite
        pnpm run db:migrate
        pnpm run db:codegen

db-migrate-single m="":
    pnpm run db:migrate:single -- {{m}}

insert-fake-data:
    npx vite-node src/lib/db/insert-fake-data.ts