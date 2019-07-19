const Router = require('./router');
const response = require('./response');
const proto = require('./application');
const { mixin, setProtoOf } = require('./utils');

exports = module.exports = Application;
exports.Router = Router;

function Application() {
    const app = function(req, res) {
        // 继承
        // res 是 http 模块响应请求的对象。是 http.ServerResponse 的实例
        // setProtoOf 内部将 res.__proto__ 指向 response ,这样既保证了自身属性和值的完整性,有继承了 response 的新属性
        setProtoOf(res, app.response);
        // 调用 application.handle 函数
        // 也就是在 http 响应请求时,调用 handle 开始解析和执行路由
        app.handle(req, res);
    };
    // app继承将application模块属性
    mixin(app, proto, false);

    // 初始化操作
    app.response = Object.create(response);

    app.init();
    return app;
}
