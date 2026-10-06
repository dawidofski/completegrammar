/* js/progress.js — record + aggregate learner progress (Step 9.1) */
'use strict';

var Progress = (function () {
  // Upsert a question's attempt result. Never touches the canonical answer.
  function record(questionId, correct, userAnswer) {
    return db.questionProgress.get(questionId).then(function (existing) {
      var now = Date.now();
      var row = existing || {
        questionId: questionId,
        attempts: 0,
        bestCorrect: false,
        hintsUsed: 0,
        answerRevealed: false,
        lastAt: now
      };
      row.attempts += 1;
      row.lastAt = now;
      row.bestCorrect = row.bestCorrect || correct;
      if (userAnswer !== undefined) row.lastAnswer = userAnswer;
      row.status = correct ? 'correct' : (row.attempts >= 2 ? 'needs-review' : 'attempted');
      return db.questionProgress.put(row);
    });
  }

  // Overall stats: { total, attempted, correct } — excludes freeform questions.
  function overall() {
    return Promise.all([
      db.questions.filter(function (q) { return q.graded; }).count(),
      db.questionProgress.toArray()
    ]).then(function (r) {
      var rows = r[1];
      return {
        total: r[0],
        attempted: rows.length,
        correct: rows.filter(function (x) { return x.bestCorrect; }).length
      };
    });
  }

  // Per-exercise stats: { graded, freeform, correct, done, attempted, complete }.
  // A graded question counts as complete when correct; a freeform question counts
  // as complete when the learner marks it done.
  function exerciseMap(exercises) {
    var ids = exercises.map(function (e) { return e.id; });
    var map = {};
    exercises.forEach(function (e) {
      map[e.id] = { graded: 0, freeform: 0, correct: 0, done: 0, attempted: 0, complete: false };
    });
    if (!ids.length) return Promise.resolve(map);
    return db.questions.where('exerciseId').anyOf(ids).toArray().then(function (qs) {
      var qById = {};
      qs.forEach(function (q) {
        qById[q.id] = q;
        var m = map[q.exerciseId];
        if (!m) return;
        if (q.graded) m.graded++; else m.freeform++;
      });
      var qids = Object.keys(qById);
      if (!qids.length) return finalize(map);
      return db.questionProgress.where('questionId').anyOf(qids).toArray().then(function (rows) {
        rows.forEach(function (r) {
          var q = qById[r.questionId];
          var m = q ? map[q.exerciseId] : null;
          if (!m) return;
          m.attempted++;
          if (q.graded && r.bestCorrect) m.correct++;
          if (!q.graded && r.completed) m.done++;
        });
        return finalize(map);
      });
    });
  }

  function finalize(map) {
    Object.keys(map).forEach(function (id) {
      var m = map[id];
      m.complete = (m.graded + m.freeform) > 0 && m.correct === m.graded && m.done === m.freeform;
    });
    return map;
  }

  function get(questionId) {
    return db.questionProgress.get(questionId);
  }

  // Toggle completion for a freeform (self-check) question. Never touches the
  // canonical answer. A freeform question is "complete" when marked done.
  function markDone(questionId, done) {
    return db.questionProgress.get(questionId).then(function (existing) {
      var row = existing || {
        questionId: questionId,
        attempts: 0,
        bestCorrect: false,
        hintsUsed: 0,
        answerRevealed: false,
        lastAt: Date.now()
      };
      row.completed = !!done;
      row.lastAt = Date.now();
      if (done) {
        row.status = 'completed';
      } else if (row.status === 'completed') {
        row.status = 'attempted';
      }
      return db.questionProgress.put(row);
    });
  }

  function resetExercise(exerciseId) {
    return db.questions.where('exerciseId').equals(exerciseId).toArray().then(function (qs) {
      var ids = qs.map(function (q) { return q.id; });
      if (!ids.length) return Promise.resolve();
      return db.questionProgress.where('questionId').anyOf(ids).delete();
    });
  }

  function resetAll() {
    return Promise.all([
      db.questionProgress.clear(),
      db.reviewItems.clear(),
      db.meta.delete('lastPosition')
    ]);
  }

  return {
    record: record, get: get, markDone: markDone, overall: overall,
    exerciseMap: exerciseMap, resetExercise: resetExercise, resetAll: resetAll
  };
})();
