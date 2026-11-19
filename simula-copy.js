// Text is loaded from /content/simula.en.json or /content/simula.ru.json.
// This file never constructs HTML from JSON: textContent prevents injection.
// The HTML includes readable fallback text if JavaScript/JSON is unavailable.
(async function () {
  const lang = document.documentElement.lang.toLowerCase()==='ru'?'ru':'en';
  const response = await fetch('/content/simula.'+lang+'.json', {cache:'no-cache'});
  if (!response.ok) throw new Error('Simula copy HTTP '+response.status);
  const content = await response.json();
  if (!content || !content.text || typeof content.title!=='string') throw new Error('Invalid Simula copy');
  for (const [selector, value] of Object.entries(content.text)) {
    if (typeof value!=='string') throw new Error('Invalid Simula field: '+selector);
    const element = document.querySelector(selector);
    if (!element) throw new Error('Missing Simula content slot: '+selector);
    element.textContent = value;
  }
  document.title = content.title;
  const metadata = [
    ['meta[name="description"]',content.description],
    ['meta[property="og:title"]',content.ogTitle],
    ['meta[property="og:description"]',content.description],
    ['meta[name="twitter:title"]',content.ogTitle],
    ['meta[name="twitter:description"]',content.description],
  ];
  for (const [selector, value] of metadata) {
    const element = document.querySelector(selector);
    if (element) element.content = value;
  }
})().catch(error=>console.error('Unable to load Simula content:',error));
