
      // Utility: measure monospace character cell
      function measureCell(fontSizePx) {
        const span = document.createElement('span');
        span.textContent = 'M';
        span.style.fontFamily = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        span.style.fontSize = fontSizePx + 'px';
        span.style.lineHeight = '1.0';
        span.style.position = 'absolute';
        span.style.visibility = 'hidden';
        document.body.appendChild(span);
        const rect = span.getBoundingClientRect();
        span.remove();
        return { w: rect.width, h: rect.height };
      }

      // 4×4 Bayer matrix for ordered dithering (values centered around zero)
      const BAYER4 = new Float32Array([
        0,  8,  2, 10,
        12, 4, 14, 6,
        3, 11, 1,  9,
        15, 7, 13, 5,
      ].map(v => v / 16 - 0.5));


      // ASCII Renderer
      class AsciiRenderer {
        constructor(canvas) {
          this.el = canvas;
          this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
          this.fontSize = 12;
          this.cols = 0;
          this.rows = 0;
          this.cell = measureCell(this.fontSize);
          this.baseCellWidth = this.cell.w;
          this.field = new Float32Array(0);
          this.resize();
        }


        resize() {
          const W = window.innerWidth;
          const H = window.innerHeight;
          const targetCols = Math.max(40, Math.min(200, Math.floor(W / this.baseCellWidth)));
          const colWidth = W / targetCols;
          const scale = colWidth / this.baseCellWidth;
          const newFontSize = Math.max(8, Math.min(18, Math.floor(12 * scale)));
          this.fontSize = newFontSize;
          this.cell = measureCell(newFontSize);
          this.cols = Math.max(40, Math.min(240, Math.floor(W / this.cell.w)));
          this.rows = Math.max(20, Math.min(160, Math.floor(H / this.cell.h)));
          if (this.field.length !== this.cols * this.rows) {
            this.field = new Float32Array(this.cols * this.rows);
          }

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const canvasWidth = Math.round(W * dpr);
          const canvasHeight = Math.round(H * dpr);
          if (this.el.width !== canvasWidth) this.el.width = canvasWidth;
          if (this.el.height !== canvasHeight) this.el.height = canvasHeight;
          this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          this.ctx.font = `${newFontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
          this.ctx.textBaseline = 'top';
        }

        renderFromScalar(field, cols, rows, charset, color, options = {}) {
          const n = charset.length - 1;
          const contrast = options.contrast ?? 1;
          const bias = options.bias ?? 0;
          const gamma = options.gamma ?? 1;
          const invert = options.invert ?? false;
          const useDither = !!options.dither;
          const matrix = useDither ? BAYER4 : null;
          const ctx = this.ctx;
          const cell = this.cell;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
          ctx.fillStyle = color ?? '#d0f8d0';
          this.hasVisiblePixels = false;

          for (let y = 0; y < rows; y++) {
            const offset = y * cols;
            let line = '';
            for (let x = 0; x < cols; x++) {
              let v = field[offset + x] * contrast + bias;
              if (v < 0) v = 0;
              else if (v > 1) v = 1;
              if (gamma !== 1 && v > 0) v = Math.pow(v, gamma);
              const mapped = invert ? 1 - v : v;
              let idx;
              if (useDither) {
                idx = Math.floor(mapped * (n + 1) + matrix[((y & 3) << 2) + (x & 3)]);
                if (idx < 0) idx = 0;
                else if (idx > n) idx = n;
              } else {
                idx = Math.max(0, Math.min(n, Math.floor(mapped * n + 0.5)));
              }
              if (idx > 0) this.hasVisiblePixels = true;
              line += charset[idx];
            }
            ctx.fillText(line, 0, y * cell.h);
          }
        }
      }
      // Simple stable fluids solver (Stam 1999) adapted to non-square grid
      class Fluid {
        constructor(nx, ny, diffusion = 0.0001, viscosity = 0.0001, iterations = 10) {
          this.setSize(nx, ny);
          this.diff = diffusion;
          this.visc = viscosity;
          this.iter = iterations;
          this.dt = 1/60;
        }

        setSize(nx, ny) {
          this.nx = Math.max(8, nx|0);
          this.ny = Math.max(8, ny|0);
          const N = (this.nx + 2) * (this.ny + 2);
          this.s = new Float32Array(N); // temp/source
          this.d = new Float32Array(N); // density
          this.Vx = new Float32Array(N);
          this.Vy = new Float32Array(N);
          this.Vx0 = new Float32Array(N);
          this.Vy0 = new Float32Array(N);
        }

        IX(x, y) { return x + (this.nx + 2) * y; }

        addDensity(x, y, amount) {
          if (x < 1 || x > this.nx || y < 1 || y > this.ny) return;
          this.d[this.IX(x, y)] += amount;
        }
        addVelocity(x, y, amountX, amountY) {
          if (x < 1 || x > this.nx || y < 1 || y > this.ny) return;
          const i = this.IX(x, y);
          this.Vx[i] += amountX;
          this.Vy[i] += amountY;
        }

        step() {
          const N = this.nx, M = this.ny, dt = this.dt;
          // Velocity step
          this.diffuse(1, this.Vx0, this.Vx, this.visc, dt, N, M);
          this.diffuse(2, this.Vy0, this.Vy, this.visc, dt, N, M);
          this.project(this.Vx0, this.Vy0, this.Vx, this.Vy, N, M);
          this.advect(1, this.Vx, this.Vx0, this.Vx0, this.Vy0, dt, N, M);
          this.advect(2, this.Vy, this.Vy0, this.Vx0, this.Vy0, dt, N, M);
          this.project(this.Vx, this.Vy, this.Vx0, this.Vy0, N, M);
          // Density step
          this.diffuse(0, this.s, this.d, this.diff, dt, N, M);
          this.advect(0, this.d, this.s, this.Vx, this.Vy, dt, N, M);
        }

        set_bnd(b, x, N, M) {
          for (let i = 1; i <= N; i++) {
            x[this.IX(i, 0    )] = b === 2 ? -x[this.IX(i, 1    )] : x[this.IX(i, 1    )];
            x[this.IX(i, M + 1)] = b === 2 ? -x[this.IX(i, M    )] : x[this.IX(i, M    )];
          }
          for (let j = 1; j <= M; j++) {
            x[this.IX(0    , j)] = b === 1 ? -x[this.IX(1    , j)] : x[this.IX(1    , j)];
            x[this.IX(N + 1, j)] = b === 1 ? -x[this.IX(N    , j)] : x[this.IX(N    , j)];
          }
          x[this.IX(0    , 0    )] = 0.5 * (x[this.IX(1, 0    )] + x[this.IX(0    , 1)]);
          x[this.IX(0    , M + 1)] = 0.5 * (x[this.IX(1, M + 1)] + x[this.IX(0    , M)]);
          x[this.IX(N + 1, 0    )] = 0.5 * (x[this.IX(N, 0    )] + x[this.IX(N + 1, 1)]);
          x[this.IX(N + 1, M + 1)] = 0.5 * (x[this.IX(N, M + 1)] + x[this.IX(N + 1, M)]);
        }

        lin_solve(b, x, x0, a, c, N, M) {
          for (let k = 0; k < this.iter; k++) {
            for (let j = 1; j <= M; j++) {
              const joff = (N + 2) * j;
              for (let i = 1; i <= N; i++) {
                x[joff + i] = (x0[joff + i] + a * (
                  x[joff + i - 1] + x[joff + i + 1] +
                  x[joff - (N + 2) + i] + x[joff + (N + 2) + i]
                )) / c;
              }
            }
            this.set_bnd(b, x, N, M);
          }
        }

        diffuse(b, x, x0, diff, dt, N, M) {
          const a = dt * diff * N * M; // approximation for non-square grid
          this.lin_solve(b, x, x0, a, 1 + 4 * a, N, M);
        }

        advect(b, d, d0, velx, vely, dt, N, M) {
          const dt0x = dt * N;
          const dt0y = dt * M;
          for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
              let x = i - dt0x * velx[this.IX(i, j)];
              let y = j - dt0y * vely[this.IX(i, j)];

              if (x < 0.5) x = 0.5; if (x > N + 0.5) x = N + 0.5;
              if (y < 0.5) y = 0.5; if (y > M + 0.5) y = M + 0.5;
              const i0 = x | 0, i1 = i0 + 1;
              const j0 = y | 0, j1 = j0 + 1;
              const s1 = x - i0, s0 = 1 - s1;
              const t1 = y - j0, t0 = 1 - t1;
              d[this.IX(i, j)] =
                s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
                s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
            }
          }
          this.set_bnd(b, d, N, M);
        }

        project(velx, vely, p, div, N, M) {
          for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
              div[this.IX(i, j)] = -0.5 * (
                (velx[this.IX(i + 1, j)] - velx[this.IX(i - 1, j)]) / N +
                (vely[this.IX(i, j + 1)] - vely[this.IX(i, j - 1)]) / M
              );
              p[this.IX(i, j)] = 0;
            }
          }
          this.set_bnd(0, div, N, M);
          this.set_bnd(0, p, N, M);
          this.lin_solve(0, p, div, 1, 4, N, M);

          for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
              velx[this.IX(i, j)] -= 0.5 * N * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]);
              vely[this.IX(i, j)] -= 0.5 * M * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]);
            }
          }
          this.set_bnd(1, velx, N, M);
          this.set_bnd(2, vely, N, M);
        }
      }

      const DENSITY_CHARSET = ' .:-=+*#%@';
      // Tuning constants
      const DISSIPATION = 0.988;
      const AUTO_MOTION_DEPOSIT_SCALE = 0.045;
      const POINTER_DEPOSIT_SCALE = 0.12;
      const CLICK_BURST_DEPOSIT_SCALE = 0.12;
      const CLICK_BURST_DURATION = 2500;

      // Common input state
      const input = {
        down: false,
        x: 0, y: 0,
        px: 0, py: 0,
        strength: 50,
        headRadius: 1,
      };

      function attachPointer(el) {
        el.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.profile-card')) return;
          if (paused && reducedMotion.matches) return;
          if (e.pointerType === 'touch') {
            if (paused) return;
            autoMotion = [];
            autoMotionStart = null;
            clickBurst = { x: e.clientX, y: e.clientY, started: performance.now() };
            input.headRadius = 0.25;
            input.down = true;
            input.x = input.px = e.clientX;
            input.y = input.py = e.clientY;
            const previousStrength = input.strength;
            input.strength = 24;
            injectFromPointer(AUTO_MOTION_DEPOSIT_SCALE);
            input.strength = previousStrength;
            input.down = false;
            planAutoMotion(true, { x: e.clientX, y: e.clientY });
            scheduleFrame();
            return;
          }
          autoMotion = [];
          autoMotionStart = null;
          if (paused) {
            paused = false;
            syncMotionToggle();
          }
          input.headRadius = 0.25;
          clickBurst = { x: e.clientX, y: e.clientY, started: performance.now() };
          input.strength = 18;
          input.down = true;
          input.x = e.clientX;
          input.y = e.clientY;
          input.px = input.x;
          input.py = input.y;
          scheduleFrame();
        });
        window.addEventListener('pointerup', () => {
          if (!input.down) return;
          input.down = false;
          input.strength = 50;
          if (!paused) {
            planAutoMotion(true, { x: input.x, y: input.y });
            scheduleFrame();
          }
        });
        window.addEventListener('pointermove', (e) => {
          input.x = e.clientX;
          input.y = e.clientY;
        });
      }

      // Single effect definition
      const effect = {
        background: '#000',
        color: '#a5ff9f',
        update(t, dt) {
          const N = fluid.nx, M = fluid.ny;
          const cx = N * 0.5, cy = M * 0.5;
          for (let j = 2; j < M; j += 4) {
            for (let i = 2; i < N; i += 4) {
              const dx = i - cx, dy = j - cy;
              const inv = 1 / Math.max(1, Math.hypot(dx, dy));
              const fx = -dy * 0.05 * inv;
              const fy = dx * 0.05 * inv;
              fluid.addVelocity(i, j, fx, fy);
            }
          }
          for (let y = 1; y <= M; y++) {
            for (let x = 1; x <= N; x++) {
              const k = fluid.IX(x, y);
              fluid.d[k] *= DISSIPATION;
            }
          }
        },
        render() {
          const cols = renderer.cols, rows = renderer.rows;
          const gridWidth = fluid.nx, gridHeight = fluid.ny;
          const field = renderer.field;
          for (let y = 0; y < rows; y++) {
            const sy = Math.max(0, (y + 0.5) * gridHeight / rows - 0.5);
            const y0 = Math.min(gridHeight, Math.floor(sy) + 1);
            const y1 = Math.min(gridHeight, y0 + 1);
            const ty = sy - Math.floor(sy);
            for (let x = 0; x < cols; x++) {
              const sx = Math.max(0, (x + 0.5) * gridWidth / cols - 0.5);
              const x0 = Math.min(gridWidth, Math.floor(sx) + 1);
              const x1 = Math.min(gridWidth, x0 + 1);
              const tx = sx - Math.floor(sx);
              const top = fluid.d[fluid.IX(x0, y0)] * (1 - tx) + fluid.d[fluid.IX(x1, y0)] * tx;
              const bottom = fluid.d[fluid.IX(x0, y1)] * (1 - tx) + fluid.d[fluid.IX(x1, y1)] * tx;
              field[y * cols + x] = Math.max(0, Math.min(1, top * (1 - ty) + bottom * ty));
            }
          }
          renderer.renderFromScalar(field, cols, rows, DENSITY_CHARSET, this.color);
        },
      };

      const pre = document.getElementById('ascii');
      const renderer = new AsciiRenderer(pre);

      let fluid = new Fluid(Math.max(8, Math.ceil(renderer.cols / 2)), Math.max(8, Math.ceil(renderer.rows / 2)), 0.00005, 0.00005, 8);
      const appEl = document.getElementById('app');
      appEl.style.background = effect.background;
      attachPointer(appEl);


      function resizeAll() {
        const oldCols = renderer.cols, oldRows = renderer.rows;
        renderer.resize();
        if (oldCols !== renderer.cols || oldRows !== renderer.rows) {
          fluid.setSize(Math.max(8, Math.ceil(renderer.cols / 2)), Math.max(8, Math.ceil(renderer.rows / 2)));
        }
        planAutoMotion();
        scheduleFrame();
      }
      window.addEventListener('resize', () => resizeAll());


      function injectFromPointer(depositScale = 1) {
        if (!input.down) return;
        const gx = Math.floor((input.x / window.innerWidth) * fluid.nx) + 1;
        const gy = Math.floor((input.y / window.innerHeight) * fluid.ny) + 1;
        const pgx = Math.floor((input.px / window.innerWidth) * fluid.nx) + 1;
        const pgy = Math.floor((input.py / window.innerHeight) * fluid.ny) + 1;
        const velocityScale = renderer.cols / fluid.nx;
        const vx = (gx - pgx) * (input.strength / 40) * velocityScale;
        const vy = (gy - pgy) * (input.strength / 40) * velocityScale;
        const radius = Math.max(0.25, input.headRadius);
        const extent = Math.ceil(radius);
        for (let ry = -extent; ry <= extent; ry++) {
          for (let rx = -extent; rx <= extent; rx++) {
            const distance = Math.hypot(rx, ry);
            if (distance > radius + 0.5) continue;
            const x = gx + rx, y = gy + ry;
            const falloff = Math.max(0.12, 1 - 0.68 * distance / (radius + 0.5));
            const base = (rx === 0 && ry === 0 ? 0.5 : 0.2) * falloff;
            fluid.addDensity(x, y, input.strength * base * depositScale);
            fluid.addVelocity(x, y, vx * falloff, vy * falloff);
          }
        }
        input.px = input.x; input.py = input.y;
      }

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let paused = reducedMotion.matches;
      let last = performance.now();
      let animationFrameId = 0;
      const FRAME_INTERVAL_MS = 1000 / 30;
      let lastFrameAt = 0;
      let autoMotion = [];
      let autoMotionStart = null;
      let autoMotionHeadPhase = 0;
      let clickBurst = null;
      const motionToggle = document.getElementById('motion-toggle');

      let language = document.documentElement.lang.toLowerCase() === 'ru' ? 'ru' : 'en';
      const languageToggle = document.getElementById('language-toggle');
      const languageCopy = {
        en: {
          name: 'Yuri Shubin',
          photoAlt: 'Portrait of Yuri Shubin',
          actionsLabel: 'Contact actions',
          brand: 'Technology · AI Products',
          role: 'Technology entrepreneur',
          intro: 'Digitalization of complex manufacturing processes.',
          email: 'Email',
          telegram: 'Telegram',
          emailSubject: 'Inquiry from shubin.co',
          emailBody: 'Hi Yuri,\n\nI would like to discuss a possible collaboration.\n\nBest regards,',
          telegramDraft: 'Hi Yuri, I would like to discuss a project.',
          contact: 'Save contact',
          share: 'Share contact',
          selected: 'Selected product · Digital Atom',
          description: 'A scenario-based simulator for communications teams to practise media and crisis response.',
          proof: 'Publication · 2022 ↗',
          nav: 'Professional profiles',
          copied: 'Contact-card link copied.',
          noShare: 'Sharing is unavailable. Copy the contact-card link from the address bar.',
          shareFailed: 'Could not open sharing. Copy the contact-card link from the address bar.',
          title: 'Yuri Shubin — Technology & AI Products',
          descriptionMeta: 'Yuri Shubin — technology entrepreneur focused on digitalization of complex manufacturing processes. Selected work and contact details.',
          ogLocale: 'en_US',
          ogDescription: 'Technology entrepreneur focused on digitalization of complex manufacturing processes.',
          ogImageAlt: 'Portrait of Yuri Shubin — technology entrepreneur.',
          pageUrl: 'https://shubin.co/',
          ogImage: 'https://shubin.co/og-card.png?v=2',
          shareTitle: 'Yuri Shubin — contact card',
          shareText: 'Contact card for Yuri Shubin.',
        },
        ru: {
          brand: 'Технологии · ИИ продукты',
          name: 'Юрий Шубин',
          photoAlt: 'Портрет Юрия Шубина',
          actionsLabel: 'Контакты',
          role: 'Технологический предприниматель',
          intro: 'Цифровизация сложных производственных процессов.',
          email: 'Email',
          telegram: 'Telegram',
          emailSubject: 'Запрос о сотрудничестве — shubin.co',
          emailBody: 'Здравствуйте, Юрий!\n\nПредлагаю обсудить сотрудничество.\n\nС уважением,',
          telegramDraft: 'Здравствуйте, Юрий! Предлагаю обсудить проект.',
          contact: 'В контакты',
          share: 'Поделиться контактом',
          selected: 'Избранный продукт · Digital Atom',
          description: 'Симулятор для PR-команд: отработка работы с новостными и кризисными ситуациями.',
          proof: 'Публикация · 2022 ↗',
          nav: 'Профессиональные профили',
          copied: 'Ссылка на контактную карточку скопирована.',
          noShare: 'Поделиться не удалось. Скопируйте ссылку на контактную карточку.',
          shareFailed: 'Не удалось открыть меню «Поделиться». Скопируйте ссылку на контактную карточку.',
          title: 'Юрий Шубин — Технологии и ИИ продукты',
          descriptionMeta: 'Юрий Шубин — технологический предприниматель. Цифровизация сложных производственных процессов. Контакты и избранная работа.',
          ogLocale: 'ru_RU',
          ogDescription: 'Юрий Шубин — технологический предприниматель. Цифровизация сложных производственных процессов.',
          ogImageAlt: 'Портрет Юрия Шубина — технологический предприниматель.',
          pageUrl: 'https://shubin.co/ru/',
          ogImage: 'https://shubin.co/og-card-ru.png?v=1',
          shareTitle: 'Контактная карточка Юрия Шубина',
          shareText: 'Контакты Юрия Шубина.',
        },
      };
      function saveLanguageChoice(value) {
        try {
          window.localStorage.setItem('shubin-language-choice', value);
        } catch {}
      }

      function preferredBrowserLanguage() {
        const languages = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
        for (const tag of languages) {
          const languageTag = String(tag).toLowerCase().split(/[-_]/)[0];
          if (languageTag === 'ru' || languageTag === 'en') return languageTag;
        }
        return 'en';
      }

      function showLocaleSuggestion() {
        const suggestion = document.getElementById('locale-suggestion');
        if (!suggestion || language !== 'en' || window.location.pathname !== '/') return;
        let savedChoice = '';
        try {
          savedChoice = window.localStorage.getItem('shubin-language-choice') || '';
        } catch {}
        if (savedChoice === 'en') return;
        if (savedChoice !== 'ru' && preferredBrowserLanguage() !== 'ru') return;
        suggestion.hidden = false;
        document.getElementById('locale-suggestion-link').addEventListener(
          'click',
          () => saveLanguageChoice('ru'),
          { once: true },
        );
        document.getElementById('locale-suggestion-dismiss').addEventListener(
          'click',
          () => {
            saveLanguageChoice('en');
            suggestion.hidden = true;
          },
          { once: true },
        );
      }


      function syncMotionToggle(preview = false) {
        document.getElementById('motion-toggle-label').textContent = paused
          ? (language === 'ru' ? 'Включить анимацию' : 'Enable background animation')
          : (language === 'ru' ? 'Остановить анимацию' : 'Pause background animation');
        const showPlay = preview ? !paused : paused;
        document.getElementById('motion-pause-icon').hidden = showPlay;
        document.getElementById('motion-play-icon').hidden = !showPlay;
        motionToggle.setAttribute('aria-pressed', String(!paused));
      }

      function syncContactDrafts(copy) {
        const body = copy.emailBody.replace(/\n/g, '\r\n');
        document.getElementById('email-action').href =
          `mailto:hello@shubin.co?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(body)}`;
        document.getElementById('telegram-action').href =
          `https://t.me/shubin?text=${encodeURIComponent(copy.telegramDraft)}`;
      }

      function setLanguage(nextLanguage) {
        language = nextLanguage;
        document.documentElement.lang = language;
        const copy = languageCopy[language];
        const pageUrl = copy.pageUrl;
        const personDataElement = document.querySelector('script[type="application/ld+json"]');
        const personData = JSON.parse(personDataElement.textContent);
        personData.url = pageUrl;
        personData.jobTitle = copy.role;
        personData.description = copy.intro;
        personDataElement.textContent = JSON.stringify(personData);
        syncContactDrafts(copy);
        document.getElementById('brand-label').textContent = copy.brand;
        document.getElementById('profile-name').textContent = copy.name;
        document.getElementById('profile-photo').alt = copy.photoAlt;
        document.getElementById('profile-role').textContent = copy.role;
        document.getElementById('profile-intro').textContent = copy.intro;
        document.getElementById('contact-actions').setAttribute('aria-label', copy.actionsLabel);
        document.getElementById('email-action-label').textContent = copy.email;
        document.getElementById('telegram-action-label').textContent = copy.telegram;
        document.getElementById('contact-action-label').textContent = copy.contact;
        document.getElementById('share-contact-label').textContent = copy.share;
        document.getElementById('featured-label').textContent = copy.selected;
        document.getElementById('featured-description').textContent = copy.description;
        document.getElementById('proof-link').textContent = copy.proof;
        document.getElementById('profile-nav').setAttribute('aria-label', copy.nav);
        document.getElementById('language-code').textContent = language === 'en' ? 'RU' : 'EN';
        languageToggle.setAttribute('aria-label', language === 'en' ? 'Switch to Russian' : 'Переключить на английский');
        languageToggle.href = language === 'en' ? '/ru/' : '/';
        document.title = copy.title;
        document.querySelector('meta[name="description"]').content = copy.descriptionMeta;
        document.querySelector('meta[property="og:title"]').content = copy.title;
        document.querySelector('meta[property="og:description"]').content = copy.ogDescription;
        document.querySelector('meta[name="twitter:title"]').content = copy.title;
        document.querySelector('meta[name="twitter:description"]').content = copy.ogDescription;
        document.querySelector('link[rel="canonical"]').href = pageUrl;
        document.querySelector('meta[property="og:url"]').content = pageUrl;
        document.querySelector('meta[property="og:image"]').content = copy.ogImage;
        document.querySelector('meta[name="twitter:image"]').content = copy.ogImage;
        document.querySelector('meta[property="og:locale"]').content = copy.ogLocale;
        document.querySelector('meta[property="og:locale:alternate"]').content = language === 'en' ? 'ru_RU' : 'en_US';
        document.querySelector('meta[property="og:image:alt"]').content = copy.ogImageAlt;
        document.querySelector('meta[name="twitter:image:alt"]').content = copy.ogImageAlt;
        syncMotionToggle();
      }

      languageToggle.addEventListener('click', () => saveLanguageChoice(language === 'en' ? 'ru' : 'en'));

      function setMotionEnabled(enabled) {
        paused = !enabled;
        if (enabled) planAutoMotion(true);
        else {
          autoMotion = [];
          autoMotionStart = null;
          input.down = false;
          clickBurst = null;
        }
        syncMotionToggle();
        last = performance.now();
        scheduleFrame();
      }

      motionToggle.addEventListener('click', () => setMotionEnabled(paused));
      motionToggle.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'touch') syncMotionToggle(true);
      });
      motionToggle.addEventListener('pointerleave', () => syncMotionToggle());
      motionToggle.addEventListener('pointercancel', () => syncMotionToggle());
      reducedMotion.addEventListener('change', (event) => {
        if (event.matches) setMotionEnabled(false);
      });
      const shareContactButton = document.getElementById('share-contact');
      const shareStatus = document.getElementById('share-status');
      const contactCardUrl = 'https://shubin.co/yuri-shubin.vcf';
      shareContactButton.addEventListener('click', async () => {
        const copy = languageCopy[language];
        const data = {
          title: copy.shareTitle,
          text: copy.shareText,
          url: contactCardUrl,
        };
        shareStatus.textContent = '';
        try {
          if (navigator.share) {
            await navigator.share(data);
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(data.url);
            shareStatus.textContent = copy.copied;
          } else {
            shareStatus.textContent = copy.noShare;
          }
        } catch (error) {
          if (error.name !== 'AbortError') shareStatus.textContent = copy.shareFailed;
        }
      });

      function scheduleFrame() {
        if (!animationFrameId && !document.hidden && !paused) {
          animationFrameId = requestAnimationFrame(frame);
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = 0;
          return;
        }
        last = performance.now();
        scheduleFrame();
      });

      function planAutoMotion(force = false, startAt = null) {
        autoMotion = [];
        autoMotionStart = null;
        input.down = false;
        if ((paused || reducedMotion.matches) && !force) return;
        const rect = pre.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const originX = rect.left + rect.width * (Math.random() < 0.5 ? 0.06 : 0.94);
        const originY = rect.top + rect.height * (0.35 + Math.random() * 0.3);
        const edgeX = startAt ? Math.min(startAt.x - rect.left, rect.right - startAt.x) : rect.width * 0.5;
        const edgeY = startAt ? Math.min(startAt.y - rect.top, rect.bottom - startAt.y) : rect.height * 0.5;
        const scaleX = 0.65 + Math.random() * 0.45;
        const scaleY = 0.65 + Math.random() * 0.45;
        const radiusX = Math.min(rect.width * 0.36, Math.max(18, edgeX * 0.42)) * scaleX;
        const radiusY = Math.min(rect.height * 0.34, Math.max(18, edgeY * 0.42)) * scaleY;
        const pathStartX = startAt?.x ?? originX;
        const pathStartY = startAt?.y ?? originY;
        const phaseA = Math.random() * Math.PI * 2;
        const phaseB = Math.random() * Math.PI * 2;
        const phaseC = Math.random() * Math.PI * 2;
        const phaseD = Math.random() * Math.PI * 2;
        const phaseE = Math.random() * Math.PI * 2;
        const startX = 0.56 * Math.sin(phaseA) + 0.21 * Math.sin(phaseB) + 0.11 * Math.cos(phaseC) + 0.08 * Math.sin(phaseD) + 0.04 * Math.cos(phaseE);
        const startY = 0.60 * Math.cos(phaseB) + 0.20 * Math.sin(phaseA) + 0.10 * Math.cos(phaseC) + 0.06 * Math.sin(phaseD) + 0.04 * Math.cos(phaseE);
        autoMotionHeadPhase = Math.random() * Math.PI * 2;
        const steps = 60;
        for (let i = 0; i < steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const shapeX = 0.56 * Math.sin(theta + phaseA) + 0.21 * Math.sin(2 * theta + phaseB) + 0.11 * Math.cos(5 * theta + phaseC) + 0.08 * Math.sin(8 * theta + phaseD) + 0.04 * Math.cos(11 * theta + phaseE) - startX;
          const shapeY = 0.60 * Math.cos(theta + phaseB) + 0.20 * Math.sin(3 * theta + phaseA) + 0.10 * Math.cos(4 * theta + phaseC) + 0.06 * Math.sin(7 * theta + phaseD) + 0.04 * Math.cos(9 * theta + phaseE) - startY;
          const breatheX = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(2 * theta + phaseE));
          const breatheY = 0.74 + 0.26 * (0.5 + 0.5 * Math.cos(2 * theta + phaseD));
          autoMotion.push({
            x: Math.max(rect.left, Math.min(rect.right, pathStartX + radiusX * breatheX * shapeX)),
            y: Math.max(rect.top, Math.min(rect.bottom, pathStartY + radiusY * breatheY * shapeY)),
          });
        }
      }

      const AUTO_MOTION_STRENGTH = 6;
      const MOTION_STEP_MS = 500;


      function frame(t) {
        animationFrameId = 0;
        if (t - lastFrameAt < FRAME_INTERVAL_MS) {
          scheduleFrame();
          return;
        }
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        lastFrameAt = t;
        if (!paused) {
          if (autoMotion.length) {
            if (!autoMotionStart) {
              autoMotionStart = t;
              input.x = autoMotion[0].x;
              input.y = autoMotion[0].y;
              input.px = input.x;
              input.py = input.y;
            }
            let elapsed = t - autoMotionStart;
            const cycleDuration = autoMotion.length * MOTION_STEP_MS;
            if (elapsed >= cycleDuration) {
              const startAt = { x: input.x, y: input.y };
              planAutoMotion(true, startAt);
              autoMotionStart = t;
              elapsed = 0;
            }
            const cursor = elapsed / MOTION_STEP_MS;
            const index = Math.floor(cursor) % autoMotion.length;
            const fraction = cursor - Math.floor(cursor);
            const segment = autoMotion[index];
            const next = autoMotion[(index + 1) % autoMotion.length];
            input.down = true;
            input.px = input.x;
            input.py = input.y;
            input.x = segment.x + (next.x - segment.x) * fraction;
            input.y = segment.y + (next.y - segment.y) * fraction;
            const headPulse = 0.5 + 0.5 * Math.sin((elapsed / cycleDuration) * Math.PI * 2 + autoMotionHeadPhase);
            input.headRadius = 1.2 + 2.8 * headPulse;
            const prevStrength = input.strength;
            input.strength = AUTO_MOTION_STRENGTH;
            injectFromPointer(AUTO_MOTION_DEPOSIT_SCALE);
            input.strength = prevStrength;
          } else if (input.down) {
            injectFromPointer(POINTER_DEPOSIT_SCALE);
          }
          if (clickBurst) {
            const age = t - clickBurst.started;
            const progress = Math.min(1, age / CLICK_BURST_DURATION);
            const savedDown = input.down;
            const savedX = input.x, savedY = input.y;
            const savedPX = input.px, savedPY = input.py;
            const savedStrength = input.strength, savedRadius = input.headRadius;
            input.down = true;
            input.x = input.px = clickBurst.x;
            input.y = input.py = clickBurst.y;
            input.strength = 18;
            input.headRadius = 0.25 + 2.6 * progress;
            injectFromPointer(CLICK_BURST_DEPOSIT_SCALE);
            input.down = savedDown;
            input.x = savedX; input.y = savedY;
            input.px = savedPX; input.py = savedPY;
            input.strength = savedStrength; input.headRadius = savedRadius;
            if (progress >= 1) clickBurst = null;
          }
          effect.update(t / 1000, dt);
          fluid.step();
          effect.render();
        }
        const active = autoMotion.length > 0 || input.down || clickBurst !== null || renderer.hasVisiblePixels;
        if (!active) {
          fluid.d.fill(0);
          fluid.Vx.fill(0);
          fluid.Vy.fill(0);
        }
        if (active) scheduleFrame();
      }

      setLanguage(language);
      showLocaleSuggestion();
      resizeAll();
    