# shubin.co

Public source mirror of the bilingual static profile site: <https://shubin.co/>.

## Routes

- `index.html` — English (`/`)
- `ru/index.html` — Russian (`/ru/`)
- `profile.css` and `profile.js` — shared styles and interaction/animation
- `og-card*.png`, `favicon*`, and `yuri-shubin-avatar.webp` — social and browser images
- `yuri-shubin.vcf` — downloadable contact card
- `robots.txt`, `sitemap.xml`, and `llms.txt` — crawler/discovery files
- `CNAME` — intended GitHub Pages custom domain

The deliberately small, flat layout has no package manager, framework, or build step. `.nojekyll` keeps GitHub Pages from treating the repository as a Jekyll project.

## Publishing

GitHub Pages publishes the `main` branch root at <https://shubin.co/>. Keep `CNAME` set to `shubin.co`. The repository uses plain static files, no Jekyll processing or build step.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/>.
