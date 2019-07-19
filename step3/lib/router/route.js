// 用来将 url 转为正则的模块
const pathRegexp = require('path-to-regexp');

module.exports = Route;

function Route(path, handle) {
    // 将 path 解析成正则,后续响应请求时需要判断
    this.regexp = pathRegexp(path);
    this.path = path;
    this.handle = handle;
    // 存放路由的请求方式
    this.layer = {
        method: null
    };
}

// 执行 route
Route.prototype.dispatch = function(req, res) {
    let method = req.method.toLowerCase();
    let {
        handle,
        layer: { method: _method }
    } = this;
    // 当 reques.method 与 route 的 method 相等时执行 handle
    if (_method == method) {
        handle(req, res);
    }
};

// 对外提供 get、post 方法
const Methdos = ['get', 'post'];
Methdos.forEach(method => {
    Route.prototype[method] = function(path, handle) {
        if (typeof path == 'function' && !handle) {
            handle = path;
        } else if (typeof path == 'string' && typeof handle != 'function') {
            var type = toString.call(handle);
            var msg = 'Route.' + method + '() requires a callback function but got a ' + type;
            throw new Error(msg);
        }
        // 为 route 实例的2个必要属性赋值, path 在 new 实例的时候就已经赋值了
        this.handle = handle;
        this.layer.method = method;
        return this;
    };
});
