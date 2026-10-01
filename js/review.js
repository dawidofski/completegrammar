/* js/review.js — review mistakes (Step 10.1) */
'use strict';

var Review = (function () {
  // Add a question to review (idempotent for active items).
  function add(questionId, reason) {
    return db.reviewItems.where('questionId').equals(questionId).toArray().then(function (items) {
      var active = items.filter(function (i) { return !i.resolved; })[0];
      if (active) return active;
      return db.reviewItems.add({
        questionId: questionId,
        reason: reason,
        addedAt: Date.now(),
        resolved: false
      });
    });
  }

  function count() {
    return db.reviewItems.toArray().then(function (items) {
      return items.filter(function (i) { return !i.resolved; }).length;
    });
  }

  // Unresolved items grouped by chapter, each with question context.
  function list() {
    return db.reviewItems.toArray().then(function (items) {
      items = items.filter(function (i) { return !i.resolved; });
      var qids = items.map(function (i) { return i.questionId; });
      if (!qids.length) return [];
      return db.questions.where('id').anyOf(qids).toArray().then(function (qs) {
        var qById = {};
        qs.forEach(function (q) { qById[q.id] = q; });
        var byChapter = {};
        items.forEach(function (i) {
          var q = qById[i.questionId];
          if (!q) return;
          (byChapter[q.chapterId] = byChapter[q.chapterId] || []).push({
            questionId: i.questionId,
            question: q,
            reason: i.reason
          });
        });
        return byChapter;
      });
    });
  }

  // Resolve (remove from active review) a question.
  function resolveQuestion(questionId) {
    return db.reviewItems.where('questionId').equals(questionId).modify({ resolved: true });
  }

  return { add: add, count: count, list: list, resolveQuestion: resolveQuestion };
})();
