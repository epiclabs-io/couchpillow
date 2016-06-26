module.exports = {

    id: 0,
    design: function (pillow) {
        pillow.log.info("This is changeset 0 design");
        var view =pillow.createView("testView");
        
        view.map = function (doc, meta) {
            return meta;
        }

        var doc = pillow.createDesignDocument("testdoc2");
        doc.pushView(view);
        pillow.pushDesignDocument(doc);

    },
    run: function (pillow) {
        pillow.log.info("This is changeset 0 run");

        pillow.pushDocumentWithId("./changesets/data/doc1.json");


        pillow.done();

    }
}