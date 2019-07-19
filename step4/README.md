# step4 挂中间件

## 修改 application

增加 `app.use` 方法,修改 `app.handle` 方法

```js
// lib/application.js

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
```

## 修改 router 函数

增加 `router.use` 方法,修改 `router.handle` 和 `outer.route` 方法

```js
// lib/router/index.js

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

/*
// utils.js
exports.gettype = function gettype(obj) {
    var type = typeof obj;
    if (type !== 'object') {
        return type;
    }
    return toString.call(obj).replace(/^\[object (\S+)\]$/, '$1');
};

*/
```

## 修改 route 函数

修改 `function Route` 和 `route.dispatch` 函数

```js
// lib/router/route.js

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
```

## 启动服务

```js
const VExpress = require('./lib');

const app = VExpress();
const router = VExpress.Router();
app.use(
    function(req, res, next) {
        console.log('哈哈哈哈哈');
        next();
    },
    function(req, res, next) {
        console.log('哈哈哈哈哈2');
        next();
    }
);
app.get('/', function(req, res) {
    console.log('ok');
    res.send('ok');
});

router.get('/test', function(req, res) {
    console.log('test');
    res.send('test');
});

app.listen(3000, function(...args) {
    console.log('启动成功');
});
```
