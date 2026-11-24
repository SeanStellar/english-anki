(function () {
  var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!native) return;

  var plugins = window.Capacitor.Plugins || {};
  var screenOrientation = plugins.ScreenOrientation;
  var appPlugin = plugins.App;

  if (screenOrientation) {
    var locked = false;
    var pending = false;

    var syncOrientation = function () {
      var study = document.body.classList.contains('study-mode');
      if (study === locked || pending) return;
      pending = true;
      var target = study ? 'landscape' : 'portrait';
      screenOrientation.lock({ orientation: target }).then(function () {
        locked = study;
        pending = false;
      }).catch(function () {
        pending = false;
      });
    };

    new MutationObserver(syncOrientation).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    syncOrientation();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest('#speakBtn') : null;
    if (!button) return;
    event.stopPropagation();
    var wordEl = document.querySelector('#wordText');
    var word = wordEl && wordEl.textContent ? wordEl.textContent.trim() : '';
    if (word && typeof window.speak === 'function') window.speak(word);
  }, true);

  if (!('SpeechSynthesisUtterance' in window)) {
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text || '';
      this.lang = 'en-US';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    };
  }

  if (!('speechSynthesis' in window)) {
    var ttsPlugin = plugins.TextToSpeech;
    window.speechSynthesis = {
      getVoices: function () { return []; },
      cancel: function () {},
      speak: function (utterance) {
        var text = String((utterance && utterance.text) || '');
        var done = function () { try { utterance.onend && utterance.onend(); } catch (error) {} };
        if (!text) return done();
        try { utterance.onstart && utterance.onstart(); } catch (error) {}
        if (!ttsPlugin) return done();
        ttsPlugin.speak({
          text: text,
          lang: 'en-US',
          rate: Math.min(1.5, Math.max(0.4, Number(utterance && utterance.rate) || 0.85)),
          pitch: 1,
          volume: 1,
          category: 'playback'
        }).then(done).catch(function () {
          try { utterance.onerror && utterance.onerror({ error: 'tts-failed' }); } catch (error) {}
        });
      }
    };
  }

  if (appPlugin) {
    appPlugin.addListener('backButton', function () {
      var openModal = document.querySelector('.modal-backdrop.open');
      if (openModal) {
        var close = openModal.querySelector('.modal-close');
        if (close) close.click();
        return;
      }
      if (document.body.classList.contains('study-mode')) {
        var exit = document.querySelector('#exitStudyBtn');
        if (exit) {
          exit.click();
          return;
        }
      }
      appPlugin.exitApp();
    });
  }
})();