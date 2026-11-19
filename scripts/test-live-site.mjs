import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const site = process.env.SITE_URL || 'https://shubin.co';
const routes = [
  {path:'/',lang:'en',kind:'home',expected:'I build businesses from scratch'},
  {path:'/ru/',lang:'ru',kind:'home',expected:'Создаю бизнесы с нуля'},
  {path:'/simula/',lang:'en',kind:'simula',expected:'Simula: Crisis communications training simulator'},
  {path:'/ru/simula/',lang:'ru',kind:'simula',expected:'Simula: тренажёр кризисных коммуникаций'}
];
fs.mkdirSync('site-audit',{recursive:true});
const exe = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox']});
const observations=[];
let failed = false;
for (const route of routes) {
  for(const width of [375,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
    const page=await context.newPage();
    const errors=[];
    const badResponses=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error' && !/youtube|google|analytics|play\.google/i.test(m.text()))errors.push(m.text())});
    page.on('response',r=>{if(r.status()>=400 && r.url().startsWith(site))badResponses.push(r.url()+': '+r.status())});
    const result={route:route.path,width,errors,badResponses,checks:{}};
    try {
      const response=await page.goto(site+route.path,{waitUntil:'domcontentloaded',timeout:25000});
      result.checks.status=response?.status();
      if(route.kind==='home'){
        await page.locator('#profile-intro').getByText(route.expected,{exact:false}).waitFor({timeout:15000});
        const body=await page.locator('#profile-about-copy').innerText();
        result.checks.about=body.length;
        result.checks.copy=body.slice(0,130);
        const data=await page.request.get(site+'/content/'+route.lang+'.json');
        result.checks.jsonStatus=data.status();
        const doc=await data.json();
        result.checks.jsonSame=await page.locator('#profile-intro').innerText()===doc.intro;
        result.checks.contactLinks=await page.locator('a[href="/contact/email/"]').count();
      } else {
        await page.locator('.simula-hero h1').getByText(route.expected,{exact:false}).waitFor({timeout:15000});
        result.checks.title=await page.locator('h1').innerText();
        result.checks.mainVisible=await page.locator('.simula-hero').isVisible();
        result.checks.roleVisible=await page.locator('.simula-contribution').isVisible();
        result.checks.awards=await page.locator('.simula-award').count();
        result.checks.sourceLinks=await page.locator('.simula-sources a').count();
        const caseCopy=await page.request.get(site+'/content/simula.'+route.lang+'.json');
        result.checks.caseJsonStatus=caseCopy.status();
        result.checks.caseJsonSame=(await page.locator('h1').innerText())===(await caseCopy.json()).text['.simula-hero h1'];
        result.checks.cta=await page.locator('.simula-cta h2').innerText();
      }
      result.checks.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      result.checks.canvas=await page.evaluate(()=>{const c=document.querySelector('#ascii');return {width:c?.width,height:c?.height,display:c?getComputedStyle(c).display:'missing'};});
      if(width===1440){
        await page.mouse.move(6,6);
        await page.mouse.down();
        await page.waitForTimeout(750);
        await page.mouse.up();
        await page.waitForTimeout(2500);
        result.checks.backgroundPixels=await page.evaluate(()=>{
          const c=document.querySelector('#ascii');
          if(!c)return -1;
          const ctx=c.getContext('2d');
          const data=ctx.getImageData(0,0,c.width,c.height).data;
          let lit=0;
          for(let i=0;i<data.length;i+=160){if(data[i+1]>data[i]+30 && data[i+1]>data[i+2]+4)lit++;}
          return lit;
        });
      }
      await page.screenshot({path:path.join('site-audit',route.lang+'-'+route.kind+'-'+width+'.png'),fullPage:true,timeout:15000});
      result.ok=result.checks.status===200 && !result.checks.overflow &&
        result.checks.canvas?.width>0 && result.checks.canvas?.height>0 &&
        errors.length===0 && badResponses.length===0 &&
        (route.kind==='home'?result.checks.jsonSame && result.checks.about>150 && result.checks.contactLinks>0:
         result.checks.mainVisible && result.checks.roleVisible && result.checks.caseJsonSame &&
         result.checks.awards>=3 && result.checks.sourceLinks>=4) &&
         (width!==1440 || result.checks.backgroundPixels>0);
    }catch(e){result.ok=false;result.failure=String(e)}
    observations.push(result);
    if(!result.ok)failed=true;
    console.log(JSON.stringify(result));
    await context.close();
  }
}
fs.writeFileSync('site-audit/results.json',JSON.stringify(observations,null,2));
await browser.close();
if(failed)process.exitCode=1;
