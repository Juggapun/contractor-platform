# Search page master — proposal A

2026-10-06. Review only, awaiting owner approval. Production UI unchanged.

Uses the approved navy/yellow brand, existing logo, mascot and social SVGs. Sample contractor names, locations, images, categories, counts and ratings are explicitly fictional design fixtures, not production results.

- Desktop 1440px: 3 card columns, filters in one row.
- Tablet 820px: 2 card columns, filters in two rows.
- Phone 390px: 1 card column, category/province side by side, keyword and search button full width.
- Checked 320px for overflow as well.
- Core existing behavior to retain when approved: category/province/keyword GET search, reset, result count, contractor details, pagination, no-results suggestions and error handling.
- New presentation affordances: selected-category chip, explicit profile/work link, and jump back to filters. These are static visual proposals in this file, not implemented functions.
- No new favorites, messaging, sorting, or identity-verification claims introduced.
- Empty/error/pagination states will use the same typography and surfaces; this master illustrates a populated single-page result.

Open index.html inside a repository checkout: it uses embedded fonts and relative links to existing approved assets. Buttons in this static review file are intentionally inert. Do not publish it as the search application. After approval, implement the layout in existing components, preserve query/SEO/data behavior, and verify relevant controls.
