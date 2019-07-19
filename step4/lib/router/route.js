const pathRegexp = require('path-to-regexp');

module.exports = Route;

function Route(path, options, handle) {
    // 请记住这个空的 keys, 当做入参传递给了 pathRegexp()
    this.keys = [];
    // 将 path 解析成正则,后续响应请求时需要判断
    this.regexp = pathRegexp(path, this.keys, options);
    this.path = path;
    this.handle = handle || this.dispatch;
    // 存放路由的请求方式
    this.layer = {
        path,
        options,
        method: null
    };
}

// 执行 route
Route.prototype.dispatch = function dispatch(req, res, done) {
    let _method = req.method.toLowerCase(),
        {
            layer: { method },
            handle
        } = this;

    if (typeof handle != 'function') {
        return done(new TypeError('Route handle requires a callback function'));
    }

    // 如果 method 不是 all 并且不相等, 执行 done (也就是router.handle里面定义的那个 next 函数, next 函数会继续循环 stack )
    if (method != 'all' && _method != method) {
        return done();
    }

    try {
        // 执行 handle
        handle(req, res, done);
    } catch (err) {
        // 异常,响应 done (也就是 next ),会拦截做返回处理
        done(err);
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
