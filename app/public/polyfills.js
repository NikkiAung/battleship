// node polyfills for browser — loaded before any ES modules
// provides Buffer, global, process that solana/anchor/magicblock SDKs expect
(function () {
  if (typeof globalThis.global === "undefined") globalThis.global = globalThis;
  if (typeof globalThis.process === "undefined")
    globalThis.process = { env: {} };

  // provide CJS shim so buffer/index.js can do `exports.Buffer = Buffer`
  var module = { exports: {} };
  var exports = module.exports;

  // --- inline buffer v6.0.3 (MIT) ---
  // we only need the Buffer constructor, not the full package
  // use the base64/ieee754 deps that are already in the package

  // load buffer via dynamic script injection with CJS shim
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/buffer.js", false); // synchronous
  xhr.send();
  if (xhr.status === 200) {
    var fn = new Function("module", "exports", "require", xhr.responseText);
    fn(module, exports, function (name) {
      if (name === "base64-js") {
        var m2 = { exports: {} };
        var xhr2 = new XMLHttpRequest();
        xhr2.open("GET", "/base64-js.js", false);
        xhr2.send();
        if (xhr2.status === 200) {
          var fn2 = new Function("module", "exports", xhr2.responseText);
          fn2(m2, m2.exports);
        }
        return m2.exports;
      }
      if (name === "ieee754") {
        var m3 = { exports: {} };
        var xhr3 = new XMLHttpRequest();
        xhr3.open("GET", "/ieee754.js", false);
        xhr3.send();
        if (xhr3.status === 200) {
          var fn3 = new Function("module", "exports", xhr3.responseText);
          fn3(m3, m3.exports);
        }
        return m3.exports;
      }
      return {};
    });
    globalThis.Buffer = module.exports.Buffer;
  }
})();
