const contentType = require('content-type');

exports.mixin = function mixin(dest, src) {
    Object.getOwnPropertyNames(src).forEach(protoName => {
        if (Object.hasOwnProperty.call(dest, protoName)) {
            return;
        }
        let descriptor = Object.getOwnPropertyDescriptor(src, protoName);
        Object.defineProperty(dest, protoName, descriptor);
    });
    return dest;
};

exports.setProtoOf = function setProtoOf(obj, proto) {
    obj.__proto__ = proto;
    return obj;
};
