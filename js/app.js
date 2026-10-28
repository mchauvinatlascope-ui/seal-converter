// Tab switching. The active tab is kept in the URL hash so a link opens the right module.
(function () {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const names = tabs.map((t) => t.dataset.tab);

  function show(name) {
    if (!names.includes(name)) name = names[0];
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      history.replaceState(null, '', '#' + tab.dataset.tab);
      show(tab.dataset.tab);
    });
    // Arrow keys move between tabs, as in a native tab bar.
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
      next.click();
      next.focus();
    });
  }

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();

// Protocol preview: the example until something is typed, then each line as a step
// with dashes cleaned and values in blue. Built by the same code that will feed Seal.
(function () {
  const { value, bold, note } = Seal;
  const input = document.getElementById('protocol-input');
  const preview = document.getElementById('protocol-sample');
  const label = document.getElementById('protocol-label');

  const example = Seal.document([
    { title: 'Before experiments', sections: [
      { title: 'Biotin-LPETG preparation', steps: [
        `Inject ${value('50 µL')} of ${bold('biotin-LPETG')} at ${value('1 mM')} subcutaneously at the immunisation site, ${value('6 times')}, ${value('20 min')} apart.`,
        `Keep the ${bold('syringes')} on ice ${note('avoid bubbles')}.`,
      ] },
    ] },
  ]);

  function render() {
    const lines = input.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      label.textContent = 'Example output';
      preview.innerHTML = example;
      return;
    }
    const found = lines.reduce((n, l) => n + Detect.findValues(Detect.cleanDashes(l)).length, 0);
    label.textContent = `${found} value${found === 1 ? '' : 's'} detected`;
    preview.innerHTML = Seal.steps(lines.map((l) => Detect.highlight(Detect.cleanDashes(l))));
  }

  input.addEventListener('input', render);
  render();
})();
