const it={
'hero.skip':'Salta intro',
'skip':'Vai ai contenuti','nav.story':'La nostra storia','nav.wines':'I nostri vini','nav.visit':'Vieni in fattoria','nav.stay':'Fermati da noi','book':'Vieni a trovarci',
'hero.eyebrow':'ANIMA SUDAFRICANA. CUORE ITALIANO.','hero.welcome':'UN BENVENUTO DAL LATO SELVAGGIO','hero.title':'Indole libera.<br>Fatto con<br><em>amore.</em>','hero.description':'Un piccolo angolo di Sudafrica. Un grande cuore italiano.','hero.cta':'Sentiti a casa','mascot.hint':'Abbassa gli occhiali. Segui la natura.','mascot.subhint':'TRASCINA, CLICCA O SCORRI','hero.scroll':'ESPLORA AYAMA','replay':'Ritrova il nostro leopardo',
'story.label':'01 / LE NOSTRE RADICI','story.side':'DUE PAESI. UN LUOGO DA CHIAMARE CASA.','story.title':'Lontano dall’ordinario.<br><em>Vicino alla terra.</em>','story.body':'Ai piedi del Paardeberg, la curiosità italiana incontra la terra sudafricana. Questa è Slent: una fattoria storica dove vino, buona cucina e amore per la natura riuniscono le persone.','story.history':'Abitato dal 1685, questo angolo del Capo ha una lunga storia. Siamo qui per condividerne il prossimo capitolo.','story.caption':'Un luogo in cui allungare la strada verso casa. ↗',
'wines.label':'02 / DAI NOSTRI VIGNETI','wines.all':'Esplora tutta la collezione','wines.title':'L’identità di un luogo.<br><em>In ogni calice.</em>','filter.all':'Tutti i vini','filter.white':'Bianchi','filter.red':'Rossi','wines.signature':'LA NOSTRA ANIMA ITALIANA','wine.white':'VINO BIANCO','wine.red':'VINO ROSSO','wine.vermentino.short':'Radici italiane. Una prima sudafricana.','wine.carignan.short':'Frutti scuri. Tannini fini. Carattere discreto.','wine.nero.short':'Spirito siciliano, a casa nel Capo.','wine.discover':'Scopri il vino','wine.origin':'Cresciuto con carattere. Fatto ad AYAMA.','wine.enquire':'Chiedi informazioni sul vino','wine.collection':'Visita la collezione ufficiale ↗',
'oil.label':'03 / ORO LIQUIDO','oil.title':'Dall’oliveto.<br><em>Con amore.</em>','oil.body':'Olive raccolte a mano. Spremute a freddo entro un’ora. Non filtrati e pieni di carattere, i nostri oli extravergini sono un’altra espressione della terra che chiamiamo casa.','oil.cta':'Scopri i nostri oli',
'visit.label':'04 / ACCOMODATI A TAVOLA','visit.side':'INSIEME, LA TAVOLA È PIÙ BELLA.','visit.title':'Vieni per un assaggio.<br><em>Resta per pranzo.</em>','visit.body':'Degustazioni senza fretta, cucina d’ispirazione italiana e una bottega piena di cose buone. C’è sempre un motivo per fermarsi un po’ di più ad AYAMA.','visit.tasting':'Degustazioni e pranzo','visit.shop':'Bottega e vendita vini','visit.days':'Aperto ogni giorno. La cucina chiude alle 15:00. Prenotazione consigliata. Da 8 persone: prenotare e confermare almeno 48 ore prima.','visit.cta':'Riserva un posto a tavola','visit.note':'la dolce vita,<br>edizione Cape.',
'stay.label':'05 / RALLENTA','stay.title':'Certi luoghi invitano<br>a <em>restare.</em>','stay.body':'Svegliati in campagna. Scegli la nostra Manor House del Settecento, oppure sentiti a casa nei cottage Artichoke e Harvest.','stay.cta':'Trova il tuo piccolo rifugio',
'events.label':'06 / UN’OCCASIONE SPECIALE','events.title':'Grandi momenti.<br><em>Una cornice speciale.</em>','events.body':'Da un matrimonio a un incontro con le persone che ami: scopri tre spazi in fattoria, ognuno con il proprio carattere. Vieni per una visita privata e trova il tuo.','events.cta':'Organizziamo qualcosa di speciale',
'footer.eyebrow':'LA TUA PROSSIMA DEVIAZIONE','footer.title':'Tutte le strade<br>portano all’<em>amore.</em>','footer.directions':'Trova la strada per arrivare','footer.tagline':'ORGOGLIOSAMENTE SUDAFRICANI. AUTENTICAMENTE ITALIANI.'
};
let lang='en';
function animateHeroWords(){
 const title=document.getElementById('hero-title');let index=0;
 function wrap(parent){[...parent.childNodes].forEach(node=>{if(node.nodeType===Node.TEXT_NODE){const fragment=document.createDocumentFragment();for(const part of node.textContent.split(/(\s+)/)){if(!part)continue;if(/^\s+$/.test(part)){fragment.append(document.createTextNode(part));continue}const span=document.createElement('span');span.className='hero-word';span.style.setProperty('--word-index',String(index++));span.textContent=part;fragment.append(span)}node.replaceWith(fragment)}else if(node.nodeType===Node.ELEMENT_NODE&&node.tagName!=='BR'&&!node.classList.contains('hero-word'))wrap(node)})}
 wrap(title);
}
const translatable=[...document.querySelectorAll('[data-i18n],[data-i18n-html]')];
const original=new Map(translatable.map(el=>[el,el.innerHTML]));
function setLanguage(next){
 lang=next;document.documentElement.lang=lang;
 translatable.forEach(el=>{const key=el.dataset.i18n||el.dataset.i18nHtml;if(lang==='it'&&it[key]){el.innerHTML=it[key]}else{el.innerHTML=original.get(el)}});
 const switcher=document.getElementById('language');switcher.textContent=lang==='en'?'IT':'EN';switcher.setAttribute('aria-label',lang==='en'?'Switch to Italian':'Passa all’inglese');
 document.querySelector('.menu-toggle').setAttribute('aria-label',lang==='it'?'Apri navigazione':'Open navigation');
 document.querySelector('.dialog-close').setAttribute('aria-label',lang==='it'?'Chiudi dettagli vino':'Close wine details');
 try{localStorage.setItem('ayama-language',lang)}catch{}
 if(dialog.open)populateWine(currentWine);
 window.dispatchEvent(new CustomEvent('ayama:language',{detail:{language:lang}}));
 animateHeroWords();
}
document.getElementById('language').addEventListener('click',()=>setLanguage(lang==='en'?'it':'en'));
const toggle=document.querySelector('.menu-toggle'),mobileNav=document.getElementById('mobile-nav');
function closeMenu(){mobileNav.hidden=true;toggle.setAttribute('aria-expanded','false')}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';mobileNav.hidden=open;toggle.setAttribute('aria-expanded',String(!open))});
mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});
 let count=0;document.querySelectorAll('.wine-card').forEach(card=>{card.hidden=filter!=='all'&&card.dataset.type!==filter;if(!card.hidden)count++});
 document.getElementById('filter-status').textContent=lang==='it'?`${count} ${count===1?'vino mostrato':'vini mostrati'}`:`${count} wines shown`;
}));
const wines={
 vermentino:{name:'Vermentino',type:'white',en:'South Africa’s first Vermentino carries an unmistakably Italian spirit. White flowers and hazelnut meet a silky texture and a fresh finish. A distinctive expression of the Voor Paardeberg.',it:'Il primo Vermentino del Sudafrica porta con sé un inconfondibile spirito italiano. Fiori bianchi e nocciola incontrano una consistenza setosa e un finale fresco: un’espressione particolare del Voor Paardeberg.'},
 carignan:{name:'Carignan',type:'red',en:'Dark cherries, blueberries and a floral touch, carried by fine tannins. Rooted in the Voor Paardeberg, this is a wine with depth, freshness and its own quietly confident character.',it:'Ciliegie scure, mirtilli e un tocco floreale, accompagnati da tannini fini. Radicato nel Voor Paardeberg, è un vino profondo e fresco, dal carattere discreto e sicuro.'},
 nero:{name:'Nero del Capo',type:'red',en:'Made entirely from Nero d’Avola, with raspberry, plum and cherry, a hint of herbs and a spicy finish. A meeting between a Sicilian grape and South African terroir.',it:'Da sole uve Nero d’Avola, con lampone, prugna e ciliegia, un accenno di erbe e un finale speziato. L’incontro tra un vitigno siciliano e il terroir sudafricano.'}
};
const dialog=document.getElementById('wine-dialog');let currentWine='vermentino';
function populateWine(id){const wine=wines[id];document.getElementById('wine-dialog-title').textContent=wine.name;document.getElementById('wine-dialog-type').textContent=lang==='it'?(wine.type==='white'?'VINO BIANCO':'VINO ROSSO'):(wine.type==='white'?'WHITE WINE':'RED WINE');document.getElementById('wine-dialog-description').textContent=wine[lang];dialog.querySelector('.button').href=`mailto:marketing@ayama.info?subject=${encodeURIComponent('AYAMA '+wine.name+' enquiry')}`}
document.querySelectorAll('[data-wine]').forEach(button=>button.addEventListener('click',()=>{currentWine=button.dataset.wine;populateWine(currentWine);dialog.showModal()}));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()});
const replay=document.getElementById('replay');
const hero=document.getElementById('home');
window.addEventListener('ayama:opening',()=>{hero.classList.add('is-opening')});
window.addEventListener('ayama:discover',()=>{hero.classList.add('is-opening','is-discovered');replay.hidden=false});
replay.addEventListener('click',()=>{window.ayamaMascot?.replay();hero.classList.remove('is-opening','is-discovered');replay.hidden=true;hero.scrollIntoView({block:'start',behavior:'instant'});window.dispatchEvent(new CustomEvent('ayama:replay'))});
document.getElementById('skip-intro').addEventListener('click',()=>{if(window.ayamaMascot?.skip)window.ayamaMascot.skip();else if(window.ayamaMascot)window.ayamaMascot.discover();else window.dispatchEvent(new CustomEvent('ayama:discover'))});
document.getElementById('year').textContent=new Date().getFullYear();
if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}})},{threshold:.08});document.querySelectorAll('.story-intro,.farm-panorama,.wine-card,.olive-copy,.visit-copy,.events').forEach(el=>{el.classList.add('reveal');observer.observe(el)})}
try{if(localStorage.getItem('ayama-language')==='it')setLanguage('it')}catch{}
animateHeroWords();
