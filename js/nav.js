/* js/nav.js — navigation state + prev/next (Step 5.1) */
'use strict';

var Nav = {
  chapterId: null,
  exerciseIds: [],
  index: -1,

  setExercises: function (chapterId, exercises) {
    Nav.chapterId = chapterId;
    Nav.exerciseIds = exercises.map(function (e) { return e.id; });
    Nav.index = -1;
  },

  setCurrent: function (exerciseId) {
    Nav.index = Nav.exerciseIds.indexOf(exerciseId);
  },

  hasPrev: function () { return Nav.index > 0; },
  hasNext: function () {
    return Nav.index >= 0 && Nav.index < Nav.exerciseIds.length - 1;
  },
  prevId: function () { return Nav.exerciseIds[Nav.index - 1]; },
  nextId: function () { return Nav.exerciseIds[Nav.index + 1]; }
};
