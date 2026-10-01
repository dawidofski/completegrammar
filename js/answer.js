/* js/answer.js — answer normalization + checking (Step 6.1) */
'use strict';

var Answer = (function () {
  // Trim, collapse whitespace, lowercase. Preserves accents (never strips them).
  function normalize(s) {
    return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  // Split a comma-separated multi-blank answer into per-blank parts.
  function splitParts(s) {
    return String(s || '').split(/\s*,\s*/).filter(Boolean);
  }

  // Single answer: user input vs. list of accepted alternatives.
  function check(userInput, accepted) {
    var u = normalize(userInput);
    return (accepted || []).some(function (a) {
      return normalize(a) === u;
    });
  }

  // Multi-blank: array of user inputs vs. accepted alternatives, where each
  // alternative is a comma-separated list of per-blank answers.
  function checkMulti(userInputs, accepted) {
    var norm = (userInputs || []).map(normalize);
    return (accepted || []).some(function (alt) {
      var parts = splitParts(alt);
      if (parts.length !== norm.length) return false;
      return parts.every(function (p, i) {
        return normalize(p) === norm[i];
      });
    });
  }

  return {
    normalize: normalize,
    check: check,
    checkMulti: checkMulti
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Answer;
}
