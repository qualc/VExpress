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
