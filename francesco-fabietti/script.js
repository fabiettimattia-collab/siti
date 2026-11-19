'use strict';

const languageButton = document.querySelector('.language');
const dialog = document.querySelector('#site-dialog');
const infoButton = document.querySelector('.site-info');
const closeButton = document.querySelector('.dialog-close');
let language = 'it';

languageButton.addEventListener('click', () => {
  language = language === 'it' ? 'en' : 'it';
  document.documentElement.lang = language;
  document.querySelectorAll('[data-it][data-en]').forEach((element) => {
    element.textContent = element.dataset[language];
  });
  languageButton.textContent = language === 'it' ? 'EN' : 'IT';
  languageButton.setAttribute('aria-label', language === 'it' ? 'Switch to English' : 'Passa all’italiano');
  languageButton.setAttribute('aria-pressed', String(language === 'en'));
  document.querySelector('nav').setAttribute('aria-label', language === 'it' ? 'Navigazione principale' : 'Main navigation');
});

infoButton.addEventListener('click', () => dialog.showModal());
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});
dialog.addEventListener('close', () => infoButton.focus());
