module.exports = {

    id: 1,
    design: function (pillow) {
        pillow.log.info("This is changeset #1 design");


        var view = pillow.designDocuments["testdoc2"].views["testView"];
        view.map = function (doc, meta) {
            return "this is a modified map function";
        }
    },
    run: function (pillow) {
        pillow.log.info("This is changeset 1 run");
        pillow.done();

    }
}