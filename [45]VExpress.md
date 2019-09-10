# VExpress

> 通过实现一个简单的 `vexpress` 来加深对 `express` 的理解, 所有三方模块 api 自行在 `github` 或者 `npm` 上查看,demo 代码没有做太多的容错判断和类型的判断, 只是做一个主要功能的大概的实现

## step1 创建服务

### 创建主函数

```js
const proto = require('./application');

// 导出Application函数
exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        res.end('ok');
    };
    // app继承将application模块属性
    mixin(app, proto, false);
    // 初始化操作
    app.init();
    return app;
}

function mixin(dest, src) {
    Object.getOwnPropertyNames(src).forEach(protoName => {
        // ...
        let descriptor = Object.getOwnPropertyDescriptor(src, protoName);
        Object.defineProperty(dest, protoName, descriptor);
    });
    return dest;
}
```

### application 创建服务

```js
const http = require('http');

const app = (module.exports = {});

app.init = function() {};
// listen  内部调用http.createServer
app.listen = function listen() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};
```

### 启动服务

```js
const VExpress = require('./lib');

const app = VExpress();
app.listen(3000, function() {
    console.log('启动成功');
});
```

## step2 实现 res.send 函数

### 修改主函数

```js
const http = require('http');
// 增加response模块
const response = require('./response');
const proto = require('./application');
// 把mixin抽到了utils模块中
const { mixin, setProtoOf } = require('./utils');

// 导出Application函数
exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        // 继承
        // res 是 http 模块响应请求的对象。是 http.ServerResponse 的实例
        // setProtoOf 内部将 res.__proto__ 指向 response ,这样既保证了自身属性和值的完整性,有继承了 response 的新属性
        setProtoOf(res, app.response);
        res.send(404);
    };
    // app继承将application模块属性
    mixin(app, proto, false);
    // 初始化操作
    app.init();
    return app;
}

/*
// utils.js
exports.setProtoOf = function setProtoOf(obj, proto) {
    obj.__proto__ = proto;
    return obj;
};
*/
```

### 新增 response 模块

http 模块响应请求是,会 new 一个 ServerResponse(也就是 http.ServerResponse ) 实例, response 实际上一个复刻了 ServerResponse.prototype 的对象

```js
const http = require('http');
const statuses = require('statuses');
const mime = require('mime');

// 创建 res 对象
const res = Object.create(http.ServerResponse.prototype);

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
        // 如果只有响应状态码,则会去匹配对应的描述作为响应体,所以默认 Content-type 为 txt 类型
        if (!this.get('Content-type')) {
            this.set('Content-type', 'txt');
        }
        this.statusCode = body;
        // 根据状态码拿到对应的描述
        body = statuses[body];
    }

    // 结束响应,发送数据块
    // end 继承自 http.ServerResponse.prototype
    this.end(body);
    return this;
};

// 根据 field 获取header头
res.get = function(field) {
    // getHeader 继承自 http.ServerResponse.prototype
    return this.getHeader(field);
};

// 根据 field 设置 header 头值
res.set = function(field, value) {
    if (field.toLowerCase() === 'content-type') {
        if (!/;\s*charset\s*=/.test(value)) {
            // 根据传入的类型， 获取到对应的charset
            // mime 1.x 用法   mime.charsets.lookup(mimeType, fallback);
            //  txt =>  charset == text/plain
            var charset = mime.getType(value.split(';')[0]);
            if (charset) value += '; charset=' + charset.toLowerCase();
        }
    }
    // setHeader 继承自 http.ServerResponse.prototype
    this.setHeader(field, value);
};
module.exports = res;
```

### 访问时

浏览器访问 `http://localhost:3000` 会响应 404(因为 Application 里面 res.send(404))

## step3 实现简单路由

