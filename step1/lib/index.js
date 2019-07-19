const proto = require('./application');

exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        res.end('ok');
    };
    mixin(app, proto, false);
    app.init();
    return app;
}

function mixin(dest, src) {
    Object.getOwnPropertyNames(src).forEach(protoName => {
        if (Object.hasOwnProperty.call(dest, protoName)) {
            return;
        }
        let descriptor = Object.getOwnPropertyDescriptor(src, protoName);
        Object.defineProperty(dest, protoName, descriptor);
    });
    return dest;
}
