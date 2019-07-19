const url = require('url');
const Route = require('./route');

module.exports = function() {
    return router;
};

function router(req, res) {}

// 用来存放 route 实例
router.stack = [];

router.route = function(path) {
    // 新建一个 route 实例
    let route = new Route(path);
    // 将实例放入 stack
    this.stack.push(route);
    return route;
};

// 这里 提供给 application 调用,
// 当响应请求时会进入该函数
router.handle = function(req, res) {
    // 遍历stack
    let stack = this.stack,
        index = 0,
        match = false,
        route = null,
        path = req.url ? url.parse(req.url).pathname : null;
    if (path == null) {
        // 这里响应err
        throw Error('path是空的');
    }
    // 遍历 stack
    while (match != true && index < stack.length) {
        route = stack[index++];
        if (!route) {
            continue;
        }
        // 通过 path 解析成的 regexp 进行验证,
        match = route.regexp && route.regexp.test(path);
        if (match !== true) {
            continue;
        }
    }
    if (match) {
        // 执行 route handle
        route.dispatch(req, res);
    } else {
        // 响应404
        res.send(404);
    }
};

// 为 router 对象提供 get、post 接口
// 就是 router.get('/', fn);
const Methdos = ['get', 'post'];
Methdos.forEach(method => {
    router[method] = function(path, handle) {
        if (typeof path == 'function' && !handle) {
            handle = path;
        } else if (typeof path == 'string' && typeof handle != 'function') {
            var type = toString.call(handle);
            var msg = 'router.' + method + '() requires a callback function but got a ' + type;
            throw new Error(msg);
        }
        // 调用自身的方法创建 route 实例
        let route = this.route(path);
        route[method].call(route, handle);
        return this;
    };
});