### 创建 route 函数

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
            var msg =
                'Route.' +
                method +
                '() requires a callback function but got a ' +
                type;
            throw new Error(msg);
        }
        // 为 route 实例的2个必要属性赋值, path 在 new 实例的时候就已经赋值了
        this.handle = handle;
        this.layer.method = method;
        return this;
    };
});
```

### 创建 router 函数

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
            var msg =
                'router.' +
                method +
                '() requires a callback function but got a ' +
                type;
            throw new Error(msg);
        }
        // 调用自身的方法创建 route 实例
        let route = this.route(path);
        route[method].apply(route, fns);
        return this;
    };
});
```

### 修改 application

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

### 修改主函数

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

### 修改 response

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

## step4 挂中间件

### 修改 application

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

### 修改 router 函数

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
            throw new TypeError(
                'Router.use() requires a middleware function but got a ' +
                    gettype(fn)
            );
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

### 修改 route 函数

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

### 启动服务

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

## step5 req.query、req.params 和 req.body

### 增加 req.query

实现是基于中间件模式,所以需要新建一个 `middleware` 文件夹, 新建 query 文件

```js
// lib/middleware/query.js

const url = require('url');
const querystring = require('querystring');

module.exports = function query() {
    return (req, res, next) => {
        if (!req.query) {
            // 通过 url 模块解析 url, 得到 query 部分
            let queryStr = url.parse(req.url).query;
            // 通过 querystring 模块将字符串的 query 解析成格式
            req.query = querystring.parse(queryStr);
        }
        next();
    };
};

/*
let path = 'https://www.baidu.com/?params=1&key=2';
let parse = url.parse(path).query;
console.log('parse:  ', parse);
//=> parse:   params=1&key=2
let query = querystring.parse(parse);
console.log(query);
//=> { params: '1', key: '2' }
*/
```

修改 `app.lazyrouter`

````js
// lib/application.js

// 缓存一个 router 实例对象,
app.lazyrouter = function lazyrouter() {
    if (!this._router) {
        this._router = new Router();

        // 挂载中间件 query
        this._router.use(query());
    }
};
```

### 增加 req.params

首先增加 `Route.prototype.match` 方法, `router.handle`中 match path 部分做修改, 将 ~~`match = route.regexp && route.regexp.test(path);`~~ 修改为调用 `route.match(path);`

```js
// lib/router/index.js

router.handle = function handle(req, res, done) {
    // omit code...

    // 通过 path 解析成的 regexp 进行验证
    // route 增加 match 做处理
    match = route.match(path);

    // omit code...
};
````

增加 `Route.prototype.match`

```js
// lib/router/index.js

function Route(path, options, handle) {
    // omit code...

    // 新增一个 params 属性
    this.params = {};

    // omit code...
}

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
            // key  value 对应
            params[key] = val;
        }
    }
    return true;
};
```

将 route.params 挂载到 request 对象

```js
// lib/router/index.js

router.handle = function handle(req, res, done) {
    // omit code...

    // 将 params 挂载在 req 上
    req.params = route.params;
    // 执行 route handle
    route.dispatch(req, res, next);
};
```

### req.body

`body-parser` 模块的核心其实还是 `raw-body` 模块
增加 `middleware/body.js` 文件

```js
// lib/middleware/body.js
const rawBody = require('raw-body');

module.exports = function bodyParse() {
    return (req, res, next) => {
        // 调用 raw-body 模块
        rawBody(
            req,
            {
                length: req.headers['content-length'],
                limit: '1mb'
                // encoding : ''  // 默认是 utf-8
            },
            function(err, buff) {
                if (err) return next(err);
                try {
                    // 得到一个 buffer 格式的流, toString() 可转为字符串
                    req.body = JSON.parse(buff.toString());
                } catch (err) {
                    return next(err);
                }
                next();
            }
        );
    };
};
```

修改 `app.lazyrouter`

````js
// lib/application.js

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
```

### 启动服务

```js
const VExpress = require('./lib');
const app = VExpress();
app.get('/:id', function(req, res) {
    console.log(req.query);
    console.log(req.params);
    console.log('ok');
    res.send('ok');
});

