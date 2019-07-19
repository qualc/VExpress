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
