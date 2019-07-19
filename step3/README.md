# step3 实现简单路由

## 创建 route 函数

```js
// lib/router/route.js

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
```

## 创建 router 函数

```js
// lib/router/index.js

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
const Methdos = ['get', 'post', 'all'];
Methdos.forEach(method => {
    router[method] = function(path, ...fns) {
        if (typeof path == 'function' && !handle) {
            fns.push(fns);
        } else if (typeof path == 'string' && typeof handle != 'function') {
            var type = toString.call(handle);
            var msg = 'router.' + method + '() requires a callback function but got a ' + type;
            throw new Error(msg);
        }
        // 调用自身的方法创建 route 实例
        let route = this.route(path);
        route[method].apply(route, fns);
        return this;
    };
});
```

## 修改 application

新增 `app.lazyrouter` `app.handle` `app.get` `app.post` 四个方法

```js
// lib/application.js

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

// 为 express 提供 get、post 接口
// 就是 app.get('/', fn) 功能的实现
const Methdos = ['get', 'post'];
Methdos.forEach(function(method) {
    app[method] = function(path, ...fns) {
        this.lazyrouter();
        // 创建一个 route 实例
        var route = this._router.route(path);
        // 执行 route 对应的方法
        route[method].apply(route, fns);
        return this;
    };
});
```

## 修改主函数

`const app = function(){}` 调用 `app.handle(req, res)`

```js
// lib/index.js

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
```

## 修改 response

新增 `res.json` 方法 和修改 `res.send` , 兼容更多的响应数据类型

```js
// lib/response.js

// omit code...

// 定义 send 函数
res.send = function send(...args) {
    let body = args[0],
        statusCode;
    if (args.length >= 2) {
        statusCode = args[1];
        // 当参数长度大于等于2时,默认一个是数据块,一个响应状态码
        if (typeof statusCode != 'number' && typeof body == 'number') {
            [body, statusCode] = [statusCode, body];
        }
        // this.statusCode 继承自 http.ServerResponse.prototype
        this.statusCode = statusCode;
    }
    // 如果参数只有一位并且是 number 类型, 默认该值为响应状态码
    if (typeof body == 'number' && statusCode == undefined) {
        // 如果只有响应状态码,则会去匹配对应的描述作为响应体,所以默认
        if (!this.get('Content-type')) {
            this.set('Content-type', 'txt');
        }
        this.statusCode = body;
        // 根据状态码拿到对应的描述
        body = statuses[body];
    }
    // 根据 body 的类型, 设置不同的 Content-Type
    switch (typeof body) {
        case 'string':
            // 设置默认的 Content-Type
            if (!this.get('Content-Type')) {
                this.set('Content-type', 'html');
            }
            break;
        case 'boolean':
        case 'number':
        case 'object':
            if (body === null) {
                body = '';
            } else if (Buffer.isBuffer(body)) {
                // 设置默认的 Content-Type
                if (!this.get('Content-Type')) {
                    this.type('bin');
                }
            } else {
                // 调用 this.json
                return this.json(body);
            }
            break;
    }
    // 结束响应,发送数据块
    // end 继承自 http.ServerResponse.prototype
    this.end(body);
    return this;
};

// 响应 json 格式数据
res.json = function(...args) {
    let body = args[0],
        statusCode;
    if (args.length >= 2) {
        statusCode = args[1];
        // 处理响应体和状态码
        if (typeof statusCode != 'number' && typeof body == 'number') {
            [body, statusCode] = [statusCode, body];
        }
        this.statusCode = statusCode;
    }

    // 设置默认 Content-type
    if (!this.get('Content-Type')) {
        this.set('Content-Type', 'application/json');
    }

    // 格式化为字符串,调用 send
    return this.send(JSON.stringify(body));
};

// omit code....
```
