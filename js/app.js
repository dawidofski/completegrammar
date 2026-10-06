/* js/app.js — app shell + navigation (Step 4.1) */
'use strict';

var App = (function () {
  var followExercise = true;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }

  function renderBreadcrumb(items) {
    var bc = document.getElementById('breadcrumbs');
    bc.innerHTML = '';
    items.forEach(function (item, i) {
      if (i > 0) bc.appendChild(el('span', 'crumb-sep', '›'));
      if (item.action) {
        var b = el('button', 'crumb', item.label);
        b.addEventListener('click', item.action);
        bc.appendChild(b);
      } else {
        bc.appendChild(el('span', 'crumb crumb-current', item.label));
      }
    });
  }

  function home() {
    renderBreadcrumb([{ label: 'Book' }]);
    var content = document.getElementById('content');
    content.innerHTML = '';
    return Promise.all([
      DB.chapters(),
      db.sections.count(),
      db.exercises.count(),
      db.questions.count(),
      db.answers.count(),
      db.meta.get('lastPosition'),
      Review.count()
    ]).then(function (r) {
      var chapters = r[0], last = r[5], reviewCount = r[6];
      content.appendChild(el('p', 'data-status',
        'chapters=' + chapters.length + ' · sections=' + r[1] +
        ' · exercises=' + r[2] + ' · questions=' + r[3] + ' · answers=' + r[4]));
      if (last && last.value && last.value.exerciseId) {
        var cont = el('button', 'continue-btn', '▶ Continue where you left off');
        cont.addEventListener('click', function () {
          db.exercises.get(last.value.exerciseId).then(function (ex) {
            if (ex) openExercise(ex);
          });
        });
        content.insertBefore(cont, content.querySelector('.data-status'));
      }
      var reviewBtn = el('button', 'continue-btn secondary', 'Review (' + reviewCount + ')');
      reviewBtn.addEventListener('click', reviewScreen);
      content.insertBefore(reviewBtn, content.querySelector('.data-status'));
      var ul = el('ul', 'list');
      chapters.forEach(function (c) {
        var btn = el('button', 'list-item');
        btn.appendChild(el('span', 'item-title', c.number + '. ' + c.title));
        btn.addEventListener('click', function () { openChapter(c.id); });
        var li = el('li');
        li.appendChild(btn);
        ul.appendChild(li);
      });
      content.appendChild(ul);
      var resetAllBtn = el('button', 'reset-btn danger', '↺ Reset all progress');
      resetAllBtn.addEventListener('click', function () {
        if (window.confirm('Reset ALL progress for the whole book? This cannot be undone.')) {
          Progress.resetAll().then(function () {
            Progress.overall().then(function (s) {
              document.getElementById('overall-progress').textContent =
                s.correct + ' / ' + s.total + ' correct';
            });
            home();
          });
        }
      });
      content.appendChild(resetAllBtn);
    });
  }

  function openChapter(chapterId) {
    return DB.chapter(chapterId).then(function (ch) {
      renderBreadcrumb([
        { label: 'Book', action: home },
        { label: 'Chapter ' + ch.number }
      ]);
      var content = document.getElementById('content');
      content.innerHTML = '';
      content.appendChild(el('h2', 'chapter-heading', 'Chapter ' + ch.number + ' — ' + ch.title));
      return DB.sections(chapterId).then(function (sections) {
        if (sections.length) {
          content.appendChild(el('h3', 'section-title', 'Sections'));
          var ul = el('ul', 'list');
          sections.forEach(function (s) {
            var btn = el('button', 'list-item');
            btn.style.paddingLeft = (16 + (s.level - 1) * 16) + 'px';
            btn.appendChild(el('span', 'item-title', s.title));
            btn.addEventListener('click', function () {
              Theory.focusSection(s.id);
              setTheoryOpen(true);
            });
            var li = el('li');
            li.appendChild(btn);
            ul.appendChild(li);
          });
          content.appendChild(ul);
        }
        return DB.exercises(chapterId).then(function (exercises) {
          Nav.setExercises(chapterId, exercises);
          return Progress.exerciseMap(exercises).then(function (map) {
            if (exercises.length) {
              content.appendChild(el('h3', 'section-title', 'Exercises (' + exercises.length + ')'));
              var ul2 = el('ul', 'list');
              exercises.forEach(function (ex) {
                var label = ex.number
                  ? ('Exercise ' + ex.number)
                  : truncate(ex.instruction || 'Self-check', 70);
                var btn = el('button', 'list-item');
                btn.appendChild(el('span', 'item-title', label));
                var st = map[ex.id];
                var meta = ex.kind;
                if (st) {
                  if (st.graded > 0) {
                    meta = st.correct + '/' + st.graded + ' correct';
                  } else if (st.freeform > 0) {
                    meta = st.done + '/' + st.freeform + ' done';
                  }
                }
                var right = el('span', 'item-right');
                right.appendChild(el('span', 'item-meta', meta));
                if (st && st.complete) {
                  btn.classList.add('item-done');
                  right.appendChild(el('span', 'done-badge', '✓'));
                }
                btn.appendChild(right);
                btn.addEventListener('click', function () { openExercise(ex); });
                var li = el('li');
                li.appendChild(btn);
                ul2.appendChild(li);
              });
              content.appendChild(ul2);
            }
            Theory.renderChapter(chapterId);
          });
        });
      });
    }).catch(function (err) {
      console.error('openChapter error:', err);
      var content = document.getElementById('content');
      content.innerHTML = '';
      content.appendChild(el('p', 'muted', 'Error loading chapter: ' + err.message));
    });
  }

  function openExercise(ex) {
    Exercises.render(ex.id);
    Nav.setCurrent(ex.id);
    renderNavBar();
    db.meta.put({ key: 'lastPosition', value: { chapterId: ex.chapterId, exerciseId: ex.id } });
    var secPromise = ex.sectionId ? db.sections.get(ex.sectionId) : Promise.resolve(null);
    return Promise.all([DB.chapter(ex.chapterId), secPromise]).then(function (r) {
      var ch = r[0], sec = r[1];
      if (followExercise && sec) {
        Theory.focusSection(ex.sectionId);
        setTheoryOpen(true);
      }
      var items = [
        { label: 'Book', action: home },
        { label: 'Chapter ' + ch.number, action: function () { openChapter(ch.id); } }
      ];
      if (sec) {
        items.push({ label: sec.title, action: function () {
          openChapter(ch.id).then(function () { Theory.focusSection(sec.id); setTheoryOpen(true); });
        }});
      }
      items.push({ label: ex.number ? ('Exercise ' + ex.number) : 'Reading' });
      renderBreadcrumb(items);
    });
  }

  function renderNavBar() {
    var content = document.getElementById('content');
    var bar = el('div', 'nav-bar');
    var prevBtn = el('button', 'nav-btn', '‹ Prev');
    prevBtn.disabled = !Nav.hasPrev();
    prevBtn.addEventListener('click', function () {
      if (Nav.hasPrev()) db.exercises.get(Nav.prevId()).then(openExercise);
    });
    var nextBtn = el('button', 'nav-btn', 'Next ›');
    nextBtn.addEventListener('click', function () {
      if (Nav.hasNext()) {
        db.exercises.get(Nav.nextId()).then(openExercise);
      } else {
        nextChapter();
      }
    });
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    content.appendChild(bar);
  }

  function nextChapter() {
    return DB.chapters().then(function (chapters) {
      var i = chapters.findIndex(function (c) { return c.id === Nav.chapterId; });
      if (i >= 0 && i < chapters.length - 1) {
        openChapter(chapters[i + 1].id);
      }
    });
  }

  function reviewScreen() {
    renderBreadcrumb([{ label: 'Book', action: home }, { label: 'Review' }]);
    var content = document.getElementById('content');
    content.innerHTML = '';
    return Review.list().then(function (byChapter) {
      var chIds = Object.keys(byChapter);
      var total = chIds.reduce(function (s, id) { return s + byChapter[id].length; }, 0);
      content.appendChild(el('h2', 'chapter-heading', 'Review (' + total + ')'));
      if (!total) {
        content.appendChild(el('p', 'muted', 'Nothing to review. 🎉'));
        return;
      }
      var startBtn = el('button', 'continue-btn', '▶ Start Review');
      startBtn.addEventListener('click', function () { openReviewQuestion(byChapter[chIds[0]][0]); });
      content.appendChild(startBtn);
      chIds.forEach(function (chId) {
        var items = byChapter[chId];
        db.chapters.get(chId).then(function (ch) {
          content.appendChild(el('h3', 'section-title',
            'Chapter ' + (ch ? ch.number : '?') + ' (' + items.length + ')'));
          var ul = el('ul', 'list');
          items.forEach(function (it) {
            var btn = el('button', 'list-item');
            btn.appendChild(el('span', 'item-title', (it.question.prompt || '').slice(0, 70)));
            btn.appendChild(el('span', 'item-meta', it.reason));
            btn.addEventListener('click', function () { openReviewQuestion(it); });
            var li = el('li');
            li.appendChild(btn);
            ul.appendChild(li);
          });
          content.appendChild(ul);
        });
      });
    });
  }

  function openReviewQuestion(it) {
    var q = it.question;
    return db.exercises.get(q.exerciseId).then(function (ex) {
      renderBreadcrumb([
        { label: 'Book', action: home },
        { label: 'Review', action: reviewScreen },
        { label: 'Question ' + (q.number || '') }
      ]);
      var content = document.getElementById('content');
      content.innerHTML = '';
      var backBtn = el('button', 'reset-btn', '← Back to review');
      backBtn.addEventListener('click', reviewScreen);
      content.appendChild(backBtn);
      content.appendChild(Exercises.renderQuestion(q, q.number || null));
      if (ex) {
        Theory.renderChapter(q.chapterId, q.sectionId || ex.sectionId);
        setTheoryOpen(true);
      }
    });
  }

  function setTheoryOpen(open) {
    var panel = document.getElementById('theory-panel');
    var layout = document.querySelector('.layout');
    var toggle = document.getElementById('theory-toggle');
    panel.classList.toggle('open', open);
    layout.classList.toggle('two-col', open);
    toggle.style.display = open ? 'none' : '';
  }

  function updateFollowToggle() {
    var btn = document.getElementById('follow-toggle');
    if (btn) {
      btn.classList.toggle('active', followExercise);
      btn.setAttribute('aria-pressed', String(followExercise));
    }
  }

  function initTheoryPanel() {
    document.getElementById('theory-toggle').addEventListener('click', function () { setTheoryOpen(true); });
    document.getElementById('theory-close').addEventListener('click', function () { setTheoryOpen(false); });
    var ft = document.getElementById('follow-toggle');
    if (ft) {
      ft.addEventListener('click', function () {
        followExercise = !followExercise;
        db.meta.put({ key: 'followExercise', value: followExercise });
        updateFollowToggle();
      });
    }
    setTheoryOpen(window.matchMedia('(min-width: 900px)').matches);
  }

  function init() {
    initTheoryPanel();
    return db.open().then(function () {
      return Importer.run().then(function (res) {
        document.getElementById('overall-progress').textContent =
          res.counts.chapters + ' chapters · ' + res.counts.exercises + ' exercises';
        return db.meta.get('followExercise').then(function (m) {
          if (m) followExercise = m.value !== false;
          updateFollowToggle();
          return Progress.overall().then(function (s) {
            document.getElementById('overall-progress').textContent =
              s.correct + ' / ' + s.total + ' correct';
            return home();
          });
        });
      });
    });
  }

  return { init: init, home: home };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init().catch(function (err) {
    console.error(err);
    document.getElementById('content').textContent = 'Startup failed: ' + err.message;
  });
});


