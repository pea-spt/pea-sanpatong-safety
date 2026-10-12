# Project guidance

Build PEA Sanpatong Safety for San Pa Tong, hosted on GitHub Pages with Firebase services. Start with empty business data. Never copy Lamphun credentials, source, personnel, stock, photos, database URLs or upload tokens into this repository. Research files outside this folder are not deployment assets.

Protect all business data with Firebase Authentication and Database Rules. No localStorage fake administrator, default password or public write rules. Firebase public web config is allowed; private keys and passwords are not.

Preserve atomic inventory and ledger writes, nonnegative integer stock, stable person/item IDs and idempotent movement requests. Use server timestamps. Never subtract items sequentially in separate commits. Respect concurrent state in transaction callbacks. Keep rules and documentation synchronized with changes.

This is the initial admin-assisted workflow. Public QR, attachments, multiple roles and server-side immutable audit need explicit implementation, not hidden placeholders that pretend to work. Do not imply Firebase is connected until verified.

Use relative asset URLs to work under a GitHub Pages repository path. Keep Thai language and practical forms; UX/UI can be revised later. Run npm test and npm run check after domain changes; browser-check affected flows. Do not deploy personnel data, exported backups, tokens or research files.
