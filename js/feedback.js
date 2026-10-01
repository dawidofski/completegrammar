/* js/feedback.js — answer feedback + try again (Step 7.1) */
'use strict';

var Feedback = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function check(q, wrap) {
    var inputs = Array.prototype.slice.call(wrap.querySelectorAll('.answer-input'));
    var userInputs = inputs.map(function (i) { return i.value; });
    var feedback = wrap.querySelector('.feedback');
    feedback.innerHTML = '';
    return DB.answer(q.id).then(function (ans) {
      if (!ans) {
        feedback.innerHTML = '<span class="feedback-free">Self-check — no automatic answer.</span>';
        return;
      }
      var correct = userInputs.length > 1
        ? Answer.checkMulti(userInputs, ans.accepted)
        : Answer.check(userInputs[0], ans.accepted);
      var userAnswer = userInputs.length > 1 ? userInputs : userInputs[0];
      Progress.record(q.id, correct, userAnswer);
      if (correct) {
        Review.resolveQuestion(q.id);
        feedback.innerHTML = '<span class="feedback-correct">✓ Correct!</span>';
        if (ans.explanation) {
          feedback.insertAdjacentHTML('beforeend',
            '<div class="feedback-why">' + escapeHtml(ans.explanation) + '</div>');
        }
      } else {
        Review.add(q.id, 'incorrect');
        feedback.innerHTML = '<span class="feedback-wrong">✗ Not quite.</span>';
        var actions = document.createElement('div');
        actions.className = 'feedback-actions';
        var retry = document.createElement('button');
        retry.className = 'mini-btn';
        retry.textContent = 'Try Again';
        retry.addEventListener('click', function () {
          inputs.forEach(function (i) { i.value = ''; });
          if (inputs[0]) inputs[0].focus();
          feedback.innerHTML = '';
        });
        var show = document.createElement('button');
        show.className = 'mini-btn';
        show.textContent = 'Show answer';
        show.addEventListener('click', function () {
          Review.add(q.id, 'revealed');
          feedback.innerHTML = '<span class="feedback-answer">Answer: ' +
            escapeHtml(ans.accepted.join(' / ')) + '</span>';
          if (ans.explanation) {
            feedback.insertAdjacentHTML('beforeend',
              '<div class="feedback-why">' + escapeHtml(ans.explanation) + '</div>');
          }
        });
        actions.appendChild(retry);
        actions.appendChild(show);
        feedback.appendChild(actions);
      }
    });
  }

  return { check: check };
})();
