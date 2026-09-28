/* ZacharTeam: datownik (dzisiejsza data i godziny otwarcia) oraz ruch przy przewijaniu.
   Bez bibliotek i bez zapytań sieciowych. Strona działa w pełni także bez tego pliku. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motion = !reduce && 'IntersectionObserver' in window;
  if (motion) root.classList.add('motion');

  /* ---------- datownik ---------- */
  var OPEN = 8 * 60 + 30;
  var CLOSE = 17 * 60;
  var DAY = 86400000;
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var ON_DAY = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];

  function warsawNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    var p = {};
    parts.forEach(function (x) { if (x.type !== 'literal') p[x.type] = parseInt(x.value, 10); });
    return p;
  }

  // Wielkanoc (algorytm Meeusa/Jonesa/Butchera), zwraca znacznik czasu UTC.
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }

  // Dni ustawowo wolne w Polsce, które mogą wypaść w dzień roboczy.
  function isHoliday(t) {
    var dt = new Date(t), y = dt.getUTCFullYear(), md = (dt.getUTCMonth() + 1) + '-' + dt.getUTCDate();
    var fixed = ['1-1', '1-6', '5-1', '5-3', '8-15', '11-1', '11-11', '12-24', '12-25', '12-26'];
    if (fixed.indexOf(md) !== -1) return true;
    var e = easter(y);
    return t === e + DAY || t === e + 60 * DAY; // poniedziałek wielkanocny, Boże Ciało
  }

  function isWorkday(t) {
    var wd = new Date(t).getUTCDay();
    return wd >= 1 && wd <= 5 && !isHoliday(t);
  }

  function setStatus(el, strong, rest) {
    el.textContent = '';
    var b = document.createElement('b');
    b.textContent = strong;
    el.appendChild(b);
    if (rest) el.appendChild(document.createTextNode(' ' + rest));
  }

  function updateDatownik() {
    var n = warsawNow();
    var today = Date.UTC(n.year, n.month - 1, n.day);
    var minutes = n.hour * 60 + n.minute;

    var stamp = document.getElementById('data-dzis');
    if (stamp) stamp.textContent = n.day + ' ' + ROMAN[n.month - 1] + ' ' + n.year;

    var rows = document.querySelectorAll('.hours tr[data-day]');
    var wd = new Date(today).getUTCDay();
    var holiday = isHoliday(today);
    for (var r = 0; r < rows.length; r++) {
      var isToday = rows[r].getAttribute('data-day') === String(wd);
      var td = rows[r].querySelector('td');
      if (!td.hasAttribute('data-hours')) td.setAttribute('data-hours', td.textContent);
      td.textContent = isToday && holiday ? 'święto' : td.getAttribute('data-hours');
      rows[r].classList.toggle('is-today', isToday);
    }

    var status = document.getElementById('status');
    if (!status) return;
    if (isWorkday(today) && minutes < CLOSE) {
      if (minutes >= OPEN) setStatus(status, 'Teraz otwarte', '– do 17:00.');
      else setStatus(status, 'Dziś otwieramy o 8:30.', '');
      return;
    }
    var ahead = 1;
    while (ahead < 15 && !isWorkday(today + ahead * DAY)) ahead++;
    var when = ahead === 1 ? 'jutro' : ON_DAY[new Date(today + ahead * DAY).getUTCDay()];
    setStatus(status, (holiday ? 'Dziś święto. ' : 'Teraz zamknięte. ') + 'Otwieramy ' + when + ' o 8:30.', '');
  }

  updateDatownik();
  setInterval(updateDatownik, 60000);

  if (!motion) return;

  /* ---------- drogomierz z liczbą opinii ---------- */
  var odo = document.querySelector('.odo[data-odo]');
  var odoCells = [];
  if (odo) {
    var cells = odo.querySelectorAll('.cell');
    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      var digit = parseInt(cell.textContent, 10) || 0;
      var cycles = c === cells.length - 1 ? 3 : c === cells.length - 2 ? 2 : 1;
      var strip = document.createElement('span');
      strip.className = 'strip';
      for (var k = 0; k < cycles * 10; k++) {
        var s = document.createElement('span');
        s.textContent = String(k % 10);
        strip.appendChild(s);
      }
      cell.textContent = '';
      cell.appendChild(strip);
      strip.style.transitionDelay = (c * 0.07) + 's';
      odoCells.push({ strip: strip, stop: (cycles - 1) * 10 + digit, count: cycles * 10 });
    }
  }
  function rollOdo() {
    odoCells.forEach(function (o) {
      o.strip.style.transform = 'translateY(' + (-100 * o.stop / o.count) + '%)';
    });
  }

  /* ---------- wejścia przy przewijaniu ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      if (odo && e.target.contains(odo)) rollOdo();
      io.unobserve(e.target);
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -6% 0px' });
  var targets = document.querySelectorAll('[data-in]');
  for (var t = 0; t < targets.length; t++) io.observe(targets[t]);

  /* ---------- linia kroków i paralaksa hali ---------- */
  var steps = document.querySelector('[data-steps]');
  var band = document.querySelector('[data-parallax]');
  var bandImg = band && band.querySelector('img');
  var ticking = false;

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    if (steps) {
      var r = steps.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / r.height));
      steps.style.setProperty('--p', p.toFixed(3));
    }
    if (bandImg) {
      var b = band.getBoundingClientRect();
      if (b.bottom > 0 && b.top < vh) {
        var shift = ((b.top + b.height / 2) - vh / 2) * -0.07;
        bandImg.style.setProperty('--py', Math.max(-38, Math.min(38, shift)).toFixed(1) + 'px');
      }
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();
})();
