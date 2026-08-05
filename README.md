# KiNG DESiGN public demo

This repository is a **public UI demonstration** for KiNG DESiGN. It contains no real client data, production artwork, PSD/source files, database, server configuration, payment QR codes, NAS credentials, or Green Shield integration.

## Open locally

Use any static web server, for example:

```bash
npx serve .
```

Then open the shown local address. Demo accounts are displayed on the login screen.

## Important limits

- This public repository is not the company production system.
- Demo state is stored only in the visitor's browser.
- No NAS, Green Shield, server file storage, database, HTTPS certificate, or real-time multi-user service is configured here.
- The planned production architecture is: browser -> HTTPS API -> database + server-controlled file storage.

For a real online collaborative preview, the next step is to connect a separate cloud demo backend (for example Supabase Auth, Postgres, Storage, and Realtime) with Row Level Security enabled. Do not add a service-role key to this repository.
