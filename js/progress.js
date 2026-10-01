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

  // Per-exercise stats: { exerciseId: { total, attempted, correct } } —
  // excludes freeform questions.
  function exerciseMap(exercises) {
    var ids = exercises.map(function (e) { return e.id; });
    var map = {};
    exercises.forEach(function (e) { map[e.id] = { total: 0, attempted: 0, correct: 0 }; });
    if (!ids.length) return Promise.resolve(map);
    return db.questions.where('exerciseId').anyOf(ids).toArray().then(function (qs) {
      var qEx = {};
      qs.forEach(function (q) {
        if (!q.graded) return;
        qEx[q.id] = q.exerciseId;
        map[q.exerciseId].total++;
      });
      var qids = Object.keys(qEx);
      if (!qids.length) return map;
      return db.questionProgress.where('questionId').anyOf(qids).toArray().then(function (rows) {
        rows.forEach(function (r) {
          var exId = qEx[r.questionId];
          if (map[exId]) {
            map[exId].attempted++;
            if (r.bestCorrect) map[exId].correct++;
          }
        });
        return map;
      });
    });
  }

  function get(questionId) {
    return db.questionProgress.get(questionId);
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
    record: record, get: get, overall: overall, exerciseMap: exerciseMap,
    resetExercise: resetExercise, resetAll: resetAll
  };
})();
