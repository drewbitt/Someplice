reset-db:
        if [ -f ./data/db.sqlite ]; then rm ./data/db.sqlite; fi
        pnpm run db:migrate
        pnpm run db:codegen


insert-fake-data:
    node src/lib/db/insert-fake-data.ts