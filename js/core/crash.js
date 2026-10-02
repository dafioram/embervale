/* Version number, a friendly error box, and the "play on a computer" notice for phones.
   Loaded first so it can catch errors from everything after it. */
window.G = window.G || {};
G.VERSION = '1.0';

G.crash = (() => {
  let box = null, count = 0, shown = false;

  function details(err, where) {
    const lines = [
      `Embervale v${G.VERSION}`,
      `Where: ${where || 'unknown'}`,
      `Error: ${(err && (err.message || err)) || 'unknown'}`,
    ];
    try { if (G.world && G.world.zoneId) lines.push(`Zone: ${G.world.zoneId}`); } catch (e) { /* ignore */ }
    try { if (G.state && G.state.playTime != null) lines.push(`Play time: ${Math.round(G.state.playTime)}s`); } catch (e) { /* ignore */ }
    lines.push(`Browser: ${navigator.userAgent}`);
    if (err && err.stack) lines.push('', String(err.stack).split('\n').slice(0, 10).join('\n'));
    return lines.join('\n');
  }

  function report(err, where) {
    count++;
    if (shown && count <= 5) { try { console.error(err); } catch (e) { /* ignore */ } }
    if (shown) { if (box) box.querySelector('.crash-more').textContent = count > 1 ? `(${count - 1} more error${count > 2 ? 's' : ''} since this one)` : ''; return; }
    shown = true;
    try { console.error(err); } catch (e) { /* ignore */ }
    const show = () => {
      box = document.createElement('div');
      box.id = 'crash';
      box.innerHTML = `<div class="crash-panel">
        <h3>Something went wrong</h3>
        <p>Embervale hit an error. You can try to keep playing, or reload the page. Your saves are safe. The game autosaves often, so at worst you lose a minute or two.</p>
        <p>If you report it, please paste the details below with a line about what you were doing.</p>
        <textarea readonly spellcheck="false"></textarea>
        <div class="crash-more"></div>
        <div class="crash-btns"><button class="btn" data-a="copy">Copy details</button><button class="btn" data-a="keep">Keep playing</button><button class="btn primary" data-a="reload">Reload</button></div>
      </div>`;
      box.querySelector('textarea').value = details(err, where);
      box.addEventListener('click', (ev) => {
        const a = ev.target && ev.target.dataset && ev.target.dataset.a;
        if (a === 'copy') {
          const ta = box.querySelector('textarea');
          ta.select();
          const done = () => { ev.target.textContent = 'Copied'; };
          if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => { document.execCommand('copy'); done(); });
          else { document.execCommand('copy'); done(); }
        } else if (a === 'keep') { box.remove(); box = null; }
        else if (a === 'reload') location.reload();
      });
      // keys pressed in the box shouldn't reach the game
      box.addEventListener('keydown', (ev) => ev.stopPropagation());
      document.body.appendChild(box);
    };
    if (document.body) show(); else window.addEventListener('DOMContentLoaded', show);
  }

  window.addEventListener('error', (ev) => {
    if (!ev.message || /ResizeObserver loop/.test(ev.message)) return;
    // only our own scripts; browser extensions throw errors on pages too
    if (ev.filename && !/\/js\/|index\.html|^$/.test(ev.filename) && !/embervale/i.test(ev.filename)) return;
    report(ev.error || ev.message, ev.filename ? `${ev.filename.split('/').slice(-2).join('/')}:${ev.lineno}` : 'script');
  });
  window.addEventListener('unhandledrejection', (ev) => report(ev.reason, 'async'));

  /* Phones and tablets: the game needs a mouse and keyboard (or a controller) and a
     big screen, so say so up front. "Try anyway" lets people carry on. */
  function isPhone() {
    const mm = (q) => window.matchMedia && window.matchMedia(q).matches;
    const touchOnly = mm('(pointer: coarse)') && !mm('(any-pointer: fine)');
    const small = Math.min(screen.width, screen.height) < 500;
    return touchOnly || small;
  }
  function mobileGate() {
    if (!isPhone()) return;
    const g = document.createElement('div');
    g.id = 'mobile-gate';
    g.innerHTML = `<div class="gate-inner">
      <div class="ember-logo"></div>
      <h1>Embervale</h1>
      <h2>Act I &middot; The Ember Road</h2>
      <p><b>Please play on a computer.</b></p>
      <p>Embervale is played with a mouse and keyboard (or a game controller) on a desktop or laptop screen. It doesn't work with touch controls on phones and tablets.</p>
      <p>Open this page on a computer to play. Your browser on that computer will keep your saves.</p>
      <button class="btn" id="gate-anyway">Try anyway</button>
    </div>`;
    document.body.appendChild(g);
    g.querySelector('#gate-anyway').addEventListener('click', () => g.remove());
  }

  return { report, details, isPhone, mobileGate };
})();
