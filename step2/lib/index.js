const response = require('./response');
const proto = require('./application');
const { mixin, setProtoOf } = require('./utils');

exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        // 继承
        setProtoOf(res, app.response);
        res.send(404);
    };
    mixin(app, proto, false);
    app.response = Object.create(response);
    app.init();
    return app;
}
