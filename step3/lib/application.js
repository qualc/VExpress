const http = require('http');
const Router = require('./router');

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
    }
};

// 传递req res
app.handle = function(req, res) {
    this.lazyrouter();
    // 直接执行 router.handle()
    this._router.handle(req, res);
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
