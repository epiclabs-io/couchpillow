module.exports = {

    id: 0,
    design: function (pillow) {
        console.log("This is changeset 0 design");
        var view = new pillow.View("testView");
        view.map = function (doc, meta) {
            return meta;
        }

        var doc = new pillow.DesignDocument("testdoc2");
        doc.pushView(view);
        pillow.pushDesignDocument(doc);

    },
    run: function (pillow) {
        console.log("This is changeset 0 run");




        pillow.done();

    }
}