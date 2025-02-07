# Website

FHFH website

## How to start the dev server

```bash
npm install
npm run dev
```

## How to generate types for your API and Supabase libraries

```bash
npx supabase login

npx supabase gen types typescript --project-id fyhftlxokyjtpndbkfse --schema public > ./lib/supabase/database-generated.types.ts
```
