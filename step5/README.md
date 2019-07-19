# step5 req.query、req.params 和 req.body

## 增加 req.query

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

## 增加 req.params

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

## req.body

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

## 启动服务

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
