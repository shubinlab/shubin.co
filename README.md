# shubin.co

Canonical public source and active custom-domain Pages site for Yuri Shubin: <https://shubin.co/>.

## Routes

- `index.html` — English (`/`)
- `ru/index.html` — Russian (`/ru/`)
- `simula/` and `ru/simula/` — source-backed project note in both languages, limited to claims in the dated 2022 publication
- `profile.css` and `profile.js` — shared profile styles and interaction/animation
- `bio.css` — scoped full-biography styling used directly on both homepages
- `work.css` — styles for source-backed project pages
- `analytics.js` — first-party GA4 event tracking; GA4 and the HubSpot tracking code load on profile, project, and privacy pages
- `contact/email/` and `contact/telegram/` — safe contact redirects used so analytics vendors never receive the full contact URL
- `og-card*.png`, `favicon*`, and `yuri-shubin-avatar.webp` — social and browser images
- `yuri-shubin.vcf` — downloadable contact card
- `k` — short terminal entry point for the Kinescope installer; keep it byte-for-byte in sync with `shubinlab/kinescope-download` release `v1.6.1` `install.sh`.
- `robots.txt`, `sitemap.xml`, and `llms.txt` — crawler/discovery files
- `CNAME` — custom-domain binding for GitHub Pages (`shubin.co`)

The deliberately small, flat layout has no package manager, framework, or build step. `.nojekyll` keeps GitHub Pages from treating the repository as a Jekyll project.

## Analytics and crawlers

- GA4 and HubSpot tracking load when a page opens. The site does not display an analytics/cookie choice dialog or store an analytics preference.
- HubSpot uses browser cookies to recognize visitors and record visited pages. The tracking code is installed on profile, project, and privacy pages; contact redirect pages are excluded.
- Email and Telegram clicks use the `contact_click` intent event. vCard clicks use `vcard_click`; opening the share sheet uses `contact_share_click`. The latter two are not key events. Events send fixed methods only, not addresses, message text, or clicked URLs.
- `robots.txt` allows OAI-SearchBot and Claude-SearchBot while disallowing GPTBot, ClaudeBot, CCBot, and Amazonbot. It sets the shared `__usage_ai-training` preference to Disallow. Google-Extended is an explicit exception: Gemini grounding and training are allowed. Google Search uses Googlebot, which is allowed by the wildcard group.
- Microsoft Clarity is not installed or active on this site.

## Publishing

GitHub Pages publishes the `main` branch root at <https://shubin.co/>. Keep `CNAME` set to `shubin.co`. The repository uses plain static files, no Jekyll processing or build step.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/>.

## Updating homepage content

The existing bilingual homepage cards, contact buttons, featured project and interactive
background remain in `index.html` (English) and `ru/index.html` (Russian).
The approved **full biography is displayed directly on each homepage** as semantic,
crawlable HTML. Its layout uses the existing visual system and the small, scoped
`bio.css` stylesheet. There are no separate `/about/` pages.

`content/en.json` and `content/ru.json` store short profile labels, the heading
subtitle, contact UI strings and metadata. The homepage biography itself is authored
in the two HTML files so visitors see it even when JavaScript or JSON requests fail.
For substantive text changes, update both language versions and the corresponding
intro/metadata in JSON and static HTML. The animation in `profile.js` must not
replace or erase the static biography.

## Simula case-study restoration

`simula/index.html` and `ru/simula/index.html` were restored together from
commit `71d9d43bec261e94974ffb5733a4ae57cb66e48e` (November 17, 2026),
before the November 19 changes. They retain the original layout, original copy,
images, awards, sources and citation links from that snapshot. The two pages
use the current shared animation script and stylesheet versions but do not load
`simula-copy.js` or depend on Simula JSON. Do not silently replace them with
alternate content or reintroduce the separate-copy layer.

## Verification

`scripts/test-live-site.mjs` checks both homepages and Simula versions at desktop
and mobile widths, including no-JavaScript/failed-JSON fallback for the full
biographies. GitHub Actions runs it after the updated files appear on Pages.
