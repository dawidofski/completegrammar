/* js/import.js — one-time content import from data/book.json (Step 3.2) */
'use strict';

var Importer = {
  // Import content idempotently; returns { imported, version, counts }.
  run: function () {
    return fetch('data/book.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to fetch book.json: HTTP ' + r.status);
        return r.json();
      })
      .then(function (book) {
        var expected = {
          chapters: book.chapters.length,
          sections: book.sections.length,
          exercises: book.exercises.length,
          questions: book.questions.length,
          answers: book.answers.length
        };
        return db.meta.get('contentVersion').then(function (stored) {
          if (stored && stored.value === book.meta.contentVersion) {
            // version matches — verify the DB is actually complete (guard
            // against a stale/partial database), else force a re-import.
            return counts().then(function (c) {
              var complete =
                c.chapters === expected.chapters &&
                c.sections === expected.sections &&
                c.exercises === expected.exercises &&
                c.questions === expected.questions &&
                c.answers === expected.answers;
              return complete
                ? { imported: false, version: book.meta.contentVersion }
                : doImport(book);
            });
          }
          return doImport(book);
        });
      })
      .then(function (res) {
        return counts().then(function (c) {
          res.counts = c;
          return res;
        });
      });
  }
};

function counts() {
  return Promise.all([
    db.chapters.count(), db.sections.count(), db.exercises.count(),
    db.questions.count(), db.answers.count(), db.theoryBlocks.count()
  ]).then(function (c) {
    return {
      chapters: c[0], sections: c[1], exercises: c[2],
      questions: c[3], answers: c[4], theoryBlocks: c[5]
    };
  });
}

function doImport(book) {
  return db.transaction('rw',
    [db.chapters, db.sections, db.theoryBlocks,
     db.exercises, db.questions, db.answers, db.meta],
    function () {
      return Promise.all([
        db.chapters.clear(),
        db.sections.clear(),
        db.theoryBlocks.clear(),
        db.exercises.clear(),
        db.questions.clear(),
        db.answers.clear()
      ]).then(function () {
        return Promise.all([
          db.chapters.bulkAdd(book.chapters),
          db.sections.bulkAdd(book.sections),
          db.theoryBlocks.bulkAdd(book.theoryBlocks),
          db.exercises.bulkAdd(book.exercises),
          db.questions.bulkAdd(book.questions),
          db.answers.bulkAdd(book.answers)
        ]);
      }).then(function () {
        return db.meta.put({ key: 'contentVersion', value: book.meta.contentVersion });
      });
    })
    .then(function () {
      return { imported: true, version: book.meta.contentVersion };
    });
}
