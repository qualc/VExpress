# step2 实现 res.send 函数

## 修改主函数

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

## 新增 response 模块

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

## 访问时

浏览器访问 `http://localhost:3000` 会响应 404(因为 Application 里面 res.send(404))
