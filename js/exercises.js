/* js/exercises.js — render exercises + questions (Step 4.3) */
'use strict';

var Exercises = (function () {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function promptHtml(prompt, blankIndex) {
    var n = 0;
    return prompt.replace(/_{3,}/g, function () {
      n++;
      if (blankIndex == null || n === blankIndex) {
        return '<input class="answer-input" data-blank="' + n + '" autocomplete="off" autocapitalize="none" spellcheck="false">';
      }
      return ' _____ ';
    });
  }

  function isFreeform(q) {
    return !!q.freeResponse || (q.graded === false && q.blankCount === 0);
  }

  // Open-ended (self-check) question: textarea + "mark as done" toggle. There is
  // no canonical answer, so completion is self-reported and persisted.
  function freeformControls(q, wrap) {
    var ta = document.createElement('textarea');
    ta.className = 'answer-textarea';
    ta.rows = 2;
    wrap.appendChild(ta);
    wrap.appendChild(el('div', 'feedback feedback-free', 'Self-check — no automatic answer.'));

    var row = el('div', 'done-row');
    var doneBtn = el('button', 'done-toggle', 'Mark as done');
    doneBtn.setAttribute('aria-pressed', 'false');
    var doneState = el('span', 'done-state');
    row.appendChild(doneBtn);
    row.appendChild(doneState);
    wrap.appendChild(row);

    function setDone(done) {
      doneBtn.textContent = done ? '✓ Done' : 'Mark as done';
      doneBtn.classList.toggle('done', done);
      doneBtn.setAttribute('aria-pressed', String(done));
      doneState.textContent = done ? 'Completed' : '';
      wrap.classList.toggle('question-done', done);
    }

    Progress.get(q.id).then(function (row) { setDone(!!(row && row.completed)); });
    doneBtn.addEventListener('click', function () {
      Progress.get(q.id).then(function (row) {
        var next = !(row && row.completed);
        Progress.markDone(q.id, next).then(function () {
          setDone(next);
          if (next) Review.resolveQuestion(q.id);
        });
      });
    });
  }

  function gradedControls(q, wrap) {
    var checkBtn = el('button', 'check-btn', 'Check');
    var feedback = el('div', 'feedback');
    checkBtn.addEventListener('click', function () { Feedback.check(q, wrap); });
    wrap.appendChild(checkBtn);
    wrap.appendChild(feedback);
    var inputs = wrap.querySelectorAll('.answer-input');
    Array.prototype.forEach.call(inputs, function (inp) {
      // Enter-to-check only on single-line inputs, not textareas.
      if (inp.tagName.toLowerCase() === 'textarea') return;
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); Feedback.check(q, wrap); }
      });
    });
    Progress.get(q.id).then(function (row) {
      if (row && row.lastAnswer !== undefined && row.lastAnswer !== null) {
        var answers = Array.isArray(row.lastAnswer) ? row.lastAnswer : [row.lastAnswer];
        Array.prototype.forEach.call(inputs, function (inp, i) {
          if (answers[i] !== undefined && answers[i] !== null) inp.value = answers[i];
        });
      }
    });
  }

  function renderQuestion(q, number) {
    var wrap = el('div', 'question');
    if (number != null) {
      wrap.appendChild(el('div', 'question-number', number + '.'));
    }
    if (q.imageSrc) {
      var img = document.createElement('img');
      img.src = 'data/tables/' + q.imageSrc;
      img.alt = '';
      img.className = 'question-image';
      wrap.appendChild(img);
    }
    var p = el('div', 'question-prompt');
    if (q.prompt) {
      p.innerHTML = promptHtml(q.prompt, q.blankIndex);
    } else if (q.imageSrc) {
      // image-based question (e.g. matching): a single blank input
      p.innerHTML = '<input class="answer-input" data-blank="1" autocomplete="off" autocapitalize="none" spellcheck="false">';
    }
    wrap.appendChild(p);
    if (q.gloss) {
      wrap.appendChild(el('div', 'question-gloss', q.gloss));
    }

    if (isFreeform(q)) {
      freeformControls(q, wrap);
      return wrap;
    }

    if (!q.graded) return wrap;

    var hasInput = !!p.querySelector('.answer-input');
    if (hasInput) {
      gradedControls(q, wrap);
      return wrap;
    }

    // Graded short-answer/translation with no blank to fill: give it a free-text
    // box, unless the canonical answer is a "…" model answer (then self-check).
    DB.answer(q.id).then(function (ans) {
      var accepted = (ans && ans.accepted) || [];
      var isModel = accepted.length > 0 && accepted.every(function (a) {
        var s = String(a);
        return s.indexOf('...') !== -1 || s.indexOf('\u2026') !== -1;
      });
      if (isModel) {
        freeformControls(q, wrap);
      } else {
        var ta = document.createElement('textarea');
        ta.className = 'answer-input answer-textarea';
        ta.rows = 2;
        ta.setAttribute('data-blank', '1');
        ta.setAttribute('autocomplete', 'off');
        ta.setAttribute('spellcheck', 'false');
        wrap.appendChild(ta);
        gradedControls(q, wrap);
      }
    });

    return wrap;
  }

  function render(exerciseId) {
    var content = document.getElementById('content');
    content.innerHTML = '';
    return db.exercises.get(exerciseId).then(function (ex) {
      if (!ex) {
        content.appendChild(el('p', 'muted', 'Exercise not found.'));
        return;
      }
      content.appendChild(el('h2', 'chapter-heading',
        ex.number ? ('Exercise ' + ex.number) : 'Exercise'));
      if (ex.instruction) {
        content.appendChild(el('p', 'exercise-instruction', ex.instruction));
      }
      if (ex.wordBank && ex.wordBank.length) {
        var wb = el('div', 'word-bank');
        ex.wordBank.forEach(function (w) {
          wb.appendChild(el('span', 'word-chip', w));
        });
        content.appendChild(wb);
      }
      if (ex.freeform) {
        content.appendChild(el('p', 'muted', 'Answers will vary — self-check.'));
      }
      return DB.questions(exerciseId).then(function (qs) {
        if (!qs.length) {
          content.appendChild(el('p', 'muted', 'No questions.'));
          return;
        }
        qs.forEach(function (q) {
          content.appendChild(renderQuestion(q, q.number || null));
        });
        var resetBtn = el('button', 'reset-btn', '↺ Reset this exercise');
        resetBtn.addEventListener('click', function () {
          if (window.confirm('Reset progress for this exercise?')) {
            Progress.resetExercise(exerciseId).then(function () {
              Exercises.render(exerciseId);
            });
          }
        });
        content.appendChild(resetBtn);
      });
    });
  }

  return { render: render, renderQuestion: renderQuestion };
})();