app.listen(3000, function(...args) {
    console.log('启动成功');
});
```
````

## step1 创建服务

### 创建主函数

```js
const proto = require('./application');

// 导出Application函数
exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        res.end('ok');
    };
    // app继承将application模块属性
    mixin(app, proto, false);
    // 初始化操作
    app.init();
    return app;
}

function mixin(dest, src) {
    Object.getOwnPropertyNames(src).forEach(protoName => {
        // ...
        let descriptor = Object.getOwnPropertyDescriptor(src, protoName);
        Object.defineProperty(dest, protoName, descriptor);
    });
    return dest;
}
```

### application 创建服务

```js
const http = require('http');

const app = (module.exports = {});

app.init = function() {};
// listen  内部调用http.createServer
app.listen = function listen() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};
```

### 启动服务

```js
const VExpress = require('./lib');

const app = VExpress();
app.listen(3000, function() {
    console.log('启动成功');
});
```

## step2 实现 res.send 函数

### 修改主函数

```js
const http = require('http');
// 增加response模块
const response = require('./response');
const proto = require('./application');
// 把mixin抽到了utils模块中
const { mixin, setProtoOf } = require('./utils');

// 导出Application函数
exports = module.exports = Application;

function Application() {
    const app = function(req, res) {
        // 继承
        // res 是 http 模块响应请求的对象。是 http.ServerResponse 的实例
        // setProtoOf 内部将 res.__proto__ 指向 response ,这样既保证了自身属性和值的完整性,有继承了 response 的新属性
        setProtoOf(res, app.response);
        res.send(404);
    };
    // app继承将application模块属性
    mixin(app, proto, false);
    // 初始化操作
    app.init();
    return app;
}

/*
// utils.js
exports.setProtoOf = function setProtoOf(obj, proto) {
    obj.__proto__ = proto;
    return obj;
};
*/
```

### 新增 response 模块

http 模块响应请求是,会 new 一个 ServerResponse(也就是 http.ServerResponse ) 实例, response 实际上一个复刻了 ServerResponse.prototype 的对象

```js
const http = require('http');
const statuses = require('statuses');
const mime = require('mime');

// 创建 res 对象
const res = Object.create(http.ServerResponse.prototype);

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
        // 如果只有响应状态码,则会去匹配对应的描述作为响应体,所以默认 Content-type 为 txt 类型
        if (!this.get('Content-type')) {
            this.set('Content-type', 'txt');
        }
        this.statusCode = body;
        // 根据状态码拿到对应的描述
        body = statuses[body];
    }

    // 结束响应,发送数据块
    // end 继承自 http.ServerResponse.prototype
    this.end(body);
    return this;
};

// 根据 field 获取header头
res.get = function(field) {
    // getHeader 继承自 http.ServerResponse.prototype
    return this.getHeader(field);
};

// 根据 field 设置 header 头值
res.set = function(field, value) {
    if (field.toLowerCase() === 'content-type') {
        if (!/;\s*charset\s*=/.test(value)) {
            // 根据传入的类型， 获取到对应的charset
            // mime 1.x 用法   mime.charsets.lookup(mimeType, fallback);
            //  txt =>  charset == text/plain
            var charset = mime.getType(value.split(';')[0]);
            if (charset) value += '; charset=' + charset.toLowerCase();
        }
    }
    // setHeader 继承自 http.ServerResponse.prototype
    this.setHeader(field, value);
};
module.exports = res;
```

### 访问时

浏览器访问 `http://localhost:3000` 会响应 404(因为 Application 里面 res.send(404))

## step3 实现简单路由

