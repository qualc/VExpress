const url = require('url');
const Route = require('./route');
const { gettype } = require('../utils');

module.exports = function() {
    return router;
};

function router() {
    // router.handle(req, res, next);
}

// 用来存放 route 实例
router.stack = [];

router.route = function route(path) {
    // 新建一个 route 实例
    let route = new Route(path, {
        // 路由 需要完全匹配
        end: true
    });
    // 将实例放入 stack
    this.stack.push(route);
    return route;
};

// 这里 提供给 application 调用,
// 当响应请求时会进入该函数
router.handle = function handle(req, res, done) {
    // 遍历stack
    let stack = this.stack,
        index = 0,
        path = req.url ? url.parse(req.url).pathname : null;
    if (path == null) {
        // 这里响应err
        throw Error('path是空的');
    }
    // 新加 next 函数,传递给 route.dispatch
    // 用意是当一个 route 或者 中间件执行完毕后, 通过透传 next 函数再执行当前 next 函数, index 递增循环下一个 `stack数据项`
    next();
    function next(err) {
        if (err) {
            // 拦截异常,执行返回
            return done(err);
        }
        let match = false,
            route = null;
        // 遍历 stack
        // match !== true 表示未匹配到合适
        while (match !== true && index < stack.length) {
            // index 递增, 除了 while 会循环之外, next 也会存在再执行的情况
            route = stack[index++];
            if (!route) {
                continue;
            }
            // 通过 path 解析成的 regexp 进行验证
            match = route.regexp && route.regexp.test(path);
            if (match !== true) {
                continue;
            }
        }
        // while 完之后还没有匹配到合适的,直接返回,默认 res.send(404)
        if (match !== true) {
            return done();
        }

        // 将路由挂载 req 上
        if (route) {
            req.route = route;
        }

        // 执行 route handle
        route.dispatch(req, res, next);
    }
};

// 挂载中间件
router.use = function use(path, ...fns) {
    // 解析是否包含 path
    if (typeof path == 'function') {
        // 如果第一个参数 `path` 是函数,则加入 fns 中
        fns.unshift(path);
        path = '/';
    }

    if (fns.length == 0) {
        throw new TypeError('Router.use() requires a middleware function');
    }

    fns.forEach(fn => {
        if (typeof fn != 'function') {
            throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn));
        }

        // 创建 route 实例
        let route = new Route(
            path,
            {
                // path-to-regexp 解析路由时的参数,表示正则表达式与字符串的结尾匹配(完全匹配的意思), 默认为 true
                // 假设有中间件fn  app.use('/test', fn)
                // /test  通过
                // /test/aaaa  通过
                // /te  不通过
                end: false
            },
            fn
        );
        // 标记 method 为 all
        // 所有请求只要 path 能配置,就执行的意思
        route.layer.method = 'all';
        this.stack.push(route);
    });
    return this;
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
