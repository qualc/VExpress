# step1 创建服务

## 创建主函数

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

## application 创建服务

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

## 启动服务

```js
const VExpress = require('./lib');

const app = VExpress();
app.listen(3000, function() {
    console.log('启动成功');
});
```
