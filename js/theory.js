/* js/theory.js — render theory blocks (Step 4.2) */
'use strict';

var Theory = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function content(block) {
    return block.html || escapeHtml(block.text || '');
  }

  function blockEl(type, label, bodyHtml) {
    var d = document.createElement('div');
    d.className = 'theory-block theory-' + type;
    if (label) {
      var l = document.createElement('div');
      l.className = 'theory-block-label';
      l.textContent = label;
      d.appendChild(l);
    }
    var c = document.createElement('div');
    c.className = 'theory-block-body';
    c.innerHTML = bodyHtml;
    d.appendChild(c);
    return d;
  }

  function renderOne(b) {
    switch (b.type) {
      case 'note':
        return blockEl('note', 'Note', content(b));
      case 'tip':
        return blockEl('tip', 'Tip', content(b));
      case 'list':
        return blockEl('list', null, content(b));
      case 'table':
        var fig = document.createElement('figure');
        fig.className = 'theory-block theory-table';
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.src = 'data/tables/' + b.src;
        img.alt = b.text || 'table';
        fig.appendChild(img);
        return fig;
      default:
        return blockEl('paragraph', null, content(b));
    }
  }

  function renderChapter(chapterId, focusSectionId) {
    var body = document.getElementById('theory-body');
    return Promise.all([
      DB.sections(chapterId),
      db.theoryBlocks.where('chapterId').equals(chapterId).sortBy('order')
    ]).then(function (r) {
      var sections = r[0], blocks = r[1];
      var bySection = {};
      blocks.forEach(function (b) {
        (bySection[b.sectionId] = bySection[b.sectionId] || []).push(b);
      });
      body.innerHTML = '';
      if (!blocks.length && !sections.length) {
        var p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'No theory for this chapter.';
        body.appendChild(p);
        return;
      }
      (bySection[null] || []).forEach(function (b) {
        body.appendChild(renderOne(b));
      });
      sections.forEach(function (s) {
        var h = document.createElement('h3');
        h.className = 'theory-section-title';
        h.textContent = s.title;
        h.id = 'sec-' + s.id;
        body.appendChild(h);
        (bySection[s.id] || []).forEach(function (b) {
          body.appendChild(renderOne(b));
        });
      });
      focusSection(focusSectionId);
    });
  }

  function focusSection(sectionId) {
    if (!sectionId) return;
    var prev = document.querySelector('.theory-focused');
    if (prev) prev.classList.remove('theory-focused');
    var target = document.getElementById('sec-' + sectionId);
    if (!target) return;
    target.classList.add('theory-focused');
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return { renderChapter: renderChapter, focusSection: focusSection };
})();