### 创建 route 函数

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
            var msg =
                'Route.' +
                method +
                '() requires a callback function but got a ' +
                type;
            throw new Error(msg);
        }
        // 为 route 实例的2个必要属性赋值, path 在 new 实例的时候就已经赋值了
        this.handle = handle;
        this.layer.method = method;
        return this;
    };
});
```

### 创建 router 函数

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
            var msg =
                'router.' +
                method +
                '() requires a callback function but got a ' +
                type;
            throw new Error(msg);
        }
        // 调用自身的方法创建 route 实例
        let route = this.route(path);
        route[method].apply(route, fns);
        return this;
    };
});
```

### 修改 application

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

### 修改主函数

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

### 修改 response

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

## step4 挂中间件

### 修改 application

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

### 修改 router 函数

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
            throw new TypeError(
                'Router.use() requires a middleware function but got a ' +
                    gettype(fn)
            );
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

### 修改 route 函数

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

### 启动服务

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

## step5 req.query、req.params 和 req.body

### 增加 req.query

实现是基于中间件模式,所以需要新建一个 `middleware` 文件夹, 新建 query 文件

```js
// lib/middleware/query.js

const url = require('url');
const querystring = require('querystring');

module.exports = function query() {
    return (req, res, next) => {
        if (!req.query) {
            // 通过 url 模块解析 url, 得到 query 部分
            let queryStr = url.parse(req.url).query;
            // 通过 querystring 模块将字符串的 query 解析成格式
            req.query = querystring.parse(queryStr);
        }
        next();
    };
};

/*
let path = 'https://www.baidu.com/?params=1&key=2';
let parse = url.parse(path).query;
console.log('parse:  ', parse);
//=> parse:   params=1&key=2
let query = querystring.parse(parse);
console.log(query);
//=> { params: '1', key: '2' }
*/
```

修改 `app.lazyrouter`

````js
// lib/application.js

// 缓存一个 router 实例对象,
app.lazyrouter = function lazyrouter() {
    if (!this._router) {
        this._router = new Router();

        // 挂载中间件 query
        this._router.use(query());
    }
};
```

### 增加 req.params

首先增加 `Route.prototype.match` 方法, `router.handle`中 match path 部分做修改, 将 ~~`match = route.regexp && route.regexp.test(path);`~~ 修改为调用 `route.match(path);`

```js
// lib/router/index.js

router.handle = function handle(req, res, done) {
    // omit code...

    // 通过 path 解析成的 regexp 进行验证
    // route 增加 match 做处理
    match = route.match(path);

    // omit code...
};
````

增加 `Route.prototype.match`

```js
// lib/router/index.js

function Route(path, options, handle) {
    // omit code...

    // 新增一个 params 属性
    this.params = {};

    // omit code...
}

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
            // key  value 对应
            params[key] = val;
        }
    }
    return true;
};
```

将 route.params 挂载到 request 对象

```js
// lib/router/index.js

router.handle = function handle(req, res, done) {
    // omit code...

    // 将 params 挂载在 req 上
    req.params = route.params;
    // 执行 route handle
    route.dispatch(req, res, next);
};
```

### req.body

`body-parser` 模块的核心其实还是 `raw-body` 模块
增加 `middleware/body.js` 文件

```js
// lib/middleware/body.js
const rawBody = require('raw-body');

module.exports = function bodyParse() {
    return (req, res, next) => {
        // 调用 raw-body 模块
        rawBody(
            req,
            {
                length: req.headers['content-length'],
                limit: '1mb'
                // encoding : ''  // 默认是 utf-8
            },
            function(err, buff) {
                if (err) return next(err);
                try {
                    // 得到一个 buffer 格式的流, toString() 可转为字符串
                    req.body = JSON.parse(buff.toString());
                } catch (err) {
                    return next(err);
                }
                next();
            }
        );
    };
};
```

修改 `app.lazyrouter`

````js
// lib/application.js

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
```

### 启动服务

```js
const VExpress = require('./lib');
const app = VExpress();
app.get('/:id', function(req, res) {
    console.log(req.query);
    console.log(req.params);
    console.log('ok');
    res.send('ok');
});

app.listen(3000, function(...args) {
    console.log('启动成功');
});
```
````
