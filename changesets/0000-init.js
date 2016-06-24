module.exports = {

    id: 0,
    design: function (pillow) {
        
        var view = new pillow.View("testView");
        view.map = function (doc, meta) {
            return meta;
        }

        var doc = new pillow.DesignDocument("testdoc2");
        doc.pushView(view);
        pillow.pushDesignDocument(doc);

    },
    run: function (pillow) {
        console.log("This is a changeset!!");




        pillow.done();

    }
}