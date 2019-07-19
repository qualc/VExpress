const http = require('http');
const statuses = require('statuses');
const mime = require('mime');

const res = Object.create(http.ServerResponse.prototype);

res.send = function send(...args) {
    let body = args[0],
        statusCode;
    if (args.length >= 2) {
        statusCode = args[1];
        if (typeof statusCode != 'number' && typeof body == 'number') {
            [body, statusCode] = [statusCode, body];
        }
        this.statusCode = statusCode;
    }
    if (typeof body == 'number' && statusCode == undefined) {
        // 如果只有响应状态码,则会去匹配对应的描述作为响应体,所以默认 Content-type 为 txt 类型
        if (!this.get('Content-type')) {
            this.set('Content-type', 'txt');
        }
        this.statusCode = body;
        // 根据状态码拿到对应的描述
        body = statuses[body];
    }

    this.end(body);
    return this;
};

res.get = function(field) {
    return this.getHeader(field);
};
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
    this.setHeader(field, value);
};
module.exports = res;
