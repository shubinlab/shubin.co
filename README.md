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

The live custom-domain Pages source remains `shubinlab/shubin-co-pages` (`main` / root) to preserve its existing binding. This repository contains the clean public copy. Before moving the domain, update the Pages settings so `shubin.co` is assigned to only one repository.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/>.
