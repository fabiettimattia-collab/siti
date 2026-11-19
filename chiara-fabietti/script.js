const translations = {
  skip:'Skip to content', brandRole:'Oenologist · Winemaker',navStory:'The journey',navNotebook:'Cellar notes',navContact:'Let’s meet <span aria-hidden="true">↗</span>',menu:'Menu',
  heroEyebrow:'Italy → South Africa',heroTitle:'Every place<br>has a <em>voice.</em>',heroIntro:'Chiara Fabietti. Italian winemaker, now at Ayama, in the heart of the Voor Paardeberg.',heroCta:'Discover the journey',heroFooter:'Italian roots.<br>South African horizons.',visualNote:'A story of wine, people and places',strip:'From vineyard to cellar. From Italy to the Cape.',stripEnd:'Curiosity is the common thread.',
  storyEyebrow:'01 / The journey',storyTitle:'Rooted in Italy.<br>Looking <em>outward.</em>',storyIntro:'Chiara’s career crosses different landscapes: Cesanese del Piglio, the historic varieties of southern Lazio, and the open horizons of the Western Cape. At its heart is the winemaker’s work: understanding grapes and nurturing their expression.',platter:'Ayama in the Platter’s guide ↗',italyPiglio:'Piglio · Lazio, Italy',giulianiText:'An Italian chapter in the home of Cesanese. WineNews names Chiara, alongside Paolo Peira, as winemaker for Marcella Giuliani’s Dives Riserva 2011.',italyItri:'Itri and Fondi · Lazio, Italy',cecubiText:'Exploring Abbuoto and its connection to its place of origin. An experience spanning vineyard, cellar and tastings, documented by the wine press during her years in Italy.',nowPlace:'Since 2021 · Voor Paardeberg, South Africa',ayamaJourney:'A new hemisphere, the same vocation. Chiara is Ayama’s winemaker, director and viticulturist, sharing the management of the estate with Giuseppe Di Benedetto.',
  ayamaEyebrow:'02 / A new horizon',ayamaTitle:'A different sky.<br>The same <em>passion.</em>',ayamaText:'At the foot of the Paardeberg, Ayama brings an Italian sensibility into conversation with South African soil. This is where Chiara works, between the vineyards, the cellar, and encounters around wine.',ayamaText2:'Vermentino is one of the stories that makes this place distinctive: a Mediterranean variety finding a new expression in the Western Cape.',ayamaLink:'Explore the Ayama estate',ayamaLocation:'Voor Paardeberg<br>Paarl, South Africa',ayamaRole:'Winemaking<br>Viticulture',
  notebookEyebrow:'03 / Notes from the cellar',notebookTitle:'Time changes<br>the <em>story.</em>',notebookSubtitle:'One vintage.<br>Two interpretations.',notebookText:'For Ayama’s first Vermentino MCC, Chiara chose to split the vintage into two batches: 12 and 18 months on the lees. The comparison was presented at the estate in June 2025.',months:'months',wine12Style:'3 g/l total sugar after dosage',wine12Text:'Ayama’s report describes citrus, white flowers and freshness: an expression of Vermentino’s varietal character.',wine18Style:'Pas dosé · no dosage',wine18Text:'Ayama’s report describes hazelnut, bread crust and greater complexity, alongside aromatic freshness.',notebookLink:'Read Ayama’s account',
  quote:'My working philosophy in winemaking is founded on the research of expression that hides in every grape variety.',quoteSource:'From the Italian Winemaker profile ↗',pressEyebrow:'04 / Stories, encounters, reading',pressTitle:'Wine is also<br>a <em>conversation.</em>',pressIntro:'Selected articles and events that tell the story of Chiara’s work, in Italy and South Africa.',press1:'Vermentino MCC: the launch at the estate',press2:'Carignan in South Africa: a contribution from the Cape',press3:'Ayama: from viticulture to the cellar',press4:'Abbuoto and its terroir of origin',press5:'Marcella Giuliani and Cesanese del Piglio',
  contactEyebrow:'A conversation can begin with a glass of wine.',contactTitle:'Let’s meet<br><em>at Ayama.</em>',contactText:'For tastings, estate visits and professional enquiries, Ayama’s official channels are the place to start.',contactCta:'Contact the estate',contactNote:'Links to Ayama’s business channels.',footerTag:'Italian roots. South African horizons.',credits:'Sources & credits',print:'Print the profile',backTop:'Back to top ↑',footerRole:'Professional profile'
};
const translatedElements = [...document.querySelectorAll('[data-i18n]')];
const italian = new Map(translatedElements.map(element => [element, element.innerHTML]));
function setLanguage(language, persist=true) {
  const lang=language==='en'?'en':'it';
  document.documentElement.lang=lang;
  for(const element of translatedElements) element.innerHTML=lang==='en' ? (translations[element.dataset.i18n] ?? italian.get(element)) : italian.get(element);
  document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===lang)));
  document.querySelectorAll('[data-alt-it]').forEach(img=>img.alt=img.dataset[lang==='it'?'altIt':'altEn']);
  document.querySelector('.nav').setAttribute('aria-label',lang==='it'?'Navigazione principale':'Main navigation');
  document.querySelector('.wine-tabs').setAttribute('aria-label',lang==='it'?'Affinamento sui lieviti':'Maturation on the lees');
  document.title=lang==='it'?'Chiara Fabietti — Enologa e winemaker':'Chiara Fabietti — Oenologist & winemaker';
  const description=lang==='it'?'Chiara Fabietti, enologa italiana e winemaker di Ayama in Sudafrica. Un percorso tra i vitigni del Lazio e il Voor Paardeberg.':'Chiara Fabietti, Italian winemaker at Ayama in South Africa. A journey from the vineyards of Lazio to the Voor Paardeberg.';
  document.querySelector('meta[name="description"]').content=description;
  if(persist)try{localStorage.setItem('chiara-language',lang)}catch{}
}
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
try{if(localStorage.getItem('chiara-language')==='en')setLanguage('en',false)}catch{}
const menuButton=document.querySelector('.menu-toggle');
const menu=document.querySelector('.nav');
function closeMenu(){menu.classList.remove('open');menuButton.setAttribute('aria-expanded','false')}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menu.classList.toggle('open',open)});
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.classList.contains('open')){closeMenu();menuButton.focus()}});
const wineTabs=[...document.querySelectorAll('[data-wine]')];
function selectWine(button){wineTabs.forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!selected})}
wineTabs.forEach((button,index)=>{button.addEventListener('click',()=>selectWine(button));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=wineTabs[(index+1)%wineTabs.length];if(event.key==='Home')next=wineTabs[0];if(event.key==='End')next=wineTabs.at(-1);if(next){event.preventDefault();selectWine(next);next.focus()}})});
document.querySelector('.print-button').addEventListener('click',()=>window.print());
