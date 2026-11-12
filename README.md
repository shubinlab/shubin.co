# shubin.co

Canonical public source and active custom-domain Pages site for Yuri Shubin: <https://shubin.co/>.

## Routes

- `index.html` — English (`/`)
- `ru/index.html` — Russian (`/ru/`)
- `work/digital-atom-simula/` and `ru/work/digital-atom-simula/` — source-backed project note in both languages, limited to claims in the dated 2022 publication
- `profile.css` and `profile.js` — shared profile styles and interaction/animation
- `work.css` — styles for source-backed project pages
- `consent.css` and `consent.js` — first-party consent UI; GA4 loads only after analytics consent
- `contact/email/` and `contact/telegram/` — safe contact redirects used so analytics vendors never receive the full contact URL
- `og-card*.png`, `favicon*`, and `yuri-shubin-avatar.webp` — social and browser images
- `yuri-shubin.vcf` — downloadable contact card
- `k` — short terminal entry point for the Kinescope installer; keep it byte-for-byte in sync with `shubinlab/kinescope-download` release `v1.6.1` `install.sh`.
- `robots.txt`, `sitemap.xml`, and `llms.txt` — crawler/discovery files
- `CNAME` — custom-domain binding for GitHub Pages (`shubin.co`)

The deliberately small, flat layout has no package manager, framework, or build step. `.nojekyll` keeps GitHub Pages from treating the repository as a Jekyll project.

## Analytics and crawlers

- `consent.js` stores the visitor's choice in a first-party cookie scoped to `.shubin.co`; it does not load GA4 until analytics is accepted.
- Email and Telegram clicks use the `contact_click` intent event. vCard clicks use `vcard_click`; opening the share sheet uses `contact_share_click`. The latter two are not key events. Events send fixed methods only, not addresses, message text, or clicked URLs.
- `robots.txt` allows OAI-SearchBot and Claude-SearchBot while disallowing GPTBot, ClaudeBot, CCBot, and Amazonbot. Google-Extended is allowed for Gemini grounding and training. Google Search uses Googlebot, which is allowed by the wildcard group.
- Clarity stays inactive until a project is created and its consent mode is enabled.

## Publishing

GitHub Pages publishes the `main` branch root at <https://shubin.co/>. Keep `CNAME` set to `shubin.co`. The repository uses plain static files, no Jekyll processing or build step.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/>.
