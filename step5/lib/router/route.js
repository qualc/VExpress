const pathRegexp = require('path-to-regexp');

module.exports = Route;

function Route(path, options, handle) {
    this.keys = [];
    // 将 path 解析成正则,后续响应请求时需要判断
    this.regexp = pathRegexp(path, this.keys, options);
    this.path = path;
    this.handle = handle || this.dispatch;
    this.params = {};
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

// 解析函数,除了验证路由是否匹配外,还解析 params
Route.prototype.match = function match(path) {
    /* 
        exec path
        如: 路由定义为： app.get('/:id/:ddd', handle);
            访问链接为：http://localhost:3000/1/2?a=1
        则 match 为: [ '/1/2', '1', '2', index: 0, input: '/1/2' ] 
    */
    let match = (path && this.regexp && this.regexp.exec(path)) || false;
    if (!match) {
        return false;
    }
    /* 
        keys 是什么? keys 当做入参传递给 pathRegexp 函数后, pathRegexp 函数会为其赋值, 如上路由解析后 keys 格式为:
        [
            { name: 'id', prefix: '/', delimiter: '/', optional: false, repeat: false, pattern: '[^\\/]+?' },
            { name: 'ddd', prefix: '/', delimiter: '/', optional: false, repeat: false, pattern: '[^\\/]+?' }
        ];
    */
    let { keys, params } = this;
    // 遍历 match 第0位是 正则匹配文本, 所以从第一位开始
    for (var i = 1; i < match.length; i++) {
        var key = (keys[i - 1] || {}).name;
        // 如果 val 是字符串, 就 decodeURIComponent 一下
        var val = decode_param(match[i]);

        if (val !== undefined || !hasOwnProperty.call(params, key)) {
            // key  value对应
            params[key] = val;
        }
    }
    return true;
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

function decode_param(val) {
    if (typeof val !== 'string' || val.length === 0) {
        return val;
    }
    try {
        return decodeURIComponent(val);
    } catch (err) {
        if (err instanceof URIError) {
            err.message = "Failed to decode param '" + val + "'";
            err.status = err.statusCode = 400;
        }
        throw err;
    }
}
