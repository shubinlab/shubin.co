# shubin.co

Canonical public source and active custom-domain Pages site for Yuri Shubin: <https://shubin.co/>.

## Routes

- `index.html` — English (`/`)
- `ru/index.html` — Russian (`/ru/`)
- `simula/` and `ru/simula/` — source-backed project note in both languages, limited to claims in the dated 2022 publication
- `profile.css` and `profile.js` — shared profile styles and interaction/animation
- `work.css` — styles for source-backed project pages
- `analytics.js` — first-party GA4 event tracking; GA4 loads on every page view
- `contact/email/` and `contact/telegram/` — safe contact redirects used so analytics vendors never receive the full contact URL
- `og-card*.png`, `favicon*`, and `yuri-shubin-avatar.webp` — social and browser images
- `yuri-shubin.vcf` — downloadable contact card
- `k` — short terminal entry point for the Kinescope installer; keep it byte-for-byte in sync with `shubinlab/kinescope-download` release `v1.6.1` `install.sh`.
- `robots.txt`, `sitemap.xml`, and `llms.txt` — crawler/discovery files
- `CNAME` — custom-domain binding for GitHub Pages (`shubin.co`)

The deliberately small, flat layout has no package manager, framework, or build step. `.nojekyll` keeps GitHub Pages from treating the repository as a Jekyll project.

## Analytics and crawlers

- GA4 loads when a page opens. The site does not display an analytics choice dialog or store an analytics preference.
- Email and Telegram clicks use the `contact_click` intent event. vCard clicks use `vcard_click`; opening the share sheet uses `contact_share_click`. The latter two are not key events. Events send fixed methods only, not addresses, message text, or clicked URLs.
- `robots.txt` allows OAI-SearchBot and Claude-SearchBot while disallowing GPTBot, ClaudeBot, CCBot, and Amazonbot. It sets the shared `__usage_ai-training` preference to Disallow. Google-Extended is an explicit exception: Gemini grounding and training are allowed. Google Search uses Googlebot, which is allowed by the wildcard group.
- Microsoft Clarity is not installed or active on this site.

## Publishing

GitHub Pages publishes the `main` branch root at <https://shubin.co/>. Keep `CNAME` set to `shubin.co`. The repository uses plain static files, no Jekyll processing or build step.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/>.

## Updating homepage text

The design and markup remain in `index.html` and `ru/index.html`, styles in `profile.css`, and behavior/animation in `profile.js`. All homepage text used by the JavaScript is stored separately:

- `content/en.json` — English text
- `content/ru.json` — Russian text

To change any wording or button label, edit the relevant JSON file and commit it. GitHub Pages serves the updated text without changing markup, CSS, or JS. The page fetches JSON at runtime and uses `textContent` rather than injecting HTML.

The static HTML head retains stable crawlable title and social-preview text for crawlers that do not execute JavaScript. For major changes of positioning, also refresh these initial metadata values. Browser-rendered metadata and the JSON-LD description are updated automatically from JSON.

### Simula case study

The two Simula pages retain static HTML for SEO and JavaScript-disabled readers, while editable editorial text lives in `content/simula.en.json` and `content/simula.ru.json`. The standalone `simula-copy.js` reads these JSON files and updates the page using safe `textContent`. Existing historic quotes, awards, original images and citations remain in the case's HTML. A browser audit checks both languages at desktop and mobile sizes.

### Failure-resistant HTML fallback

The two homepages include a pre-rendered copy snapshot so that visitors without JavaScript (or with a temporary JSON fetch failure) still see the introduction and professional background. Normal visitors receive the current JSON text, which overrides the snapshot. The JSON files remain the place for routine edits. For major changes, refresh the HTML fallback and static social metadata as well. Browser tests exercise JavaScript-disabled and failed-JSON modes.
