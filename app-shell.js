(function(){
  'use strict';

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  if ('serviceWorker' in navigator) {
    var refreshingForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if (refreshingForUpdate) return;
      refreshingForUpdate = true;
      window.location.reload();
    });
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(function(registration){
        return registration.update();
      }).catch(function(err){
        console.warn('No s\'ha pogut activar el mode fora de línia:', err);
      });
    });
  }

  if (page !== 'index.html') {
    var nav = document.createElement('nav');
    nav.className = 'pwa-nav';
    nav.setAttribute('aria-label', 'Navegació de l\'aplicació');
    nav.innerHTML = '<a href="index.html">Inici</a><a href="mapa.html">Mapa</a><a href="guia.html">Guia</a>';
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function(link){
      if (link.getAttribute('href') === page) link.setAttribute('aria-current','page');
    });
    document.body.classList.add(page === 'mapa.html' ? 'pwa-map-page' : 'pwa-guide-page');
    document.body.appendChild(nav);
  }

  var installButton = document.getElementById('install-app');
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(event){
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  /* El navegador només dispara «beforeinstallprompt» quan pot instal·lar l'aplicació:
     no ho fa si ja està instal·lada ni en navegadors que no ho admeten (Firefox,
     Safari). Si el botó només aparegués en aquest cas, qui obre la portada des d'un
     altre navegador no veuria cap manera d'instal·lar-la, i el manual diu que hi és.
     Per això es mostra sempre, tret que l'aplicació ja s'estigui executant instal·lada. */
  var jaInstalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                    || window.navigator.standalone === true;
  if (installButton && !jaInstalada) installButton.hidden = false;

  if (installButton) {
    installButton.addEventListener('click', function(){
      if (!deferredPrompt) {
        installButton.textContent = 'Obre el menú del navegador i tria «Instal·la»';
        installButton.disabled = true;
        return;
      }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(){
        deferredPrompt = null;
        installButton.hidden = true;
      });
    });
  }
  window.addEventListener('appinstalled', function(){
    if (installButton) installButton.hidden = true;
  });

  var status = document.getElementById('connection-status');
  function actualitzaConnexio(){
    if (!status) return;
    status.textContent = navigator.onLine
      ? 'En línia · el mapa pot carregar les capes de fons'
      : 'Fora de línia · la guia i les dades locals continuen disponibles';
  }
  window.addEventListener('online', actualitzaConnexio);
  window.addEventListener('offline', actualitzaConnexio);
  actualitzaConnexio();
})();
