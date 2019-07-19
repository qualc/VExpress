const http = require('http');
const Router = require('./router');
const query = require('./middleware/query');
const bodyParse = require('./middleware/body');

const app = (exports = module.exports = {});

app.init = function() {};

// listen  内部调用http.createServer
app.listen = function listen() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};

// 缓存一个 router 实例对象,
app.lazyrouter = function lazyrouter() {
    if (!this._router) {
        this._router = new Router();

        // 挂载中间件 query
        this._router.use(query());
        // 挂载中间件 bodyParse
        this._router.use(bodyParse());
    }
};

// 传递req res
app.handle = function handle(req, res, next) {
    this.lazyrouter();
    // 增加 next 函数,
    let done =
        next ||
        function(err) {
            // 有抛出异常时,返回异常
            if (err) {
                res.send(err.stack);
            } else {
                // 否则默认返回404
                res.send(404);
            }
        };
    // 直接执行 router.handle()
    this._router.handle(req, res, done);
};

// 提供挂载中间件接口 app.use(fn)
app.use = function use(...args) {
    this.lazyrouter();
    // 直接调用 router.use 接口
    this._router.use(...args);
    return this;
};

// 定义 get 、 post 方法
// 就是 app.get('/', fn) 功能的实现
const Methdos = ['get', 'post'];
Methdos.forEach(function(method) {
    app[method] = function(path, handle) {
        this.lazyrouter();
        // 创建一个 route 实例
        var route = this._router.route(path);
        // 执行 route 对应的方法,内部会将fns
        route[method].call(route, handle);
        return this;
    };
});
