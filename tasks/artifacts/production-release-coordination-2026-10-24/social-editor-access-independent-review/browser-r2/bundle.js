(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // web/node_modules/react/cjs/react.production.min.js
  var require_react_production_min = __commonJS({
    "web/node_modules/react/cjs/react.production.min.js"(exports) {
      "use strict";
      var l = Symbol.for("react.element");
      var n = Symbol.for("react.portal");
      var p = Symbol.for("react.fragment");
      var q = Symbol.for("react.strict_mode");
      var r = Symbol.for("react.profiler");
      var t = Symbol.for("react.provider");
      var u = Symbol.for("react.context");
      var v = Symbol.for("react.forward_ref");
      var w = Symbol.for("react.suspense");
      var x = Symbol.for("react.memo");
      var y = Symbol.for("react.lazy");
      var z = Symbol.iterator;
      function A(a) {
        if (null === a || "object" !== typeof a) return null;
        a = z && a[z] || a["@@iterator"];
        return "function" === typeof a ? a : null;
      }
      var B = { isMounted: function() {
        return false;
      }, enqueueForceUpdate: function() {
      }, enqueueReplaceState: function() {
      }, enqueueSetState: function() {
      } };
      var C = Object.assign;
      var D = {};
      function E(a, b, e) {
        this.props = a;
        this.context = b;
        this.refs = D;
        this.updater = e || B;
      }
      E.prototype.isReactComponent = {};
      E.prototype.setState = function(a, b) {
        if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
        this.updater.enqueueSetState(this, a, b, "setState");
      };
      E.prototype.forceUpdate = function(a) {
        this.updater.enqueueForceUpdate(this, a, "forceUpdate");
      };
      function F() {
      }
      F.prototype = E.prototype;
      function G(a, b, e) {
        this.props = a;
        this.context = b;
        this.refs = D;
        this.updater = e || B;
      }
      var H = G.prototype = new F();
      H.constructor = G;
      C(H, E.prototype);
      H.isPureReactComponent = true;
      var I = Array.isArray;
      var J = Object.prototype.hasOwnProperty;
      var K = { current: null };
      var L = { key: true, ref: true, __self: true, __source: true };
      function M(a, b, e) {
        var d, c = {}, k = null, h = null;
        if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
        var g = arguments.length - 2;
        if (1 === g) c.children = e;
        else if (1 < g) {
          for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
          c.children = f;
        }
        if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
        return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
      }
      function N(a, b) {
        return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
      }
      function O(a) {
        return "object" === typeof a && null !== a && a.$$typeof === l;
      }
      function escape(a) {
        var b = { "=": "=0", ":": "=2" };
        return "$" + a.replace(/[=:]/g, function(a2) {
          return b[a2];
        });
      }
      var P = /\/+/g;
      function Q(a, b) {
        return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
      }
      function R(a, b, e, d, c) {
        var k = typeof a;
        if ("undefined" === k || "boolean" === k) a = null;
        var h = false;
        if (null === a) h = true;
        else switch (k) {
          case "string":
          case "number":
            h = true;
            break;
          case "object":
            switch (a.$$typeof) {
              case l:
              case n:
                h = true;
            }
        }
        if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
          return a2;
        })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
        h = 0;
        d = "" === d ? "." : d + ":";
        if (I(a)) for (var g = 0; g < a.length; g++) {
          k = a[g];
          var f = d + Q(k, g);
          h += R(k, b, e, f, c);
        }
        else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
        else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
        return h;
      }
      function S(a, b, e) {
        if (null == a) return a;
        var d = [], c = 0;
        R(a, d, "", "", function(a2) {
          return b.call(e, a2, c++);
        });
        return d;
      }
      function T(a) {
        if (-1 === a._status) {
          var b = a._result;
          b = b();
          b.then(function(b2) {
            if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
          }, function(b2) {
            if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
          });
          -1 === a._status && (a._status = 0, a._result = b);
        }
        if (1 === a._status) return a._result.default;
        throw a._result;
      }
      var U = { current: null };
      var V = { transition: null };
      var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
      function X() {
        throw Error("act(...) is not supported in production builds of React.");
      }
      exports.Children = { map: S, forEach: function(a, b, e) {
        S(a, function() {
          b.apply(this, arguments);
        }, e);
      }, count: function(a) {
        var b = 0;
        S(a, function() {
          b++;
        });
        return b;
      }, toArray: function(a) {
        return S(a, function(a2) {
          return a2;
        }) || [];
      }, only: function(a) {
        if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
        return a;
      } };
      exports.Component = E;
      exports.Fragment = p;
      exports.Profiler = r;
      exports.PureComponent = G;
      exports.StrictMode = q;
      exports.Suspense = w;
      exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
      exports.act = X;
      exports.cloneElement = function(a, b, e) {
        if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
        var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
        if (null != b) {
          void 0 !== b.ref && (k = b.ref, h = K.current);
          void 0 !== b.key && (c = "" + b.key);
          if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
          for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
        }
        var f = arguments.length - 2;
        if (1 === f) d.children = e;
        else if (1 < f) {
          g = Array(f);
          for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
          d.children = g;
        }
        return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
      };
      exports.createContext = function(a) {
        a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
        a.Provider = { $$typeof: t, _context: a };
        return a.Consumer = a;
      };
      exports.createElement = M;
      exports.createFactory = function(a) {
        var b = M.bind(null, a);
        b.type = a;
        return b;
      };
      exports.createRef = function() {
        return { current: null };
      };
      exports.forwardRef = function(a) {
        return { $$typeof: v, render: a };
      };
      exports.isValidElement = O;
      exports.lazy = function(a) {
        return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
      };
      exports.memo = function(a, b) {
        return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
      };
      exports.startTransition = function(a) {
        var b = V.transition;
        V.transition = {};
        try {
          a();
        } finally {
          V.transition = b;
        }
      };
      exports.unstable_act = X;
      exports.useCallback = function(a, b) {
        return U.current.useCallback(a, b);
      };
      exports.useContext = function(a) {
        return U.current.useContext(a);
      };
      exports.useDebugValue = function() {
      };
      exports.useDeferredValue = function(a) {
        return U.current.useDeferredValue(a);
      };
      exports.useEffect = function(a, b) {
        return U.current.useEffect(a, b);
      };
      exports.useId = function() {
        return U.current.useId();
      };
      exports.useImperativeHandle = function(a, b, e) {
        return U.current.useImperativeHandle(a, b, e);
      };
      exports.useInsertionEffect = function(a, b) {
        return U.current.useInsertionEffect(a, b);
      };
      exports.useLayoutEffect = function(a, b) {
        return U.current.useLayoutEffect(a, b);
      };
      exports.useMemo = function(a, b) {
        return U.current.useMemo(a, b);
      };
      exports.useReducer = function(a, b, e) {
        return U.current.useReducer(a, b, e);
      };
      exports.useRef = function(a) {
        return U.current.useRef(a);
      };
      exports.useState = function(a) {
        return U.current.useState(a);
      };
      exports.useSyncExternalStore = function(a, b, e) {
        return U.current.useSyncExternalStore(a, b, e);
      };
      exports.useTransition = function() {
        return U.current.useTransition();
      };
      exports.version = "18.3.1";
    }
  });

  // web/node_modules/react/index.js
  var require_react = __commonJS({
    "web/node_modules/react/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // web/node_modules/scheduler/cjs/scheduler.production.min.js
  var require_scheduler_production_min = __commonJS({
    "web/node_modules/scheduler/cjs/scheduler.production.min.js"(exports) {
      "use strict";
      function f(a, b) {
        var c = a.length;
        a.push(b);
        a: for (; 0 < c; ) {
          var d = c - 1 >>> 1, e = a[d];
          if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
          else break a;
        }
      }
      function h(a) {
        return 0 === a.length ? null : a[0];
      }
      function k(a) {
        if (0 === a.length) return null;
        var b = a[0], c = a.pop();
        if (c !== b) {
          a[0] = c;
          a: for (var d = 0, e = a.length, w = e >>> 1; d < w; ) {
            var m = 2 * (d + 1) - 1, C = a[m], n = m + 1, x = a[n];
            if (0 > g(C, c)) n < e && 0 > g(x, C) ? (a[d] = x, a[n] = c, d = n) : (a[d] = C, a[m] = c, d = m);
            else if (n < e && 0 > g(x, c)) a[d] = x, a[n] = c, d = n;
            else break a;
          }
        }
        return b;
      }
      function g(a, b) {
        var c = a.sortIndex - b.sortIndex;
        return 0 !== c ? c : a.id - b.id;
      }
      if ("object" === typeof performance && "function" === typeof performance.now) {
        l = performance;
        exports.unstable_now = function() {
          return l.now();
        };
      } else {
        p = Date, q = p.now();
        exports.unstable_now = function() {
          return p.now() - q;
        };
      }
      var l;
      var p;
      var q;
      var r = [];
      var t = [];
      var u = 1;
      var v = null;
      var y = 3;
      var z = false;
      var A = false;
      var B = false;
      var D = "function" === typeof setTimeout ? setTimeout : null;
      var E = "function" === typeof clearTimeout ? clearTimeout : null;
      var F = "undefined" !== typeof setImmediate ? setImmediate : null;
      "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
      function G(a) {
        for (var b = h(t); null !== b; ) {
          if (null === b.callback) k(t);
          else if (b.startTime <= a) k(t), b.sortIndex = b.expirationTime, f(r, b);
          else break;
          b = h(t);
        }
      }
      function H(a) {
        B = false;
        G(a);
        if (!A) if (null !== h(r)) A = true, I(J);
        else {
          var b = h(t);
          null !== b && K(H, b.startTime - a);
        }
      }
      function J(a, b) {
        A = false;
        B && (B = false, E(L), L = -1);
        z = true;
        var c = y;
        try {
          G(b);
          for (v = h(r); null !== v && (!(v.expirationTime > b) || a && !M()); ) {
            var d = v.callback;
            if ("function" === typeof d) {
              v.callback = null;
              y = v.priorityLevel;
              var e = d(v.expirationTime <= b);
              b = exports.unstable_now();
              "function" === typeof e ? v.callback = e : v === h(r) && k(r);
              G(b);
            } else k(r);
            v = h(r);
          }
          if (null !== v) var w = true;
          else {
            var m = h(t);
            null !== m && K(H, m.startTime - b);
            w = false;
          }
          return w;
        } finally {
          v = null, y = c, z = false;
        }
      }
      var N = false;
      var O = null;
      var L = -1;
      var P = 5;
      var Q = -1;
      function M() {
        return exports.unstable_now() - Q < P ? false : true;
      }
      function R() {
        if (null !== O) {
          var a = exports.unstable_now();
          Q = a;
          var b = true;
          try {
            b = O(true, a);
          } finally {
            b ? S() : (N = false, O = null);
          }
        } else N = false;
      }
      var S;
      if ("function" === typeof F) S = function() {
        F(R);
      };
      else if ("undefined" !== typeof MessageChannel) {
        T = new MessageChannel(), U = T.port2;
        T.port1.onmessage = R;
        S = function() {
          U.postMessage(null);
        };
      } else S = function() {
        D(R, 0);
      };
      var T;
      var U;
      function I(a) {
        O = a;
        N || (N = true, S());
      }
      function K(a, b) {
        L = D(function() {
          a(exports.unstable_now());
        }, b);
      }
      exports.unstable_IdlePriority = 5;
      exports.unstable_ImmediatePriority = 1;
      exports.unstable_LowPriority = 4;
      exports.unstable_NormalPriority = 3;
      exports.unstable_Profiling = null;
      exports.unstable_UserBlockingPriority = 2;
      exports.unstable_cancelCallback = function(a) {
        a.callback = null;
      };
      exports.unstable_continueExecution = function() {
        A || z || (A = true, I(J));
      };
      exports.unstable_forceFrameRate = function(a) {
        0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P = 0 < a ? Math.floor(1e3 / a) : 5;
      };
      exports.unstable_getCurrentPriorityLevel = function() {
        return y;
      };
      exports.unstable_getFirstCallbackNode = function() {
        return h(r);
      };
      exports.unstable_next = function(a) {
        switch (y) {
          case 1:
          case 2:
          case 3:
            var b = 3;
            break;
          default:
            b = y;
        }
        var c = y;
        y = b;
        try {
          return a();
        } finally {
          y = c;
        }
      };
      exports.unstable_pauseExecution = function() {
      };
      exports.unstable_requestPaint = function() {
      };
      exports.unstable_runWithPriority = function(a, b) {
        switch (a) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            a = 3;
        }
        var c = y;
        y = a;
        try {
          return b();
        } finally {
          y = c;
        }
      };
      exports.unstable_scheduleCallback = function(a, b, c) {
        var d = exports.unstable_now();
        "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
        switch (a) {
          case 1:
            var e = -1;
            break;
          case 2:
            e = 250;
            break;
          case 5:
            e = 1073741823;
            break;
          case 4:
            e = 1e4;
            break;
          default:
            e = 5e3;
        }
        e = c + e;
        a = { id: u++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
        c > d ? (a.sortIndex = c, f(t, a), null === h(r) && a === h(t) && (B ? (E(L), L = -1) : B = true, K(H, c - d))) : (a.sortIndex = e, f(r, a), A || z || (A = true, I(J)));
        return a;
      };
      exports.unstable_shouldYield = M;
      exports.unstable_wrapCallback = function(a) {
        var b = y;
        return function() {
          var c = y;
          y = b;
          try {
            return a.apply(this, arguments);
          } finally {
            y = c;
          }
        };
      };
    }
  });

  // web/node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "web/node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_scheduler_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // web/node_modules/react-dom/cjs/react-dom.production.min.js
  var require_react_dom_production_min = __commonJS({
    "web/node_modules/react-dom/cjs/react-dom.production.min.js"(exports) {
      "use strict";
      var aa = require_react();
      var ca = require_scheduler();
      function p(a) {
        for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b += "&args[]=" + encodeURIComponent(arguments[c]);
        return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      var da = /* @__PURE__ */ new Set();
      var ea = {};
      function fa(a, b) {
        ha(a, b);
        ha(a + "Capture", b);
      }
      function ha(a, b) {
        ea[a] = b;
        for (a = 0; a < b.length; a++) da.add(b[a]);
      }
      var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
      var ja = Object.prototype.hasOwnProperty;
      var ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/;
      var la = {};
      var ma = {};
      function oa(a) {
        if (ja.call(ma, a)) return true;
        if (ja.call(la, a)) return false;
        if (ka.test(a)) return ma[a] = true;
        la[a] = true;
        return false;
      }
      function pa(a, b, c, d) {
        if (null !== c && 0 === c.type) return false;
        switch (typeof b) {
          case "function":
          case "symbol":
            return true;
          case "boolean":
            if (d) return false;
            if (null !== c) return !c.acceptsBooleans;
            a = a.toLowerCase().slice(0, 5);
            return "data-" !== a && "aria-" !== a;
          default:
            return false;
        }
      }
      function qa(a, b, c, d) {
        if (null === b || "undefined" === typeof b || pa(a, b, c, d)) return true;
        if (d) return false;
        if (null !== c) switch (c.type) {
          case 3:
            return !b;
          case 4:
            return false === b;
          case 5:
            return isNaN(b);
          case 6:
            return isNaN(b) || 1 > b;
        }
        return false;
      }
      function v(a, b, c, d, e, f, g) {
        this.acceptsBooleans = 2 === b || 3 === b || 4 === b;
        this.attributeName = d;
        this.attributeNamespace = e;
        this.mustUseProperty = c;
        this.propertyName = a;
        this.type = b;
        this.sanitizeURL = f;
        this.removeEmptyString = g;
      }
      var z = {};
      "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
        z[a] = new v(a, 0, false, a, null, false, false);
      });
      [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a) {
        var b = a[0];
        z[b] = new v(b, 1, false, a[1], null, false, false);
      });
      ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a) {
        z[a] = new v(a, 2, false, a.toLowerCase(), null, false, false);
      });
      ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a) {
        z[a] = new v(a, 2, false, a, null, false, false);
      });
      "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
        z[a] = new v(a, 3, false, a.toLowerCase(), null, false, false);
      });
      ["checked", "multiple", "muted", "selected"].forEach(function(a) {
        z[a] = new v(a, 3, true, a, null, false, false);
      });
      ["capture", "download"].forEach(function(a) {
        z[a] = new v(a, 4, false, a, null, false, false);
      });
      ["cols", "rows", "size", "span"].forEach(function(a) {
        z[a] = new v(a, 6, false, a, null, false, false);
      });
      ["rowSpan", "start"].forEach(function(a) {
        z[a] = new v(a, 5, false, a.toLowerCase(), null, false, false);
      });
      var ra = /[\-:]([a-z])/g;
      function sa(a) {
        return a[1].toUpperCase();
      }
      "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
        var b = a.replace(
          ra,
          sa
        );
        z[b] = new v(b, 1, false, a, null, false, false);
      });
      "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
        var b = a.replace(ra, sa);
        z[b] = new v(b, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
      });
      ["xml:base", "xml:lang", "xml:space"].forEach(function(a) {
        var b = a.replace(ra, sa);
        z[b] = new v(b, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
      });
      ["tabIndex", "crossOrigin"].forEach(function(a) {
        z[a] = new v(a, 1, false, a.toLowerCase(), null, false, false);
      });
      z.xlinkHref = new v("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
      ["src", "href", "action", "formAction"].forEach(function(a) {
        z[a] = new v(a, 1, false, a.toLowerCase(), null, true, true);
      });
      function ta(a, b, c, d) {
        var e = z.hasOwnProperty(b) ? z[b] : null;
        if (null !== e ? 0 !== e.type : d || !(2 < b.length) || "o" !== b[0] && "O" !== b[0] || "n" !== b[1] && "N" !== b[1]) qa(b, c, e, d) && (c = null), d || null === e ? oa(b) && (null === c ? a.removeAttribute(b) : a.setAttribute(b, "" + c)) : e.mustUseProperty ? a[e.propertyName] = null === c ? 3 === e.type ? false : "" : c : (b = e.attributeName, d = e.attributeNamespace, null === c ? a.removeAttribute(b) : (e = e.type, c = 3 === e || 4 === e && true === c ? "" : "" + c, d ? a.setAttributeNS(d, b, c) : a.setAttribute(b, c)));
      }
      var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
      var va = Symbol.for("react.element");
      var wa = Symbol.for("react.portal");
      var ya = Symbol.for("react.fragment");
      var za = Symbol.for("react.strict_mode");
      var Aa = Symbol.for("react.profiler");
      var Ba = Symbol.for("react.provider");
      var Ca = Symbol.for("react.context");
      var Da = Symbol.for("react.forward_ref");
      var Ea = Symbol.for("react.suspense");
      var Fa = Symbol.for("react.suspense_list");
      var Ga = Symbol.for("react.memo");
      var Ha = Symbol.for("react.lazy");
      Symbol.for("react.scope");
      Symbol.for("react.debug_trace_mode");
      var Ia = Symbol.for("react.offscreen");
      Symbol.for("react.legacy_hidden");
      Symbol.for("react.cache");
      Symbol.for("react.tracing_marker");
      var Ja = Symbol.iterator;
      function Ka(a) {
        if (null === a || "object" !== typeof a) return null;
        a = Ja && a[Ja] || a["@@iterator"];
        return "function" === typeof a ? a : null;
      }
      var A = Object.assign;
      var La;
      function Ma(a) {
        if (void 0 === La) try {
          throw Error();
        } catch (c) {
          var b = c.stack.trim().match(/\n( *(at )?)/);
          La = b && b[1] || "";
        }
        return "\n" + La + a;
      }
      var Na = false;
      function Oa(a, b) {
        if (!a || Na) return "";
        Na = true;
        var c = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          if (b) if (b = function() {
            throw Error();
          }, Object.defineProperty(b.prototype, "props", { set: function() {
            throw Error();
          } }), "object" === typeof Reflect && Reflect.construct) {
            try {
              Reflect.construct(b, []);
            } catch (l) {
              var d = l;
            }
            Reflect.construct(a, [], b);
          } else {
            try {
              b.call();
            } catch (l) {
              d = l;
            }
            a.call(b.prototype);
          }
          else {
            try {
              throw Error();
            } catch (l) {
              d = l;
            }
            a();
          }
        } catch (l) {
          if (l && d && "string" === typeof l.stack) {
            for (var e = l.stack.split("\n"), f = d.stack.split("\n"), g = e.length - 1, h = f.length - 1; 1 <= g && 0 <= h && e[g] !== f[h]; ) h--;
            for (; 1 <= g && 0 <= h; g--, h--) if (e[g] !== f[h]) {
              if (1 !== g || 1 !== h) {
                do
                  if (g--, h--, 0 > h || e[g] !== f[h]) {
                    var k = "\n" + e[g].replace(" at new ", " at ");
                    a.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", a.displayName));
                    return k;
                  }
                while (1 <= g && 0 <= h);
              }
              break;
            }
          }
        } finally {
          Na = false, Error.prepareStackTrace = c;
        }
        return (a = a ? a.displayName || a.name : "") ? Ma(a) : "";
      }
      function Pa(a) {
        switch (a.tag) {
          case 5:
            return Ma(a.type);
          case 16:
            return Ma("Lazy");
          case 13:
            return Ma("Suspense");
          case 19:
            return Ma("SuspenseList");
          case 0:
          case 2:
          case 15:
            return a = Oa(a.type, false), a;
          case 11:
            return a = Oa(a.type.render, false), a;
          case 1:
            return a = Oa(a.type, true), a;
          default:
            return "";
        }
      }
      function Qa(a) {
        if (null == a) return null;
        if ("function" === typeof a) return a.displayName || a.name || null;
        if ("string" === typeof a) return a;
        switch (a) {
          case ya:
            return "Fragment";
          case wa:
            return "Portal";
          case Aa:
            return "Profiler";
          case za:
            return "StrictMode";
          case Ea:
            return "Suspense";
          case Fa:
            return "SuspenseList";
        }
        if ("object" === typeof a) switch (a.$$typeof) {
          case Ca:
            return (a.displayName || "Context") + ".Consumer";
          case Ba:
            return (a._context.displayName || "Context") + ".Provider";
          case Da:
            var b = a.render;
            a = a.displayName;
            a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
            return a;
          case Ga:
            return b = a.displayName || null, null !== b ? b : Qa(a.type) || "Memo";
          case Ha:
            b = a._payload;
            a = a._init;
            try {
              return Qa(a(b));
            } catch (c) {
            }
        }
        return null;
      }
      function Ra(a) {
        var b = a.type;
        switch (a.tag) {
          case 24:
            return "Cache";
          case 9:
            return (b.displayName || "Context") + ".Consumer";
          case 10:
            return (b._context.displayName || "Context") + ".Provider";
          case 18:
            return "DehydratedFragment";
          case 11:
            return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
          case 7:
            return "Fragment";
          case 5:
            return b;
          case 4:
            return "Portal";
          case 3:
            return "Root";
          case 6:
            return "Text";
          case 16:
            return Qa(b);
          case 8:
            return b === za ? "StrictMode" : "Mode";
          case 22:
            return "Offscreen";
          case 12:
            return "Profiler";
          case 21:
            return "Scope";
          case 13:
            return "Suspense";
          case 19:
            return "SuspenseList";
          case 25:
            return "TracingMarker";
          case 1:
          case 0:
          case 17:
          case 2:
          case 14:
          case 15:
            if ("function" === typeof b) return b.displayName || b.name || null;
            if ("string" === typeof b) return b;
        }
        return null;
      }
      function Sa(a) {
        switch (typeof a) {
          case "boolean":
          case "number":
          case "string":
          case "undefined":
            return a;
          case "object":
            return a;
          default:
            return "";
        }
      }
      function Ta(a) {
        var b = a.type;
        return (a = a.nodeName) && "input" === a.toLowerCase() && ("checkbox" === b || "radio" === b);
      }
      function Ua(a) {
        var b = Ta(a) ? "checked" : "value", c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b), d = "" + a[b];
        if (!a.hasOwnProperty(b) && "undefined" !== typeof c && "function" === typeof c.get && "function" === typeof c.set) {
          var e = c.get, f = c.set;
          Object.defineProperty(a, b, { configurable: true, get: function() {
            return e.call(this);
          }, set: function(a2) {
            d = "" + a2;
            f.call(this, a2);
          } });
          Object.defineProperty(a, b, { enumerable: c.enumerable });
          return { getValue: function() {
            return d;
          }, setValue: function(a2) {
            d = "" + a2;
          }, stopTracking: function() {
            a._valueTracker = null;
            delete a[b];
          } };
        }
      }
      function Va(a) {
        a._valueTracker || (a._valueTracker = Ua(a));
      }
      function Wa(a) {
        if (!a) return false;
        var b = a._valueTracker;
        if (!b) return true;
        var c = b.getValue();
        var d = "";
        a && (d = Ta(a) ? a.checked ? "true" : "false" : a.value);
        a = d;
        return a !== c ? (b.setValue(a), true) : false;
      }
      function Xa(a) {
        a = a || ("undefined" !== typeof document ? document : void 0);
        if ("undefined" === typeof a) return null;
        try {
          return a.activeElement || a.body;
        } catch (b) {
          return a.body;
        }
      }
      function Ya(a, b) {
        var c = b.checked;
        return A({}, b, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: null != c ? c : a._wrapperState.initialChecked });
      }
      function Za(a, b) {
        var c = null == b.defaultValue ? "" : b.defaultValue, d = null != b.checked ? b.checked : b.defaultChecked;
        c = Sa(null != b.value ? b.value : c);
        a._wrapperState = { initialChecked: d, initialValue: c, controlled: "checkbox" === b.type || "radio" === b.type ? null != b.checked : null != b.value };
      }
      function ab(a, b) {
        b = b.checked;
        null != b && ta(a, "checked", b, false);
      }
      function bb(a, b) {
        ab(a, b);
        var c = Sa(b.value), d = b.type;
        if (null != c) if ("number" === d) {
          if (0 === c && "" === a.value || a.value != c) a.value = "" + c;
        } else a.value !== "" + c && (a.value = "" + c);
        else if ("submit" === d || "reset" === d) {
          a.removeAttribute("value");
          return;
        }
        b.hasOwnProperty("value") ? cb(a, b.type, c) : b.hasOwnProperty("defaultValue") && cb(a, b.type, Sa(b.defaultValue));
        null == b.checked && null != b.defaultChecked && (a.defaultChecked = !!b.defaultChecked);
      }
      function db(a, b, c) {
        if (b.hasOwnProperty("value") || b.hasOwnProperty("defaultValue")) {
          var d = b.type;
          if (!("submit" !== d && "reset" !== d || void 0 !== b.value && null !== b.value)) return;
          b = "" + a._wrapperState.initialValue;
          c || b === a.value || (a.value = b);
          a.defaultValue = b;
        }
        c = a.name;
        "" !== c && (a.name = "");
        a.defaultChecked = !!a._wrapperState.initialChecked;
        "" !== c && (a.name = c);
      }
      function cb(a, b, c) {
        if ("number" !== b || Xa(a.ownerDocument) !== a) null == c ? a.defaultValue = "" + a._wrapperState.initialValue : a.defaultValue !== "" + c && (a.defaultValue = "" + c);
      }
      var eb = Array.isArray;
      function fb(a, b, c, d) {
        a = a.options;
        if (b) {
          b = {};
          for (var e = 0; e < c.length; e++) b["$" + c[e]] = true;
          for (c = 0; c < a.length; c++) e = b.hasOwnProperty("$" + a[c].value), a[c].selected !== e && (a[c].selected = e), e && d && (a[c].defaultSelected = true);
        } else {
          c = "" + Sa(c);
          b = null;
          for (e = 0; e < a.length; e++) {
            if (a[e].value === c) {
              a[e].selected = true;
              d && (a[e].defaultSelected = true);
              return;
            }
            null !== b || a[e].disabled || (b = a[e]);
          }
          null !== b && (b.selected = true);
        }
      }
      function gb(a, b) {
        if (null != b.dangerouslySetInnerHTML) throw Error(p(91));
        return A({}, b, { value: void 0, defaultValue: void 0, children: "" + a._wrapperState.initialValue });
      }
      function hb(a, b) {
        var c = b.value;
        if (null == c) {
          c = b.children;
          b = b.defaultValue;
          if (null != c) {
            if (null != b) throw Error(p(92));
            if (eb(c)) {
              if (1 < c.length) throw Error(p(93));
              c = c[0];
            }
            b = c;
          }
          null == b && (b = "");
          c = b;
        }
        a._wrapperState = { initialValue: Sa(c) };
      }
      function ib(a, b) {
        var c = Sa(b.value), d = Sa(b.defaultValue);
        null != c && (c = "" + c, c !== a.value && (a.value = c), null == b.defaultValue && a.defaultValue !== c && (a.defaultValue = c));
        null != d && (a.defaultValue = "" + d);
      }
      function jb(a) {
        var b = a.textContent;
        b === a._wrapperState.initialValue && "" !== b && null !== b && (a.value = b);
      }
      function kb(a) {
        switch (a) {
          case "svg":
            return "http://www.w3.org/2000/svg";
          case "math":
            return "http://www.w3.org/1998/Math/MathML";
          default:
            return "http://www.w3.org/1999/xhtml";
        }
      }
      function lb(a, b) {
        return null == a || "http://www.w3.org/1999/xhtml" === a ? kb(b) : "http://www.w3.org/2000/svg" === a && "foreignObject" === b ? "http://www.w3.org/1999/xhtml" : a;
      }
      var mb;
      var nb = (function(a) {
        return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b, c, d, e) {
          MSApp.execUnsafeLocalFunction(function() {
            return a(b, c, d, e);
          });
        } : a;
      })(function(a, b) {
        if ("http://www.w3.org/2000/svg" !== a.namespaceURI || "innerHTML" in a) a.innerHTML = b;
        else {
          mb = mb || document.createElement("div");
          mb.innerHTML = "<svg>" + b.valueOf().toString() + "</svg>";
          for (b = mb.firstChild; a.firstChild; ) a.removeChild(a.firstChild);
          for (; b.firstChild; ) a.appendChild(b.firstChild);
        }
      });
      function ob(a, b) {
        if (b) {
          var c = a.firstChild;
          if (c && c === a.lastChild && 3 === c.nodeType) {
            c.nodeValue = b;
            return;
          }
        }
        a.textContent = b;
      }
      var pb = {
        animationIterationCount: true,
        aspectRatio: true,
        borderImageOutset: true,
        borderImageSlice: true,
        borderImageWidth: true,
        boxFlex: true,
        boxFlexGroup: true,
        boxOrdinalGroup: true,
        columnCount: true,
        columns: true,
        flex: true,
        flexGrow: true,
        flexPositive: true,
        flexShrink: true,
        flexNegative: true,
        flexOrder: true,
        gridArea: true,
        gridRow: true,
        gridRowEnd: true,
        gridRowSpan: true,
        gridRowStart: true,
        gridColumn: true,
        gridColumnEnd: true,
        gridColumnSpan: true,
        gridColumnStart: true,
        fontWeight: true,
        lineClamp: true,
        lineHeight: true,
        opacity: true,
        order: true,
        orphans: true,
        tabSize: true,
        widows: true,
        zIndex: true,
        zoom: true,
        fillOpacity: true,
        floodOpacity: true,
        stopOpacity: true,
        strokeDasharray: true,
        strokeDashoffset: true,
        strokeMiterlimit: true,
        strokeOpacity: true,
        strokeWidth: true
      };
      var qb = ["Webkit", "ms", "Moz", "O"];
      Object.keys(pb).forEach(function(a) {
        qb.forEach(function(b) {
          b = b + a.charAt(0).toUpperCase() + a.substring(1);
          pb[b] = pb[a];
        });
      });
      function rb(a, b, c) {
        return null == b || "boolean" === typeof b || "" === b ? "" : c || "number" !== typeof b || 0 === b || pb.hasOwnProperty(a) && pb[a] ? ("" + b).trim() : b + "px";
      }
      function sb(a, b) {
        a = a.style;
        for (var c in b) if (b.hasOwnProperty(c)) {
          var d = 0 === c.indexOf("--"), e = rb(c, b[c], d);
          "float" === c && (c = "cssFloat");
          d ? a.setProperty(c, e) : a[c] = e;
        }
      }
      var tb = A({ menuitem: true }, { area: true, base: true, br: true, col: true, embed: true, hr: true, img: true, input: true, keygen: true, link: true, meta: true, param: true, source: true, track: true, wbr: true });
      function ub(a, b) {
        if (b) {
          if (tb[a] && (null != b.children || null != b.dangerouslySetInnerHTML)) throw Error(p(137, a));
          if (null != b.dangerouslySetInnerHTML) {
            if (null != b.children) throw Error(p(60));
            if ("object" !== typeof b.dangerouslySetInnerHTML || !("__html" in b.dangerouslySetInnerHTML)) throw Error(p(61));
          }
          if (null != b.style && "object" !== typeof b.style) throw Error(p(62));
        }
      }
      function vb(a, b) {
        if (-1 === a.indexOf("-")) return "string" === typeof b.is;
        switch (a) {
          case "annotation-xml":
          case "color-profile":
          case "font-face":
          case "font-face-src":
          case "font-face-uri":
          case "font-face-format":
          case "font-face-name":
          case "missing-glyph":
            return false;
          default:
            return true;
        }
      }
      var wb = null;
      function xb(a) {
        a = a.target || a.srcElement || window;
        a.correspondingUseElement && (a = a.correspondingUseElement);
        return 3 === a.nodeType ? a.parentNode : a;
      }
      var yb = null;
      var zb = null;
      var Ab = null;
      function Bb(a) {
        if (a = Cb(a)) {
          if ("function" !== typeof yb) throw Error(p(280));
          var b = a.stateNode;
          b && (b = Db(b), yb(a.stateNode, a.type, b));
        }
      }
      function Eb(a) {
        zb ? Ab ? Ab.push(a) : Ab = [a] : zb = a;
      }
      function Fb() {
        if (zb) {
          var a = zb, b = Ab;
          Ab = zb = null;
          Bb(a);
          if (b) for (a = 0; a < b.length; a++) Bb(b[a]);
        }
      }
      function Gb(a, b) {
        return a(b);
      }
      function Hb() {
      }
      var Ib = false;
      function Jb(a, b, c) {
        if (Ib) return a(b, c);
        Ib = true;
        try {
          return Gb(a, b, c);
        } finally {
          if (Ib = false, null !== zb || null !== Ab) Hb(), Fb();
        }
      }
      function Kb(a, b) {
        var c = a.stateNode;
        if (null === c) return null;
        var d = Db(c);
        if (null === d) return null;
        c = d[b];
        a: switch (b) {
          case "onClick":
          case "onClickCapture":
          case "onDoubleClick":
          case "onDoubleClickCapture":
          case "onMouseDown":
          case "onMouseDownCapture":
          case "onMouseMove":
          case "onMouseMoveCapture":
          case "onMouseUp":
          case "onMouseUpCapture":
          case "onMouseEnter":
            (d = !d.disabled) || (a = a.type, d = !("button" === a || "input" === a || "select" === a || "textarea" === a));
            a = !d;
            break a;
          default:
            a = false;
        }
        if (a) return null;
        if (c && "function" !== typeof c) throw Error(p(231, b, typeof c));
        return c;
      }
      var Lb = false;
      if (ia) try {
        Mb = {};
        Object.defineProperty(Mb, "passive", { get: function() {
          Lb = true;
        } });
        window.addEventListener("test", Mb, Mb);
        window.removeEventListener("test", Mb, Mb);
      } catch (a) {
        Lb = false;
      }
      var Mb;
      function Nb(a, b, c, d, e, f, g, h, k) {
        var l = Array.prototype.slice.call(arguments, 3);
        try {
          b.apply(c, l);
        } catch (m) {
          this.onError(m);
        }
      }
      var Ob = false;
      var Pb = null;
      var Qb = false;
      var Rb = null;
      var Sb = { onError: function(a) {
        Ob = true;
        Pb = a;
      } };
      function Tb(a, b, c, d, e, f, g, h, k) {
        Ob = false;
        Pb = null;
        Nb.apply(Sb, arguments);
      }
      function Ub(a, b, c, d, e, f, g, h, k) {
        Tb.apply(this, arguments);
        if (Ob) {
          if (Ob) {
            var l = Pb;
            Ob = false;
            Pb = null;
          } else throw Error(p(198));
          Qb || (Qb = true, Rb = l);
        }
      }
      function Vb(a) {
        var b = a, c = a;
        if (a.alternate) for (; b.return; ) b = b.return;
        else {
          a = b;
          do
            b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
          while (a);
        }
        return 3 === b.tag ? c : null;
      }
      function Wb(a) {
        if (13 === a.tag) {
          var b = a.memoizedState;
          null === b && (a = a.alternate, null !== a && (b = a.memoizedState));
          if (null !== b) return b.dehydrated;
        }
        return null;
      }
      function Xb(a) {
        if (Vb(a) !== a) throw Error(p(188));
      }
      function Yb(a) {
        var b = a.alternate;
        if (!b) {
          b = Vb(a);
          if (null === b) throw Error(p(188));
          return b !== a ? null : a;
        }
        for (var c = a, d = b; ; ) {
          var e = c.return;
          if (null === e) break;
          var f = e.alternate;
          if (null === f) {
            d = e.return;
            if (null !== d) {
              c = d;
              continue;
            }
            break;
          }
          if (e.child === f.child) {
            for (f = e.child; f; ) {
              if (f === c) return Xb(e), a;
              if (f === d) return Xb(e), b;
              f = f.sibling;
            }
            throw Error(p(188));
          }
          if (c.return !== d.return) c = e, d = f;
          else {
            for (var g = false, h = e.child; h; ) {
              if (h === c) {
                g = true;
                c = e;
                d = f;
                break;
              }
              if (h === d) {
                g = true;
                d = e;
                c = f;
                break;
              }
              h = h.sibling;
            }
            if (!g) {
              for (h = f.child; h; ) {
                if (h === c) {
                  g = true;
                  c = f;
                  d = e;
                  break;
                }
                if (h === d) {
                  g = true;
                  d = f;
                  c = e;
                  break;
                }
                h = h.sibling;
              }
              if (!g) throw Error(p(189));
            }
          }
          if (c.alternate !== d) throw Error(p(190));
        }
        if (3 !== c.tag) throw Error(p(188));
        return c.stateNode.current === c ? a : b;
      }
      function Zb(a) {
        a = Yb(a);
        return null !== a ? $b(a) : null;
      }
      function $b(a) {
        if (5 === a.tag || 6 === a.tag) return a;
        for (a = a.child; null !== a; ) {
          var b = $b(a);
          if (null !== b) return b;
          a = a.sibling;
        }
        return null;
      }
      var ac = ca.unstable_scheduleCallback;
      var bc = ca.unstable_cancelCallback;
      var cc = ca.unstable_shouldYield;
      var dc = ca.unstable_requestPaint;
      var B = ca.unstable_now;
      var ec = ca.unstable_getCurrentPriorityLevel;
      var fc = ca.unstable_ImmediatePriority;
      var gc = ca.unstable_UserBlockingPriority;
      var hc = ca.unstable_NormalPriority;
      var ic = ca.unstable_LowPriority;
      var jc = ca.unstable_IdlePriority;
      var kc = null;
      var lc = null;
      function mc(a) {
        if (lc && "function" === typeof lc.onCommitFiberRoot) try {
          lc.onCommitFiberRoot(kc, a, void 0, 128 === (a.current.flags & 128));
        } catch (b) {
        }
      }
      var oc = Math.clz32 ? Math.clz32 : nc;
      var pc = Math.log;
      var qc = Math.LN2;
      function nc(a) {
        a >>>= 0;
        return 0 === a ? 32 : 31 - (pc(a) / qc | 0) | 0;
      }
      var rc = 64;
      var sc = 4194304;
      function tc(a) {
        switch (a & -a) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return a & 4194240;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return a & 130023424;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 1073741824;
          default:
            return a;
        }
      }
      function uc(a, b) {
        var c = a.pendingLanes;
        if (0 === c) return 0;
        var d = 0, e = a.suspendedLanes, f = a.pingedLanes, g = c & 268435455;
        if (0 !== g) {
          var h = g & ~e;
          0 !== h ? d = tc(h) : (f &= g, 0 !== f && (d = tc(f)));
        } else g = c & ~e, 0 !== g ? d = tc(g) : 0 !== f && (d = tc(f));
        if (0 === d) return 0;
        if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f = b & -b, e >= f || 16 === e && 0 !== (f & 4194240))) return b;
        0 !== (d & 4) && (d |= c & 16);
        b = a.entangledLanes;
        if (0 !== b) for (a = a.entanglements, b &= d; 0 < b; ) c = 31 - oc(b), e = 1 << c, d |= a[c], b &= ~e;
        return d;
      }
      function vc(a, b) {
        switch (a) {
          case 1:
          case 2:
          case 4:
            return b + 250;
          case 8:
          case 16:
          case 32:
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return b + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return -1;
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function wc(a, b) {
        for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f = a.pendingLanes; 0 < f; ) {
          var g = 31 - oc(f), h = 1 << g, k = e[g];
          if (-1 === k) {
            if (0 === (h & c) || 0 !== (h & d)) e[g] = vc(h, b);
          } else k <= b && (a.expiredLanes |= h);
          f &= ~h;
        }
      }
      function xc(a) {
        a = a.pendingLanes & -1073741825;
        return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
      }
      function yc() {
        var a = rc;
        rc <<= 1;
        0 === (rc & 4194240) && (rc = 64);
        return a;
      }
      function zc(a) {
        for (var b = [], c = 0; 31 > c; c++) b.push(a);
        return b;
      }
      function Ac(a, b, c) {
        a.pendingLanes |= b;
        536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
        a = a.eventTimes;
        b = 31 - oc(b);
        a[b] = c;
      }
      function Bc(a, b) {
        var c = a.pendingLanes & ~b;
        a.pendingLanes = b;
        a.suspendedLanes = 0;
        a.pingedLanes = 0;
        a.expiredLanes &= b;
        a.mutableReadLanes &= b;
        a.entangledLanes &= b;
        b = a.entanglements;
        var d = a.eventTimes;
        for (a = a.expirationTimes; 0 < c; ) {
          var e = 31 - oc(c), f = 1 << e;
          b[e] = 0;
          d[e] = -1;
          a[e] = -1;
          c &= ~f;
        }
      }
      function Cc(a, b) {
        var c = a.entangledLanes |= b;
        for (a = a.entanglements; c; ) {
          var d = 31 - oc(c), e = 1 << d;
          e & b | a[d] & b && (a[d] |= b);
          c &= ~e;
        }
      }
      var C = 0;
      function Dc(a) {
        a &= -a;
        return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
      }
      var Ec;
      var Fc;
      var Gc;
      var Hc;
      var Ic;
      var Jc = false;
      var Kc = [];
      var Lc = null;
      var Mc = null;
      var Nc = null;
      var Oc = /* @__PURE__ */ new Map();
      var Pc = /* @__PURE__ */ new Map();
      var Qc = [];
      var Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
      function Sc(a, b) {
        switch (a) {
          case "focusin":
          case "focusout":
            Lc = null;
            break;
          case "dragenter":
          case "dragleave":
            Mc = null;
            break;
          case "mouseover":
          case "mouseout":
            Nc = null;
            break;
          case "pointerover":
          case "pointerout":
            Oc.delete(b.pointerId);
            break;
          case "gotpointercapture":
          case "lostpointercapture":
            Pc.delete(b.pointerId);
        }
      }
      function Tc(a, b, c, d, e, f) {
        if (null === a || a.nativeEvent !== f) return a = { blockedOn: b, domEventName: c, eventSystemFlags: d, nativeEvent: f, targetContainers: [e] }, null !== b && (b = Cb(b), null !== b && Fc(b)), a;
        a.eventSystemFlags |= d;
        b = a.targetContainers;
        null !== e && -1 === b.indexOf(e) && b.push(e);
        return a;
      }
      function Uc(a, b, c, d, e) {
        switch (b) {
          case "focusin":
            return Lc = Tc(Lc, a, b, c, d, e), true;
          case "dragenter":
            return Mc = Tc(Mc, a, b, c, d, e), true;
          case "mouseover":
            return Nc = Tc(Nc, a, b, c, d, e), true;
          case "pointerover":
            var f = e.pointerId;
            Oc.set(f, Tc(Oc.get(f) || null, a, b, c, d, e));
            return true;
          case "gotpointercapture":
            return f = e.pointerId, Pc.set(f, Tc(Pc.get(f) || null, a, b, c, d, e)), true;
        }
        return false;
      }
      function Vc(a) {
        var b = Wc(a.target);
        if (null !== b) {
          var c = Vb(b);
          if (null !== c) {
            if (b = c.tag, 13 === b) {
              if (b = Wb(c), null !== b) {
                a.blockedOn = b;
                Ic(a.priority, function() {
                  Gc(c);
                });
                return;
              }
            } else if (3 === b && c.stateNode.current.memoizedState.isDehydrated) {
              a.blockedOn = 3 === c.tag ? c.stateNode.containerInfo : null;
              return;
            }
          }
        }
        a.blockedOn = null;
      }
      function Xc(a) {
        if (null !== a.blockedOn) return false;
        for (var b = a.targetContainers; 0 < b.length; ) {
          var c = Yc(a.domEventName, a.eventSystemFlags, b[0], a.nativeEvent);
          if (null === c) {
            c = a.nativeEvent;
            var d = new c.constructor(c.type, c);
            wb = d;
            c.target.dispatchEvent(d);
            wb = null;
          } else return b = Cb(c), null !== b && Fc(b), a.blockedOn = c, false;
          b.shift();
        }
        return true;
      }
      function Zc(a, b, c) {
        Xc(a) && c.delete(b);
      }
      function $c() {
        Jc = false;
        null !== Lc && Xc(Lc) && (Lc = null);
        null !== Mc && Xc(Mc) && (Mc = null);
        null !== Nc && Xc(Nc) && (Nc = null);
        Oc.forEach(Zc);
        Pc.forEach(Zc);
      }
      function ad(a, b) {
        a.blockedOn === b && (a.blockedOn = null, Jc || (Jc = true, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
      }
      function bd(a) {
        function b(b2) {
          return ad(b2, a);
        }
        if (0 < Kc.length) {
          ad(Kc[0], a);
          for (var c = 1; c < Kc.length; c++) {
            var d = Kc[c];
            d.blockedOn === a && (d.blockedOn = null);
          }
        }
        null !== Lc && ad(Lc, a);
        null !== Mc && ad(Mc, a);
        null !== Nc && ad(Nc, a);
        Oc.forEach(b);
        Pc.forEach(b);
        for (c = 0; c < Qc.length; c++) d = Qc[c], d.blockedOn === a && (d.blockedOn = null);
        for (; 0 < Qc.length && (c = Qc[0], null === c.blockedOn); ) Vc(c), null === c.blockedOn && Qc.shift();
      }
      var cd = ua.ReactCurrentBatchConfig;
      var dd = true;
      function ed(a, b, c, d) {
        var e = C, f = cd.transition;
        cd.transition = null;
        try {
          C = 1, fd(a, b, c, d);
        } finally {
          C = e, cd.transition = f;
        }
      }
      function gd(a, b, c, d) {
        var e = C, f = cd.transition;
        cd.transition = null;
        try {
          C = 4, fd(a, b, c, d);
        } finally {
          C = e, cd.transition = f;
        }
      }
      function fd(a, b, c, d) {
        if (dd) {
          var e = Yc(a, b, c, d);
          if (null === e) hd(a, b, d, id, c), Sc(a, d);
          else if (Uc(e, a, b, c, d)) d.stopPropagation();
          else if (Sc(a, d), b & 4 && -1 < Rc.indexOf(a)) {
            for (; null !== e; ) {
              var f = Cb(e);
              null !== f && Ec(f);
              f = Yc(a, b, c, d);
              null === f && hd(a, b, d, id, c);
              if (f === e) break;
              e = f;
            }
            null !== e && d.stopPropagation();
          } else hd(a, b, d, null, c);
        }
      }
      var id = null;
      function Yc(a, b, c, d) {
        id = null;
        a = xb(d);
        a = Wc(a);
        if (null !== a) if (b = Vb(a), null === b) a = null;
        else if (c = b.tag, 13 === c) {
          a = Wb(b);
          if (null !== a) return a;
          a = null;
        } else if (3 === c) {
          if (b.stateNode.current.memoizedState.isDehydrated) return 3 === b.tag ? b.stateNode.containerInfo : null;
          a = null;
        } else b !== a && (a = null);
        id = a;
        return null;
      }
      function jd(a) {
        switch (a) {
          case "cancel":
          case "click":
          case "close":
          case "contextmenu":
          case "copy":
          case "cut":
          case "auxclick":
          case "dblclick":
          case "dragend":
          case "dragstart":
          case "drop":
          case "focusin":
          case "focusout":
          case "input":
          case "invalid":
          case "keydown":
          case "keypress":
          case "keyup":
          case "mousedown":
          case "mouseup":
          case "paste":
          case "pause":
          case "play":
          case "pointercancel":
          case "pointerdown":
          case "pointerup":
          case "ratechange":
          case "reset":
          case "resize":
          case "seeked":
          case "submit":
          case "touchcancel":
          case "touchend":
          case "touchstart":
          case "volumechange":
          case "change":
          case "selectionchange":
          case "textInput":
          case "compositionstart":
          case "compositionend":
          case "compositionupdate":
          case "beforeblur":
          case "afterblur":
          case "beforeinput":
          case "blur":
          case "fullscreenchange":
          case "focus":
          case "hashchange":
          case "popstate":
          case "select":
          case "selectstart":
            return 1;
          case "drag":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "mousemove":
          case "mouseout":
          case "mouseover":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "scroll":
          case "toggle":
          case "touchmove":
          case "wheel":
          case "mouseenter":
          case "mouseleave":
          case "pointerenter":
          case "pointerleave":
            return 4;
          case "message":
            switch (ec()) {
              case fc:
                return 1;
              case gc:
                return 4;
              case hc:
              case ic:
                return 16;
              case jc:
                return 536870912;
              default:
                return 16;
            }
          default:
            return 16;
        }
      }
      var kd = null;
      var ld = null;
      var md = null;
      function nd() {
        if (md) return md;
        var a, b = ld, c = b.length, d, e = "value" in kd ? kd.value : kd.textContent, f = e.length;
        for (a = 0; a < c && b[a] === e[a]; a++) ;
        var g = c - a;
        for (d = 1; d <= g && b[c - d] === e[f - d]; d++) ;
        return md = e.slice(a, 1 < d ? 1 - d : void 0);
      }
      function od(a) {
        var b = a.keyCode;
        "charCode" in a ? (a = a.charCode, 0 === a && 13 === b && (a = 13)) : a = b;
        10 === a && (a = 13);
        return 32 <= a || 13 === a ? a : 0;
      }
      function pd() {
        return true;
      }
      function qd() {
        return false;
      }
      function rd(a) {
        function b(b2, d, e, f, g) {
          this._reactName = b2;
          this._targetInst = e;
          this.type = d;
          this.nativeEvent = f;
          this.target = g;
          this.currentTarget = null;
          for (var c in a) a.hasOwnProperty(c) && (b2 = a[c], this[c] = b2 ? b2(f) : f[c]);
          this.isDefaultPrevented = (null != f.defaultPrevented ? f.defaultPrevented : false === f.returnValue) ? pd : qd;
          this.isPropagationStopped = qd;
          return this;
        }
        A(b.prototype, { preventDefault: function() {
          this.defaultPrevented = true;
          var a2 = this.nativeEvent;
          a2 && (a2.preventDefault ? a2.preventDefault() : "unknown" !== typeof a2.returnValue && (a2.returnValue = false), this.isDefaultPrevented = pd);
        }, stopPropagation: function() {
          var a2 = this.nativeEvent;
          a2 && (a2.stopPropagation ? a2.stopPropagation() : "unknown" !== typeof a2.cancelBubble && (a2.cancelBubble = true), this.isPropagationStopped = pd);
        }, persist: function() {
        }, isPersistent: pd });
        return b;
      }
      var sd = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(a) {
        return a.timeStamp || Date.now();
      }, defaultPrevented: 0, isTrusted: 0 };
      var td = rd(sd);
      var ud = A({}, sd, { view: 0, detail: 0 });
      var vd = rd(ud);
      var wd;
      var xd;
      var yd;
      var Ad = A({}, ud, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: zd, button: 0, buttons: 0, relatedTarget: function(a) {
        return void 0 === a.relatedTarget ? a.fromElement === a.srcElement ? a.toElement : a.fromElement : a.relatedTarget;
      }, movementX: function(a) {
        if ("movementX" in a) return a.movementX;
        a !== yd && (yd && "mousemove" === a.type ? (wd = a.screenX - yd.screenX, xd = a.screenY - yd.screenY) : xd = wd = 0, yd = a);
        return wd;
      }, movementY: function(a) {
        return "movementY" in a ? a.movementY : xd;
      } });
      var Bd = rd(Ad);
      var Cd = A({}, Ad, { dataTransfer: 0 });
      var Dd = rd(Cd);
      var Ed = A({}, ud, { relatedTarget: 0 });
      var Fd = rd(Ed);
      var Gd = A({}, sd, { animationName: 0, elapsedTime: 0, pseudoElement: 0 });
      var Hd = rd(Gd);
      var Id = A({}, sd, { clipboardData: function(a) {
        return "clipboardData" in a ? a.clipboardData : window.clipboardData;
      } });
      var Jd = rd(Id);
      var Kd = A({}, sd, { data: 0 });
      var Ld = rd(Kd);
      var Md = {
        Esc: "Escape",
        Spacebar: " ",
        Left: "ArrowLeft",
        Up: "ArrowUp",
        Right: "ArrowRight",
        Down: "ArrowDown",
        Del: "Delete",
        Win: "OS",
        Menu: "ContextMenu",
        Apps: "ContextMenu",
        Scroll: "ScrollLock",
        MozPrintableKey: "Unidentified"
      };
      var Nd = {
        8: "Backspace",
        9: "Tab",
        12: "Clear",
        13: "Enter",
        16: "Shift",
        17: "Control",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Escape",
        32: " ",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        45: "Insert",
        46: "Delete",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        144: "NumLock",
        145: "ScrollLock",
        224: "Meta"
      };
      var Od = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
      function Pd(a) {
        var b = this.nativeEvent;
        return b.getModifierState ? b.getModifierState(a) : (a = Od[a]) ? !!b[a] : false;
      }
      function zd() {
        return Pd;
      }
      var Qd = A({}, ud, { key: function(a) {
        if (a.key) {
          var b = Md[a.key] || a.key;
          if ("Unidentified" !== b) return b;
        }
        return "keypress" === a.type ? (a = od(a), 13 === a ? "Enter" : String.fromCharCode(a)) : "keydown" === a.type || "keyup" === a.type ? Nd[a.keyCode] || "Unidentified" : "";
      }, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: zd, charCode: function(a) {
        return "keypress" === a.type ? od(a) : 0;
      }, keyCode: function(a) {
        return "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
      }, which: function(a) {
        return "keypress" === a.type ? od(a) : "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
      } });
      var Rd = rd(Qd);
      var Sd = A({}, Ad, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 });
      var Td = rd(Sd);
      var Ud = A({}, ud, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: zd });
      var Vd = rd(Ud);
      var Wd = A({}, sd, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 });
      var Xd = rd(Wd);
      var Yd = A({}, Ad, {
        deltaX: function(a) {
          return "deltaX" in a ? a.deltaX : "wheelDeltaX" in a ? -a.wheelDeltaX : 0;
        },
        deltaY: function(a) {
          return "deltaY" in a ? a.deltaY : "wheelDeltaY" in a ? -a.wheelDeltaY : "wheelDelta" in a ? -a.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0
      });
      var Zd = rd(Yd);
      var $d = [9, 13, 27, 32];
      var ae = ia && "CompositionEvent" in window;
      var be = null;
      ia && "documentMode" in document && (be = document.documentMode);
      var ce = ia && "TextEvent" in window && !be;
      var de = ia && (!ae || be && 8 < be && 11 >= be);
      var ee = String.fromCharCode(32);
      var fe = false;
      function ge(a, b) {
        switch (a) {
          case "keyup":
            return -1 !== $d.indexOf(b.keyCode);
          case "keydown":
            return 229 !== b.keyCode;
          case "keypress":
          case "mousedown":
          case "focusout":
            return true;
          default:
            return false;
        }
      }
      function he(a) {
        a = a.detail;
        return "object" === typeof a && "data" in a ? a.data : null;
      }
      var ie = false;
      function je(a, b) {
        switch (a) {
          case "compositionend":
            return he(b);
          case "keypress":
            if (32 !== b.which) return null;
            fe = true;
            return ee;
          case "textInput":
            return a = b.data, a === ee && fe ? null : a;
          default:
            return null;
        }
      }
      function ke(a, b) {
        if (ie) return "compositionend" === a || !ae && ge(a, b) ? (a = nd(), md = ld = kd = null, ie = false, a) : null;
        switch (a) {
          case "paste":
            return null;
          case "keypress":
            if (!(b.ctrlKey || b.altKey || b.metaKey) || b.ctrlKey && b.altKey) {
              if (b.char && 1 < b.char.length) return b.char;
              if (b.which) return String.fromCharCode(b.which);
            }
            return null;
          case "compositionend":
            return de && "ko" !== b.locale ? null : b.data;
          default:
            return null;
        }
      }
      var le = { color: true, date: true, datetime: true, "datetime-local": true, email: true, month: true, number: true, password: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true };
      function me(a) {
        var b = a && a.nodeName && a.nodeName.toLowerCase();
        return "input" === b ? !!le[a.type] : "textarea" === b ? true : false;
      }
      function ne(a, b, c, d) {
        Eb(d);
        b = oe(b, "onChange");
        0 < b.length && (c = new td("onChange", "change", null, c, d), a.push({ event: c, listeners: b }));
      }
      var pe = null;
      var qe = null;
      function re(a) {
        se(a, 0);
      }
      function te(a) {
        var b = ue(a);
        if (Wa(b)) return a;
      }
      function ve(a, b) {
        if ("change" === a) return b;
      }
      var we = false;
      if (ia) {
        if (ia) {
          ye = "oninput" in document;
          if (!ye) {
            ze = document.createElement("div");
            ze.setAttribute("oninput", "return;");
            ye = "function" === typeof ze.oninput;
          }
          xe = ye;
        } else xe = false;
        we = xe && (!document.documentMode || 9 < document.documentMode);
      }
      var xe;
      var ye;
      var ze;
      function Ae() {
        pe && (pe.detachEvent("onpropertychange", Be), qe = pe = null);
      }
      function Be(a) {
        if ("value" === a.propertyName && te(qe)) {
          var b = [];
          ne(b, qe, a, xb(a));
          Jb(re, b);
        }
      }
      function Ce(a, b, c) {
        "focusin" === a ? (Ae(), pe = b, qe = c, pe.attachEvent("onpropertychange", Be)) : "focusout" === a && Ae();
      }
      function De(a) {
        if ("selectionchange" === a || "keyup" === a || "keydown" === a) return te(qe);
      }
      function Ee(a, b) {
        if ("click" === a) return te(b);
      }
      function Fe(a, b) {
        if ("input" === a || "change" === a) return te(b);
      }
      function Ge(a, b) {
        return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
      }
      var He = "function" === typeof Object.is ? Object.is : Ge;
      function Ie(a, b) {
        if (He(a, b)) return true;
        if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
        var c = Object.keys(a), d = Object.keys(b);
        if (c.length !== d.length) return false;
        for (d = 0; d < c.length; d++) {
          var e = c[d];
          if (!ja.call(b, e) || !He(a[e], b[e])) return false;
        }
        return true;
      }
      function Je(a) {
        for (; a && a.firstChild; ) a = a.firstChild;
        return a;
      }
      function Ke(a, b) {
        var c = Je(a);
        a = 0;
        for (var d; c; ) {
          if (3 === c.nodeType) {
            d = a + c.textContent.length;
            if (a <= b && d >= b) return { node: c, offset: b - a };
            a = d;
          }
          a: {
            for (; c; ) {
              if (c.nextSibling) {
                c = c.nextSibling;
                break a;
              }
              c = c.parentNode;
            }
            c = void 0;
          }
          c = Je(c);
        }
      }
      function Le(a, b) {
        return a && b ? a === b ? true : a && 3 === a.nodeType ? false : b && 3 === b.nodeType ? Le(a, b.parentNode) : "contains" in a ? a.contains(b) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b) & 16) : false : false;
      }
      function Me() {
        for (var a = window, b = Xa(); b instanceof a.HTMLIFrameElement; ) {
          try {
            var c = "string" === typeof b.contentWindow.location.href;
          } catch (d) {
            c = false;
          }
          if (c) a = b.contentWindow;
          else break;
          b = Xa(a.document);
        }
        return b;
      }
      function Ne(a) {
        var b = a && a.nodeName && a.nodeName.toLowerCase();
        return b && ("input" === b && ("text" === a.type || "search" === a.type || "tel" === a.type || "url" === a.type || "password" === a.type) || "textarea" === b || "true" === a.contentEditable);
      }
      function Oe(a) {
        var b = Me(), c = a.focusedElem, d = a.selectionRange;
        if (b !== c && c && c.ownerDocument && Le(c.ownerDocument.documentElement, c)) {
          if (null !== d && Ne(c)) {
            if (b = d.start, a = d.end, void 0 === a && (a = b), "selectionStart" in c) c.selectionStart = b, c.selectionEnd = Math.min(a, c.value.length);
            else if (a = (b = c.ownerDocument || document) && b.defaultView || window, a.getSelection) {
              a = a.getSelection();
              var e = c.textContent.length, f = Math.min(d.start, e);
              d = void 0 === d.end ? f : Math.min(d.end, e);
              !a.extend && f > d && (e = d, d = f, f = e);
              e = Ke(c, f);
              var g = Ke(
                c,
                d
              );
              e && g && (1 !== a.rangeCount || a.anchorNode !== e.node || a.anchorOffset !== e.offset || a.focusNode !== g.node || a.focusOffset !== g.offset) && (b = b.createRange(), b.setStart(e.node, e.offset), a.removeAllRanges(), f > d ? (a.addRange(b), a.extend(g.node, g.offset)) : (b.setEnd(g.node, g.offset), a.addRange(b)));
            }
          }
          b = [];
          for (a = c; a = a.parentNode; ) 1 === a.nodeType && b.push({ element: a, left: a.scrollLeft, top: a.scrollTop });
          "function" === typeof c.focus && c.focus();
          for (c = 0; c < b.length; c++) a = b[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
        }
      }
      var Pe = ia && "documentMode" in document && 11 >= document.documentMode;
      var Qe = null;
      var Re = null;
      var Se = null;
      var Te = false;
      function Ue(a, b, c) {
        var d = c.window === c ? c.document : 9 === c.nodeType ? c : c.ownerDocument;
        Te || null == Qe || Qe !== Xa(d) || (d = Qe, "selectionStart" in d && Ne(d) ? d = { start: d.selectionStart, end: d.selectionEnd } : (d = (d.ownerDocument && d.ownerDocument.defaultView || window).getSelection(), d = { anchorNode: d.anchorNode, anchorOffset: d.anchorOffset, focusNode: d.focusNode, focusOffset: d.focusOffset }), Se && Ie(Se, d) || (Se = d, d = oe(Re, "onSelect"), 0 < d.length && (b = new td("onSelect", "select", null, b, c), a.push({ event: b, listeners: d }), b.target = Qe)));
      }
      function Ve(a, b) {
        var c = {};
        c[a.toLowerCase()] = b.toLowerCase();
        c["Webkit" + a] = "webkit" + b;
        c["Moz" + a] = "moz" + b;
        return c;
      }
      var We = { animationend: Ve("Animation", "AnimationEnd"), animationiteration: Ve("Animation", "AnimationIteration"), animationstart: Ve("Animation", "AnimationStart"), transitionend: Ve("Transition", "TransitionEnd") };
      var Xe = {};
      var Ye = {};
      ia && (Ye = document.createElement("div").style, "AnimationEvent" in window || (delete We.animationend.animation, delete We.animationiteration.animation, delete We.animationstart.animation), "TransitionEvent" in window || delete We.transitionend.transition);
      function Ze(a) {
        if (Xe[a]) return Xe[a];
        if (!We[a]) return a;
        var b = We[a], c;
        for (c in b) if (b.hasOwnProperty(c) && c in Ye) return Xe[a] = b[c];
        return a;
      }
      var $e = Ze("animationend");
      var af = Ze("animationiteration");
      var bf = Ze("animationstart");
      var cf = Ze("transitionend");
      var df = /* @__PURE__ */ new Map();
      var ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
      function ff(a, b) {
        df.set(a, b);
        fa(b, [a]);
      }
      for (gf = 0; gf < ef.length; gf++) {
        hf = ef[gf], jf = hf.toLowerCase(), kf = hf[0].toUpperCase() + hf.slice(1);
        ff(jf, "on" + kf);
      }
      var hf;
      var jf;
      var kf;
      var gf;
      ff($e, "onAnimationEnd");
      ff(af, "onAnimationIteration");
      ff(bf, "onAnimationStart");
      ff("dblclick", "onDoubleClick");
      ff("focusin", "onFocus");
      ff("focusout", "onBlur");
      ff(cf, "onTransitionEnd");
      ha("onMouseEnter", ["mouseout", "mouseover"]);
      ha("onMouseLeave", ["mouseout", "mouseover"]);
      ha("onPointerEnter", ["pointerout", "pointerover"]);
      ha("onPointerLeave", ["pointerout", "pointerover"]);
      fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
      fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
      fa("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
      fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
      fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
      fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
      var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" ");
      var mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
      function nf(a, b, c) {
        var d = a.type || "unknown-event";
        a.currentTarget = c;
        Ub(d, b, void 0, a);
        a.currentTarget = null;
      }
      function se(a, b) {
        b = 0 !== (b & 4);
        for (var c = 0; c < a.length; c++) {
          var d = a[c], e = d.event;
          d = d.listeners;
          a: {
            var f = void 0;
            if (b) for (var g = d.length - 1; 0 <= g; g--) {
              var h = d[g], k = h.instance, l = h.currentTarget;
              h = h.listener;
              if (k !== f && e.isPropagationStopped()) break a;
              nf(e, h, l);
              f = k;
            }
            else for (g = 0; g < d.length; g++) {
              h = d[g];
              k = h.instance;
              l = h.currentTarget;
              h = h.listener;
              if (k !== f && e.isPropagationStopped()) break a;
              nf(e, h, l);
              f = k;
            }
          }
        }
        if (Qb) throw a = Rb, Qb = false, Rb = null, a;
      }
      function D(a, b) {
        var c = b[of];
        void 0 === c && (c = b[of] = /* @__PURE__ */ new Set());
        var d = a + "__bubble";
        c.has(d) || (pf(b, a, 2, false), c.add(d));
      }
      function qf(a, b, c) {
        var d = 0;
        b && (d |= 4);
        pf(c, a, d, b);
      }
      var rf = "_reactListening" + Math.random().toString(36).slice(2);
      function sf(a) {
        if (!a[rf]) {
          a[rf] = true;
          da.forEach(function(b2) {
            "selectionchange" !== b2 && (mf.has(b2) || qf(b2, false, a), qf(b2, true, a));
          });
          var b = 9 === a.nodeType ? a : a.ownerDocument;
          null === b || b[rf] || (b[rf] = true, qf("selectionchange", false, b));
        }
      }
      function pf(a, b, c, d) {
        switch (jd(b)) {
          case 1:
            var e = ed;
            break;
          case 4:
            e = gd;
            break;
          default:
            e = fd;
        }
        c = e.bind(null, b, c, a);
        e = void 0;
        !Lb || "touchstart" !== b && "touchmove" !== b && "wheel" !== b || (e = true);
        d ? void 0 !== e ? a.addEventListener(b, c, { capture: true, passive: e }) : a.addEventListener(b, c, true) : void 0 !== e ? a.addEventListener(b, c, { passive: e }) : a.addEventListener(b, c, false);
      }
      function hd(a, b, c, d, e) {
        var f = d;
        if (0 === (b & 1) && 0 === (b & 2) && null !== d) a: for (; ; ) {
          if (null === d) return;
          var g = d.tag;
          if (3 === g || 4 === g) {
            var h = d.stateNode.containerInfo;
            if (h === e || 8 === h.nodeType && h.parentNode === e) break;
            if (4 === g) for (g = d.return; null !== g; ) {
              var k = g.tag;
              if (3 === k || 4 === k) {
                if (k = g.stateNode.containerInfo, k === e || 8 === k.nodeType && k.parentNode === e) return;
              }
              g = g.return;
            }
            for (; null !== h; ) {
              g = Wc(h);
              if (null === g) return;
              k = g.tag;
              if (5 === k || 6 === k) {
                d = f = g;
                continue a;
              }
              h = h.parentNode;
            }
          }
          d = d.return;
        }
        Jb(function() {
          var d2 = f, e2 = xb(c), g2 = [];
          a: {
            var h2 = df.get(a);
            if (void 0 !== h2) {
              var k2 = td, n = a;
              switch (a) {
                case "keypress":
                  if (0 === od(c)) break a;
                case "keydown":
                case "keyup":
                  k2 = Rd;
                  break;
                case "focusin":
                  n = "focus";
                  k2 = Fd;
                  break;
                case "focusout":
                  n = "blur";
                  k2 = Fd;
                  break;
                case "beforeblur":
                case "afterblur":
                  k2 = Fd;
                  break;
                case "click":
                  if (2 === c.button) break a;
                case "auxclick":
                case "dblclick":
                case "mousedown":
                case "mousemove":
                case "mouseup":
                case "mouseout":
                case "mouseover":
                case "contextmenu":
                  k2 = Bd;
                  break;
                case "drag":
                case "dragend":
                case "dragenter":
                case "dragexit":
                case "dragleave":
                case "dragover":
                case "dragstart":
                case "drop":
                  k2 = Dd;
                  break;
                case "touchcancel":
                case "touchend":
                case "touchmove":
                case "touchstart":
                  k2 = Vd;
                  break;
                case $e:
                case af:
                case bf:
                  k2 = Hd;
                  break;
                case cf:
                  k2 = Xd;
                  break;
                case "scroll":
                  k2 = vd;
                  break;
                case "wheel":
                  k2 = Zd;
                  break;
                case "copy":
                case "cut":
                case "paste":
                  k2 = Jd;
                  break;
                case "gotpointercapture":
                case "lostpointercapture":
                case "pointercancel":
                case "pointerdown":
                case "pointermove":
                case "pointerout":
                case "pointerover":
                case "pointerup":
                  k2 = Td;
              }
              var t = 0 !== (b & 4), J = !t && "scroll" === a, x = t ? null !== h2 ? h2 + "Capture" : null : h2;
              t = [];
              for (var w = d2, u; null !== w; ) {
                u = w;
                var F = u.stateNode;
                5 === u.tag && null !== F && (u = F, null !== x && (F = Kb(w, x), null != F && t.push(tf(w, F, u))));
                if (J) break;
                w = w.return;
              }
              0 < t.length && (h2 = new k2(h2, n, null, c, e2), g2.push({ event: h2, listeners: t }));
            }
          }
          if (0 === (b & 7)) {
            a: {
              h2 = "mouseover" === a || "pointerover" === a;
              k2 = "mouseout" === a || "pointerout" === a;
              if (h2 && c !== wb && (n = c.relatedTarget || c.fromElement) && (Wc(n) || n[uf])) break a;
              if (k2 || h2) {
                h2 = e2.window === e2 ? e2 : (h2 = e2.ownerDocument) ? h2.defaultView || h2.parentWindow : window;
                if (k2) {
                  if (n = c.relatedTarget || c.toElement, k2 = d2, n = n ? Wc(n) : null, null !== n && (J = Vb(n), n !== J || 5 !== n.tag && 6 !== n.tag)) n = null;
                } else k2 = null, n = d2;
                if (k2 !== n) {
                  t = Bd;
                  F = "onMouseLeave";
                  x = "onMouseEnter";
                  w = "mouse";
                  if ("pointerout" === a || "pointerover" === a) t = Td, F = "onPointerLeave", x = "onPointerEnter", w = "pointer";
                  J = null == k2 ? h2 : ue(k2);
                  u = null == n ? h2 : ue(n);
                  h2 = new t(F, w + "leave", k2, c, e2);
                  h2.target = J;
                  h2.relatedTarget = u;
                  F = null;
                  Wc(e2) === d2 && (t = new t(x, w + "enter", n, c, e2), t.target = u, t.relatedTarget = J, F = t);
                  J = F;
                  if (k2 && n) b: {
                    t = k2;
                    x = n;
                    w = 0;
                    for (u = t; u; u = vf(u)) w++;
                    u = 0;
                    for (F = x; F; F = vf(F)) u++;
                    for (; 0 < w - u; ) t = vf(t), w--;
                    for (; 0 < u - w; ) x = vf(x), u--;
                    for (; w--; ) {
                      if (t === x || null !== x && t === x.alternate) break b;
                      t = vf(t);
                      x = vf(x);
                    }
                    t = null;
                  }
                  else t = null;
                  null !== k2 && wf(g2, h2, k2, t, false);
                  null !== n && null !== J && wf(g2, J, n, t, true);
                }
              }
            }
            a: {
              h2 = d2 ? ue(d2) : window;
              k2 = h2.nodeName && h2.nodeName.toLowerCase();
              if ("select" === k2 || "input" === k2 && "file" === h2.type) var na = ve;
              else if (me(h2)) if (we) na = Fe;
              else {
                na = De;
                var xa = Ce;
              }
              else (k2 = h2.nodeName) && "input" === k2.toLowerCase() && ("checkbox" === h2.type || "radio" === h2.type) && (na = Ee);
              if (na && (na = na(a, d2))) {
                ne(g2, na, c, e2);
                break a;
              }
              xa && xa(a, h2, d2);
              "focusout" === a && (xa = h2._wrapperState) && xa.controlled && "number" === h2.type && cb(h2, "number", h2.value);
            }
            xa = d2 ? ue(d2) : window;
            switch (a) {
              case "focusin":
                if (me(xa) || "true" === xa.contentEditable) Qe = xa, Re = d2, Se = null;
                break;
              case "focusout":
                Se = Re = Qe = null;
                break;
              case "mousedown":
                Te = true;
                break;
              case "contextmenu":
              case "mouseup":
              case "dragend":
                Te = false;
                Ue(g2, c, e2);
                break;
              case "selectionchange":
                if (Pe) break;
              case "keydown":
              case "keyup":
                Ue(g2, c, e2);
            }
            var $a;
            if (ae) b: {
              switch (a) {
                case "compositionstart":
                  var ba = "onCompositionStart";
                  break b;
                case "compositionend":
                  ba = "onCompositionEnd";
                  break b;
                case "compositionupdate":
                  ba = "onCompositionUpdate";
                  break b;
              }
              ba = void 0;
            }
            else ie ? ge(a, c) && (ba = "onCompositionEnd") : "keydown" === a && 229 === c.keyCode && (ba = "onCompositionStart");
            ba && (de && "ko" !== c.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e2, ld = "value" in kd ? kd.value : kd.textContent, ie = true)), xa = oe(d2, ba), 0 < xa.length && (ba = new Ld(ba, a, null, c, e2), g2.push({ event: ba, listeners: xa }), $a ? ba.data = $a : ($a = he(c), null !== $a && (ba.data = $a))));
            if ($a = ce ? je(a, c) : ke(a, c)) d2 = oe(d2, "onBeforeInput"), 0 < d2.length && (e2 = new Ld("onBeforeInput", "beforeinput", null, c, e2), g2.push({ event: e2, listeners: d2 }), e2.data = $a);
          }
          se(g2, b);
        });
      }
      function tf(a, b, c) {
        return { instance: a, listener: b, currentTarget: c };
      }
      function oe(a, b) {
        for (var c = b + "Capture", d = []; null !== a; ) {
          var e = a, f = e.stateNode;
          5 === e.tag && null !== f && (e = f, f = Kb(a, c), null != f && d.unshift(tf(a, f, e)), f = Kb(a, b), null != f && d.push(tf(a, f, e)));
          a = a.return;
        }
        return d;
      }
      function vf(a) {
        if (null === a) return null;
        do
          a = a.return;
        while (a && 5 !== a.tag);
        return a ? a : null;
      }
      function wf(a, b, c, d, e) {
        for (var f = b._reactName, g = []; null !== c && c !== d; ) {
          var h = c, k = h.alternate, l = h.stateNode;
          if (null !== k && k === d) break;
          5 === h.tag && null !== l && (h = l, e ? (k = Kb(c, f), null != k && g.unshift(tf(c, k, h))) : e || (k = Kb(c, f), null != k && g.push(tf(c, k, h))));
          c = c.return;
        }
        0 !== g.length && a.push({ event: b, listeners: g });
      }
      var xf = /\r\n?/g;
      var yf = /\u0000|\uFFFD/g;
      function zf(a) {
        return ("string" === typeof a ? a : "" + a).replace(xf, "\n").replace(yf, "");
      }
      function Af(a, b, c) {
        b = zf(b);
        if (zf(a) !== b && c) throw Error(p(425));
      }
      function Bf() {
      }
      var Cf = null;
      var Df = null;
      function Ef(a, b) {
        return "textarea" === a || "noscript" === a || "string" === typeof b.children || "number" === typeof b.children || "object" === typeof b.dangerouslySetInnerHTML && null !== b.dangerouslySetInnerHTML && null != b.dangerouslySetInnerHTML.__html;
      }
      var Ff = "function" === typeof setTimeout ? setTimeout : void 0;
      var Gf = "function" === typeof clearTimeout ? clearTimeout : void 0;
      var Hf = "function" === typeof Promise ? Promise : void 0;
      var Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a) {
        return Hf.resolve(null).then(a).catch(If);
      } : Ff;
      function If(a) {
        setTimeout(function() {
          throw a;
        });
      }
      function Kf(a, b) {
        var c = b, d = 0;
        do {
          var e = c.nextSibling;
          a.removeChild(c);
          if (e && 8 === e.nodeType) if (c = e.data, "/$" === c) {
            if (0 === d) {
              a.removeChild(e);
              bd(b);
              return;
            }
            d--;
          } else "$" !== c && "$?" !== c && "$!" !== c || d++;
          c = e;
        } while (c);
        bd(b);
      }
      function Lf(a) {
        for (; null != a; a = a.nextSibling) {
          var b = a.nodeType;
          if (1 === b || 3 === b) break;
          if (8 === b) {
            b = a.data;
            if ("$" === b || "$!" === b || "$?" === b) break;
            if ("/$" === b) return null;
          }
        }
        return a;
      }
      function Mf(a) {
        a = a.previousSibling;
        for (var b = 0; a; ) {
          if (8 === a.nodeType) {
            var c = a.data;
            if ("$" === c || "$!" === c || "$?" === c) {
              if (0 === b) return a;
              b--;
            } else "/$" === c && b++;
          }
          a = a.previousSibling;
        }
        return null;
      }
      var Nf = Math.random().toString(36).slice(2);
      var Of = "__reactFiber$" + Nf;
      var Pf = "__reactProps$" + Nf;
      var uf = "__reactContainer$" + Nf;
      var of = "__reactEvents$" + Nf;
      var Qf = "__reactListeners$" + Nf;
      var Rf = "__reactHandles$" + Nf;
      function Wc(a) {
        var b = a[Of];
        if (b) return b;
        for (var c = a.parentNode; c; ) {
          if (b = c[uf] || c[Of]) {
            c = b.alternate;
            if (null !== b.child || null !== c && null !== c.child) for (a = Mf(a); null !== a; ) {
              if (c = a[Of]) return c;
              a = Mf(a);
            }
            return b;
          }
          a = c;
          c = a.parentNode;
        }
        return null;
      }
      function Cb(a) {
        a = a[Of] || a[uf];
        return !a || 5 !== a.tag && 6 !== a.tag && 13 !== a.tag && 3 !== a.tag ? null : a;
      }
      function ue(a) {
        if (5 === a.tag || 6 === a.tag) return a.stateNode;
        throw Error(p(33));
      }
      function Db(a) {
        return a[Pf] || null;
      }
      var Sf = [];
      var Tf = -1;
      function Uf(a) {
        return { current: a };
      }
      function E(a) {
        0 > Tf || (a.current = Sf[Tf], Sf[Tf] = null, Tf--);
      }
      function G(a, b) {
        Tf++;
        Sf[Tf] = a.current;
        a.current = b;
      }
      var Vf = {};
      var H = Uf(Vf);
      var Wf = Uf(false);
      var Xf = Vf;
      function Yf(a, b) {
        var c = a.type.contextTypes;
        if (!c) return Vf;
        var d = a.stateNode;
        if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
        var e = {}, f;
        for (f in c) e[f] = b[f];
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
        return e;
      }
      function Zf(a) {
        a = a.childContextTypes;
        return null !== a && void 0 !== a;
      }
      function $f() {
        E(Wf);
        E(H);
      }
      function ag(a, b, c) {
        if (H.current !== Vf) throw Error(p(168));
        G(H, b);
        G(Wf, c);
      }
      function bg(a, b, c) {
        var d = a.stateNode;
        b = b.childContextTypes;
        if ("function" !== typeof d.getChildContext) return c;
        d = d.getChildContext();
        for (var e in d) if (!(e in b)) throw Error(p(108, Ra(a) || "Unknown", e));
        return A({}, c, d);
      }
      function cg(a) {
        a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || Vf;
        Xf = H.current;
        G(H, a);
        G(Wf, Wf.current);
        return true;
      }
      function dg(a, b, c) {
        var d = a.stateNode;
        if (!d) throw Error(p(169));
        c ? (a = bg(a, b, Xf), d.__reactInternalMemoizedMergedChildContext = a, E(Wf), E(H), G(H, a)) : E(Wf);
        G(Wf, c);
      }
      var eg = null;
      var fg = false;
      var gg = false;
      function hg(a) {
        null === eg ? eg = [a] : eg.push(a);
      }
      function ig(a) {
        fg = true;
        hg(a);
      }
      function jg() {
        if (!gg && null !== eg) {
          gg = true;
          var a = 0, b = C;
          try {
            var c = eg;
            for (C = 1; a < c.length; a++) {
              var d = c[a];
              do
                d = d(true);
              while (null !== d);
            }
            eg = null;
            fg = false;
          } catch (e) {
            throw null !== eg && (eg = eg.slice(a + 1)), ac(fc, jg), e;
          } finally {
            C = b, gg = false;
          }
        }
        return null;
      }
      var kg = [];
      var lg = 0;
      var mg = null;
      var ng = 0;
      var og = [];
      var pg = 0;
      var qg = null;
      var rg = 1;
      var sg = "";
      function tg(a, b) {
        kg[lg++] = ng;
        kg[lg++] = mg;
        mg = a;
        ng = b;
      }
      function ug(a, b, c) {
        og[pg++] = rg;
        og[pg++] = sg;
        og[pg++] = qg;
        qg = a;
        var d = rg;
        a = sg;
        var e = 32 - oc(d) - 1;
        d &= ~(1 << e);
        c += 1;
        var f = 32 - oc(b) + e;
        if (30 < f) {
          var g = e - e % 5;
          f = (d & (1 << g) - 1).toString(32);
          d >>= g;
          e -= g;
          rg = 1 << 32 - oc(b) + e | c << e | d;
          sg = f + a;
        } else rg = 1 << f | c << e | d, sg = a;
      }
      function vg(a) {
        null !== a.return && (tg(a, 1), ug(a, 1, 0));
      }
      function wg(a) {
        for (; a === mg; ) mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
        for (; a === qg; ) qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
      }
      var xg = null;
      var yg = null;
      var I = false;
      var zg = null;
      function Ag(a, b) {
        var c = Bg(5, null, null, 0);
        c.elementType = "DELETED";
        c.stateNode = b;
        c.return = a;
        b = a.deletions;
        null === b ? (a.deletions = [c], a.flags |= 16) : b.push(c);
      }
      function Cg(a, b) {
        switch (a.tag) {
          case 5:
            var c = a.type;
            b = 1 !== b.nodeType || c.toLowerCase() !== b.nodeName.toLowerCase() ? null : b;
            return null !== b ? (a.stateNode = b, xg = a, yg = Lf(b.firstChild), true) : false;
          case 6:
            return b = "" === a.pendingProps || 3 !== b.nodeType ? null : b, null !== b ? (a.stateNode = b, xg = a, yg = null, true) : false;
          case 13:
            return b = 8 !== b.nodeType ? null : b, null !== b ? (c = null !== qg ? { id: rg, overflow: sg } : null, a.memoizedState = { dehydrated: b, treeContext: c, retryLane: 1073741824 }, c = Bg(18, null, null, 0), c.stateNode = b, c.return = a, a.child = c, xg = a, yg = null, true) : false;
          default:
            return false;
        }
      }
      function Dg(a) {
        return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
      }
      function Eg(a) {
        if (I) {
          var b = yg;
          if (b) {
            var c = b;
            if (!Cg(a, b)) {
              if (Dg(a)) throw Error(p(418));
              b = Lf(c.nextSibling);
              var d = xg;
              b && Cg(a, b) ? Ag(d, c) : (a.flags = a.flags & -4097 | 2, I = false, xg = a);
            }
          } else {
            if (Dg(a)) throw Error(p(418));
            a.flags = a.flags & -4097 | 2;
            I = false;
            xg = a;
          }
        }
      }
      function Fg(a) {
        for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag; ) a = a.return;
        xg = a;
      }
      function Gg(a) {
        if (a !== xg) return false;
        if (!I) return Fg(a), I = true, false;
        var b;
        (b = 3 !== a.tag) && !(b = 5 !== a.tag) && (b = a.type, b = "head" !== b && "body" !== b && !Ef(a.type, a.memoizedProps));
        if (b && (b = yg)) {
          if (Dg(a)) throw Hg(), Error(p(418));
          for (; b; ) Ag(a, b), b = Lf(b.nextSibling);
        }
        Fg(a);
        if (13 === a.tag) {
          a = a.memoizedState;
          a = null !== a ? a.dehydrated : null;
          if (!a) throw Error(p(317));
          a: {
            a = a.nextSibling;
            for (b = 0; a; ) {
              if (8 === a.nodeType) {
                var c = a.data;
                if ("/$" === c) {
                  if (0 === b) {
                    yg = Lf(a.nextSibling);
                    break a;
                  }
                  b--;
                } else "$" !== c && "$!" !== c && "$?" !== c || b++;
              }
              a = a.nextSibling;
            }
            yg = null;
          }
        } else yg = xg ? Lf(a.stateNode.nextSibling) : null;
        return true;
      }
      function Hg() {
        for (var a = yg; a; ) a = Lf(a.nextSibling);
      }
      function Ig() {
        yg = xg = null;
        I = false;
      }
      function Jg(a) {
        null === zg ? zg = [a] : zg.push(a);
      }
      var Kg = ua.ReactCurrentBatchConfig;
      function Lg(a, b, c) {
        a = c.ref;
        if (null !== a && "function" !== typeof a && "object" !== typeof a) {
          if (c._owner) {
            c = c._owner;
            if (c) {
              if (1 !== c.tag) throw Error(p(309));
              var d = c.stateNode;
            }
            if (!d) throw Error(p(147, a));
            var e = d, f = "" + a;
            if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f) return b.ref;
            b = function(a2) {
              var b2 = e.refs;
              null === a2 ? delete b2[f] : b2[f] = a2;
            };
            b._stringRef = f;
            return b;
          }
          if ("string" !== typeof a) throw Error(p(284));
          if (!c._owner) throw Error(p(290, a));
        }
        return a;
      }
      function Mg(a, b) {
        a = Object.prototype.toString.call(b);
        throw Error(p(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
      }
      function Ng(a) {
        var b = a._init;
        return b(a._payload);
      }
      function Og(a) {
        function b(b2, c2) {
          if (a) {
            var d2 = b2.deletions;
            null === d2 ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
          }
        }
        function c(c2, d2) {
          if (!a) return null;
          for (; null !== d2; ) b(c2, d2), d2 = d2.sibling;
          return null;
        }
        function d(a2, b2) {
          for (a2 = /* @__PURE__ */ new Map(); null !== b2; ) null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
          return a2;
        }
        function e(a2, b2) {
          a2 = Pg(a2, b2);
          a2.index = 0;
          a2.sibling = null;
          return a2;
        }
        function f(b2, c2, d2) {
          b2.index = d2;
          if (!a) return b2.flags |= 1048576, c2;
          d2 = b2.alternate;
          if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
          b2.flags |= 2;
          return c2;
        }
        function g(b2) {
          a && null === b2.alternate && (b2.flags |= 2);
          return b2;
        }
        function h(a2, b2, c2, d2) {
          if (null === b2 || 6 !== b2.tag) return b2 = Qg(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function k(a2, b2, c2, d2) {
          var f2 = c2.type;
          if (f2 === ya) return m(a2, b2, c2.props.children, d2, c2.key);
          if (null !== b2 && (b2.elementType === f2 || "object" === typeof f2 && null !== f2 && f2.$$typeof === Ha && Ng(f2) === b2.type)) return d2 = e(b2, c2.props), d2.ref = Lg(a2, b2, c2), d2.return = a2, d2;
          d2 = Rg(c2.type, c2.key, c2.props, null, a2.mode, d2);
          d2.ref = Lg(a2, b2, c2);
          d2.return = a2;
          return d2;
        }
        function l(a2, b2, c2, d2) {
          if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = Sg(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2.children || []);
          b2.return = a2;
          return b2;
        }
        function m(a2, b2, c2, d2, f2) {
          if (null === b2 || 7 !== b2.tag) return b2 = Tg(c2, a2.mode, d2, f2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function q(a2, b2, c2) {
          if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = Qg("" + b2, a2.mode, c2), b2.return = a2, b2;
          if ("object" === typeof b2 && null !== b2) {
            switch (b2.$$typeof) {
              case va:
                return c2 = Rg(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Lg(a2, null, b2), c2.return = a2, c2;
              case wa:
                return b2 = Sg(b2, a2.mode, c2), b2.return = a2, b2;
              case Ha:
                var d2 = b2._init;
                return q(a2, d2(b2._payload), c2);
            }
            if (eb(b2) || Ka(b2)) return b2 = Tg(b2, a2.mode, c2, null), b2.return = a2, b2;
            Mg(a2, b2);
          }
          return null;
        }
        function r(a2, b2, c2, d2) {
          var e2 = null !== b2 ? b2.key : null;
          if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
          if ("object" === typeof c2 && null !== c2) {
            switch (c2.$$typeof) {
              case va:
                return c2.key === e2 ? k(a2, b2, c2, d2) : null;
              case wa:
                return c2.key === e2 ? l(a2, b2, c2, d2) : null;
              case Ha:
                return e2 = c2._init, r(
                  a2,
                  b2,
                  e2(c2._payload),
                  d2
                );
            }
            if (eb(c2) || Ka(c2)) return null !== e2 ? null : m(a2, b2, c2, d2, null);
            Mg(a2, c2);
          }
          return null;
        }
        function y(a2, b2, c2, d2, e2) {
          if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
          if ("object" === typeof d2 && null !== d2) {
            switch (d2.$$typeof) {
              case va:
                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k(b2, a2, d2, e2);
              case wa:
                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l(b2, a2, d2, e2);
              case Ha:
                var f2 = d2._init;
                return y(a2, b2, c2, f2(d2._payload), e2);
            }
            if (eb(d2) || Ka(d2)) return a2 = a2.get(c2) || null, m(b2, a2, d2, e2, null);
            Mg(b2, d2);
          }
          return null;
        }
        function n(e2, g2, h2, k2) {
          for (var l2 = null, m2 = null, u = g2, w = g2 = 0, x = null; null !== u && w < h2.length; w++) {
            u.index > w ? (x = u, u = null) : x = u.sibling;
            var n2 = r(e2, u, h2[w], k2);
            if (null === n2) {
              null === u && (u = x);
              break;
            }
            a && u && null === n2.alternate && b(e2, u);
            g2 = f(n2, g2, w);
            null === m2 ? l2 = n2 : m2.sibling = n2;
            m2 = n2;
            u = x;
          }
          if (w === h2.length) return c(e2, u), I && tg(e2, w), l2;
          if (null === u) {
            for (; w < h2.length; w++) u = q(e2, h2[w], k2), null !== u && (g2 = f(u, g2, w), null === m2 ? l2 = u : m2.sibling = u, m2 = u);
            I && tg(e2, w);
            return l2;
          }
          for (u = d(e2, u); w < h2.length; w++) x = y(u, e2, w, h2[w], k2), null !== x && (a && null !== x.alternate && u.delete(null === x.key ? w : x.key), g2 = f(x, g2, w), null === m2 ? l2 = x : m2.sibling = x, m2 = x);
          a && u.forEach(function(a2) {
            return b(e2, a2);
          });
          I && tg(e2, w);
          return l2;
        }
        function t(e2, g2, h2, k2) {
          var l2 = Ka(h2);
          if ("function" !== typeof l2) throw Error(p(150));
          h2 = l2.call(h2);
          if (null == h2) throw Error(p(151));
          for (var u = l2 = null, m2 = g2, w = g2 = 0, x = null, n2 = h2.next(); null !== m2 && !n2.done; w++, n2 = h2.next()) {
            m2.index > w ? (x = m2, m2 = null) : x = m2.sibling;
            var t2 = r(e2, m2, n2.value, k2);
            if (null === t2) {
              null === m2 && (m2 = x);
              break;
            }
            a && m2 && null === t2.alternate && b(e2, m2);
            g2 = f(t2, g2, w);
            null === u ? l2 = t2 : u.sibling = t2;
            u = t2;
            m2 = x;
          }
          if (n2.done) return c(
            e2,
            m2
          ), I && tg(e2, w), l2;
          if (null === m2) {
            for (; !n2.done; w++, n2 = h2.next()) n2 = q(e2, n2.value, k2), null !== n2 && (g2 = f(n2, g2, w), null === u ? l2 = n2 : u.sibling = n2, u = n2);
            I && tg(e2, w);
            return l2;
          }
          for (m2 = d(e2, m2); !n2.done; w++, n2 = h2.next()) n2 = y(m2, e2, w, n2.value, k2), null !== n2 && (a && null !== n2.alternate && m2.delete(null === n2.key ? w : n2.key), g2 = f(n2, g2, w), null === u ? l2 = n2 : u.sibling = n2, u = n2);
          a && m2.forEach(function(a2) {
            return b(e2, a2);
          });
          I && tg(e2, w);
          return l2;
        }
        function J(a2, d2, f2, h2) {
          "object" === typeof f2 && null !== f2 && f2.type === ya && null === f2.key && (f2 = f2.props.children);
          if ("object" === typeof f2 && null !== f2) {
            switch (f2.$$typeof) {
              case va:
                a: {
                  for (var k2 = f2.key, l2 = d2; null !== l2; ) {
                    if (l2.key === k2) {
                      k2 = f2.type;
                      if (k2 === ya) {
                        if (7 === l2.tag) {
                          c(a2, l2.sibling);
                          d2 = e(l2, f2.props.children);
                          d2.return = a2;
                          a2 = d2;
                          break a;
                        }
                      } else if (l2.elementType === k2 || "object" === typeof k2 && null !== k2 && k2.$$typeof === Ha && Ng(k2) === l2.type) {
                        c(a2, l2.sibling);
                        d2 = e(l2, f2.props);
                        d2.ref = Lg(a2, l2, f2);
                        d2.return = a2;
                        a2 = d2;
                        break a;
                      }
                      c(a2, l2);
                      break;
                    } else b(a2, l2);
                    l2 = l2.sibling;
                  }
                  f2.type === ya ? (d2 = Tg(f2.props.children, a2.mode, h2, f2.key), d2.return = a2, a2 = d2) : (h2 = Rg(f2.type, f2.key, f2.props, null, a2.mode, h2), h2.ref = Lg(a2, d2, f2), h2.return = a2, a2 = h2);
                }
                return g(a2);
              case wa:
                a: {
                  for (l2 = f2.key; null !== d2; ) {
                    if (d2.key === l2) if (4 === d2.tag && d2.stateNode.containerInfo === f2.containerInfo && d2.stateNode.implementation === f2.implementation) {
                      c(a2, d2.sibling);
                      d2 = e(d2, f2.children || []);
                      d2.return = a2;
                      a2 = d2;
                      break a;
                    } else {
                      c(a2, d2);
                      break;
                    }
                    else b(a2, d2);
                    d2 = d2.sibling;
                  }
                  d2 = Sg(f2, a2.mode, h2);
                  d2.return = a2;
                  a2 = d2;
                }
                return g(a2);
              case Ha:
                return l2 = f2._init, J(a2, d2, l2(f2._payload), h2);
            }
            if (eb(f2)) return n(a2, d2, f2, h2);
            if (Ka(f2)) return t(a2, d2, f2, h2);
            Mg(a2, f2);
          }
          return "string" === typeof f2 && "" !== f2 || "number" === typeof f2 ? (f2 = "" + f2, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f2), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Qg(f2, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
        }
        return J;
      }
      var Ug = Og(true);
      var Vg = Og(false);
      var Wg = Uf(null);
      var Xg = null;
      var Yg = null;
      var Zg = null;
      function $g() {
        Zg = Yg = Xg = null;
      }
      function ah(a) {
        var b = Wg.current;
        E(Wg);
        a._currentValue = b;
      }
      function bh(a, b, c) {
        for (; null !== a; ) {
          var d = a.alternate;
          (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
          if (a === c) break;
          a = a.return;
        }
      }
      function ch(a, b) {
        Xg = a;
        Zg = Yg = null;
        a = a.dependencies;
        null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (dh = true), a.firstContext = null);
      }
      function eh(a) {
        var b = a._currentValue;
        if (Zg !== a) if (a = { context: a, memoizedValue: b, next: null }, null === Yg) {
          if (null === Xg) throw Error(p(308));
          Yg = a;
          Xg.dependencies = { lanes: 0, firstContext: a };
        } else Yg = Yg.next = a;
        return b;
      }
      var fh = null;
      function gh(a) {
        null === fh ? fh = [a] : fh.push(a);
      }
      function hh(a, b, c, d) {
        var e = b.interleaved;
        null === e ? (c.next = c, gh(b)) : (c.next = e.next, e.next = c);
        b.interleaved = c;
        return ih(a, d);
      }
      function ih(a, b) {
        a.lanes |= b;
        var c = a.alternate;
        null !== c && (c.lanes |= b);
        c = a;
        for (a = a.return; null !== a; ) a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
        return 3 === c.tag ? c.stateNode : null;
      }
      var jh = false;
      function kh(a) {
        a.updateQueue = { baseState: a.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
      }
      function lh(a, b) {
        a = a.updateQueue;
        b.updateQueue === a && (b.updateQueue = { baseState: a.baseState, firstBaseUpdate: a.firstBaseUpdate, lastBaseUpdate: a.lastBaseUpdate, shared: a.shared, effects: a.effects });
      }
      function mh(a, b) {
        return { eventTime: a, lane: b, tag: 0, payload: null, callback: null, next: null };
      }
      function nh(a, b, c) {
        var d = a.updateQueue;
        if (null === d) return null;
        d = d.shared;
        if (0 !== (K & 2)) {
          var e = d.pending;
          null === e ? b.next = b : (b.next = e.next, e.next = b);
          d.pending = b;
          return ih(a, c);
        }
        e = d.interleaved;
        null === e ? (b.next = b, gh(d)) : (b.next = e.next, e.next = b);
        d.interleaved = b;
        return ih(a, c);
      }
      function oh(a, b, c) {
        b = b.updateQueue;
        if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Cc(a, c);
        }
      }
      function ph(a, b) {
        var c = a.updateQueue, d = a.alternate;
        if (null !== d && (d = d.updateQueue, c === d)) {
          var e = null, f = null;
          c = c.firstBaseUpdate;
          if (null !== c) {
            do {
              var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
              null === f ? e = f = g : f = f.next = g;
              c = c.next;
            } while (null !== c);
            null === f ? e = f = b : f = f.next = b;
          } else e = f = b;
          c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f, shared: d.shared, effects: d.effects };
          a.updateQueue = c;
          return;
        }
        a = c.lastBaseUpdate;
        null === a ? c.firstBaseUpdate = b : a.next = b;
        c.lastBaseUpdate = b;
      }
      function qh(a, b, c, d) {
        var e = a.updateQueue;
        jh = false;
        var f = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
        if (null !== h) {
          e.shared.pending = null;
          var k = h, l = k.next;
          k.next = null;
          null === g ? f = l : g.next = l;
          g = k;
          var m = a.alternate;
          null !== m && (m = m.updateQueue, h = m.lastBaseUpdate, h !== g && (null === h ? m.firstBaseUpdate = l : h.next = l, m.lastBaseUpdate = k));
        }
        if (null !== f) {
          var q = e.baseState;
          g = 0;
          m = l = k = null;
          h = f;
          do {
            var r = h.lane, y = h.eventTime;
            if ((d & r) === r) {
              null !== m && (m = m.next = {
                eventTime: y,
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              });
              a: {
                var n = a, t = h;
                r = b;
                y = c;
                switch (t.tag) {
                  case 1:
                    n = t.payload;
                    if ("function" === typeof n) {
                      q = n.call(y, q, r);
                      break a;
                    }
                    q = n;
                    break a;
                  case 3:
                    n.flags = n.flags & -65537 | 128;
                  case 0:
                    n = t.payload;
                    r = "function" === typeof n ? n.call(y, q, r) : n;
                    if (null === r || void 0 === r) break a;
                    q = A({}, q, r);
                    break a;
                  case 2:
                    jh = true;
                }
              }
              null !== h.callback && 0 !== h.lane && (a.flags |= 64, r = e.effects, null === r ? e.effects = [h] : r.push(h));
            } else y = { eventTime: y, lane: r, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, null === m ? (l = m = y, k = q) : m = m.next = y, g |= r;
            h = h.next;
            if (null === h) if (h = e.shared.pending, null === h) break;
            else r = h, h = r.next, r.next = null, e.lastBaseUpdate = r, e.shared.pending = null;
          } while (1);
          null === m && (k = q);
          e.baseState = k;
          e.firstBaseUpdate = l;
          e.lastBaseUpdate = m;
          b = e.shared.interleaved;
          if (null !== b) {
            e = b;
            do
              g |= e.lane, e = e.next;
            while (e !== b);
          } else null === f && (e.shared.lanes = 0);
          rh |= g;
          a.lanes = g;
          a.memoizedState = q;
        }
      }
      function sh(a, b, c) {
        a = b.effects;
        b.effects = null;
        if (null !== a) for (b = 0; b < a.length; b++) {
          var d = a[b], e = d.callback;
          if (null !== e) {
            d.callback = null;
            d = c;
            if ("function" !== typeof e) throw Error(p(191, e));
            e.call(d);
          }
        }
      }
      var th = {};
      var uh = Uf(th);
      var vh = Uf(th);
      var wh = Uf(th);
      function xh(a) {
        if (a === th) throw Error(p(174));
        return a;
      }
      function yh(a, b) {
        G(wh, b);
        G(vh, a);
        G(uh, th);
        a = b.nodeType;
        switch (a) {
          case 9:
          case 11:
            b = (b = b.documentElement) ? b.namespaceURI : lb(null, "");
            break;
          default:
            a = 8 === a ? b.parentNode : b, b = a.namespaceURI || null, a = a.tagName, b = lb(b, a);
        }
        E(uh);
        G(uh, b);
      }
      function zh() {
        E(uh);
        E(vh);
        E(wh);
      }
      function Ah(a) {
        xh(wh.current);
        var b = xh(uh.current);
        var c = lb(b, a.type);
        b !== c && (G(vh, a), G(uh, c));
      }
      function Bh(a) {
        vh.current === a && (E(uh), E(vh));
      }
      var L = Uf(0);
      function Ch(a) {
        for (var b = a; null !== b; ) {
          if (13 === b.tag) {
            var c = b.memoizedState;
            if (null !== c && (c = c.dehydrated, null === c || "$?" === c.data || "$!" === c.data)) return b;
          } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
            if (0 !== (b.flags & 128)) return b;
          } else if (null !== b.child) {
            b.child.return = b;
            b = b.child;
            continue;
          }
          if (b === a) break;
          for (; null === b.sibling; ) {
            if (null === b.return || b.return === a) return null;
            b = b.return;
          }
          b.sibling.return = b.return;
          b = b.sibling;
        }
        return null;
      }
      var Dh = [];
      function Eh() {
        for (var a = 0; a < Dh.length; a++) Dh[a]._workInProgressVersionPrimary = null;
        Dh.length = 0;
      }
      var Fh = ua.ReactCurrentDispatcher;
      var Gh = ua.ReactCurrentBatchConfig;
      var Hh = 0;
      var M = null;
      var N = null;
      var O = null;
      var Ih = false;
      var Jh = false;
      var Kh = 0;
      var Lh = 0;
      function P() {
        throw Error(p(321));
      }
      function Mh(a, b) {
        if (null === b) return false;
        for (var c = 0; c < b.length && c < a.length; c++) if (!He(a[c], b[c])) return false;
        return true;
      }
      function Nh(a, b, c, d, e, f) {
        Hh = f;
        M = b;
        b.memoizedState = null;
        b.updateQueue = null;
        b.lanes = 0;
        Fh.current = null === a || null === a.memoizedState ? Oh : Ph;
        a = c(d, e);
        if (Jh) {
          f = 0;
          do {
            Jh = false;
            Kh = 0;
            if (25 <= f) throw Error(p(301));
            f += 1;
            O = N = null;
            b.updateQueue = null;
            Fh.current = Qh;
            a = c(d, e);
          } while (Jh);
        }
        Fh.current = Rh;
        b = null !== N && null !== N.next;
        Hh = 0;
        O = N = M = null;
        Ih = false;
        if (b) throw Error(p(300));
        return a;
      }
      function Sh() {
        var a = 0 !== Kh;
        Kh = 0;
        return a;
      }
      function Th() {
        var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
        null === O ? M.memoizedState = O = a : O = O.next = a;
        return O;
      }
      function Uh() {
        if (null === N) {
          var a = M.alternate;
          a = null !== a ? a.memoizedState : null;
        } else a = N.next;
        var b = null === O ? M.memoizedState : O.next;
        if (null !== b) O = b, N = a;
        else {
          if (null === a) throw Error(p(310));
          N = a;
          a = { memoizedState: N.memoizedState, baseState: N.baseState, baseQueue: N.baseQueue, queue: N.queue, next: null };
          null === O ? M.memoizedState = O = a : O = O.next = a;
        }
        return O;
      }
      function Vh(a, b) {
        return "function" === typeof b ? b(a) : b;
      }
      function Wh(a) {
        var b = Uh(), c = b.queue;
        if (null === c) throw Error(p(311));
        c.lastRenderedReducer = a;
        var d = N, e = d.baseQueue, f = c.pending;
        if (null !== f) {
          if (null !== e) {
            var g = e.next;
            e.next = f.next;
            f.next = g;
          }
          d.baseQueue = e = f;
          c.pending = null;
        }
        if (null !== e) {
          f = e.next;
          d = d.baseState;
          var h = g = null, k = null, l = f;
          do {
            var m = l.lane;
            if ((Hh & m) === m) null !== k && (k = k.next = { lane: 0, action: l.action, hasEagerState: l.hasEagerState, eagerState: l.eagerState, next: null }), d = l.hasEagerState ? l.eagerState : a(d, l.action);
            else {
              var q = {
                lane: m,
                action: l.action,
                hasEagerState: l.hasEagerState,
                eagerState: l.eagerState,
                next: null
              };
              null === k ? (h = k = q, g = d) : k = k.next = q;
              M.lanes |= m;
              rh |= m;
            }
            l = l.next;
          } while (null !== l && l !== f);
          null === k ? g = d : k.next = h;
          He(d, b.memoizedState) || (dh = true);
          b.memoizedState = d;
          b.baseState = g;
          b.baseQueue = k;
          c.lastRenderedState = d;
        }
        a = c.interleaved;
        if (null !== a) {
          e = a;
          do
            f = e.lane, M.lanes |= f, rh |= f, e = e.next;
          while (e !== a);
        } else null === e && (c.lanes = 0);
        return [b.memoizedState, c.dispatch];
      }
      function Xh(a) {
        var b = Uh(), c = b.queue;
        if (null === c) throw Error(p(311));
        c.lastRenderedReducer = a;
        var d = c.dispatch, e = c.pending, f = b.memoizedState;
        if (null !== e) {
          c.pending = null;
          var g = e = e.next;
          do
            f = a(f, g.action), g = g.next;
          while (g !== e);
          He(f, b.memoizedState) || (dh = true);
          b.memoizedState = f;
          null === b.baseQueue && (b.baseState = f);
          c.lastRenderedState = f;
        }
        return [f, d];
      }
      function Yh() {
      }
      function Zh(a, b) {
        var c = M, d = Uh(), e = b(), f = !He(d.memoizedState, e);
        f && (d.memoizedState = e, dh = true);
        d = d.queue;
        $h(ai.bind(null, c, d, a), [a]);
        if (d.getSnapshot !== b || f || null !== O && O.memoizedState.tag & 1) {
          c.flags |= 2048;
          bi(9, ci.bind(null, c, d, e, b), void 0, null);
          if (null === Q) throw Error(p(349));
          0 !== (Hh & 30) || di(c, b, e);
        }
        return e;
      }
      function di(a, b, c) {
        a.flags |= 16384;
        a = { getSnapshot: b, value: c };
        b = M.updateQueue;
        null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.stores = [a]) : (c = b.stores, null === c ? b.stores = [a] : c.push(a));
      }
      function ci(a, b, c, d) {
        b.value = c;
        b.getSnapshot = d;
        ei(b) && fi(a);
      }
      function ai(a, b, c) {
        return c(function() {
          ei(b) && fi(a);
        });
      }
      function ei(a) {
        var b = a.getSnapshot;
        a = a.value;
        try {
          var c = b();
          return !He(a, c);
        } catch (d) {
          return true;
        }
      }
      function fi(a) {
        var b = ih(a, 1);
        null !== b && gi(b, a, 1, -1);
      }
      function hi(a) {
        var b = Th();
        "function" === typeof a && (a = a());
        b.memoizedState = b.baseState = a;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Vh, lastRenderedState: a };
        b.queue = a;
        a = a.dispatch = ii.bind(null, M, a);
        return [b.memoizedState, a];
      }
      function bi(a, b, c, d) {
        a = { tag: a, create: b, destroy: c, deps: d, next: null };
        b = M.updateQueue;
        null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
        return a;
      }
      function ji() {
        return Uh().memoizedState;
      }
      function ki(a, b, c, d) {
        var e = Th();
        M.flags |= a;
        e.memoizedState = bi(1 | b, c, void 0, void 0 === d ? null : d);
      }
      function li(a, b, c, d) {
        var e = Uh();
        d = void 0 === d ? null : d;
        var f = void 0;
        if (null !== N) {
          var g = N.memoizedState;
          f = g.destroy;
          if (null !== d && Mh(d, g.deps)) {
            e.memoizedState = bi(b, c, f, d);
            return;
          }
        }
        M.flags |= a;
        e.memoizedState = bi(1 | b, c, f, d);
      }
      function mi(a, b) {
        return ki(8390656, 8, a, b);
      }
      function $h(a, b) {
        return li(2048, 8, a, b);
      }
      function ni(a, b) {
        return li(4, 2, a, b);
      }
      function oi(a, b) {
        return li(4, 4, a, b);
      }
      function pi(a, b) {
        if ("function" === typeof b) return a = a(), b(a), function() {
          b(null);
        };
        if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
          b.current = null;
        };
      }
      function qi(a, b, c) {
        c = null !== c && void 0 !== c ? c.concat([a]) : null;
        return li(4, 4, pi.bind(null, b, a), c);
      }
      function ri() {
      }
      function si(a, b) {
        var c = Uh();
        b = void 0 === b ? null : b;
        var d = c.memoizedState;
        if (null !== d && null !== b && Mh(b, d[1])) return d[0];
        c.memoizedState = [a, b];
        return a;
      }
      function ti(a, b) {
        var c = Uh();
        b = void 0 === b ? null : b;
        var d = c.memoizedState;
        if (null !== d && null !== b && Mh(b, d[1])) return d[0];
        a = a();
        c.memoizedState = [a, b];
        return a;
      }
      function ui(a, b, c) {
        if (0 === (Hh & 21)) return a.baseState && (a.baseState = false, dh = true), a.memoizedState = c;
        He(c, b) || (c = yc(), M.lanes |= c, rh |= c, a.baseState = true);
        return b;
      }
      function vi(a, b) {
        var c = C;
        C = 0 !== c && 4 > c ? c : 4;
        a(true);
        var d = Gh.transition;
        Gh.transition = {};
        try {
          a(false), b();
        } finally {
          C = c, Gh.transition = d;
        }
      }
      function wi() {
        return Uh().memoizedState;
      }
      function xi(a, b, c) {
        var d = yi(a);
        c = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (zi(a)) Ai(b, c);
        else if (c = hh(a, b, c, d), null !== c) {
          var e = R();
          gi(c, a, d, e);
          Bi(c, b, d);
        }
      }
      function ii(a, b, c) {
        var d = yi(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (zi(a)) Ai(b, e);
        else {
          var f = a.alternate;
          if (0 === a.lanes && (null === f || 0 === f.lanes) && (f = b.lastRenderedReducer, null !== f)) try {
            var g = b.lastRenderedState, h = f(g, c);
            e.hasEagerState = true;
            e.eagerState = h;
            if (He(h, g)) {
              var k = b.interleaved;
              null === k ? (e.next = e, gh(b)) : (e.next = k.next, k.next = e);
              b.interleaved = e;
              return;
            }
          } catch (l) {
          } finally {
          }
          c = hh(a, b, e, d);
          null !== c && (e = R(), gi(c, a, d, e), Bi(c, b, d));
        }
      }
      function zi(a) {
        var b = a.alternate;
        return a === M || null !== b && b === M;
      }
      function Ai(a, b) {
        Jh = Ih = true;
        var c = a.pending;
        null === c ? b.next = b : (b.next = c.next, c.next = b);
        a.pending = b;
      }
      function Bi(a, b, c) {
        if (0 !== (c & 4194240)) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Cc(a, c);
        }
      }
      var Rh = { readContext: eh, useCallback: P, useContext: P, useEffect: P, useImperativeHandle: P, useInsertionEffect: P, useLayoutEffect: P, useMemo: P, useReducer: P, useRef: P, useState: P, useDebugValue: P, useDeferredValue: P, useTransition: P, useMutableSource: P, useSyncExternalStore: P, useId: P, unstable_isNewReconciler: false };
      var Oh = { readContext: eh, useCallback: function(a, b) {
        Th().memoizedState = [a, void 0 === b ? null : b];
        return a;
      }, useContext: eh, useEffect: mi, useImperativeHandle: function(a, b, c) {
        c = null !== c && void 0 !== c ? c.concat([a]) : null;
        return ki(
          4194308,
          4,
          pi.bind(null, b, a),
          c
        );
      }, useLayoutEffect: function(a, b) {
        return ki(4194308, 4, a, b);
      }, useInsertionEffect: function(a, b) {
        return ki(4, 2, a, b);
      }, useMemo: function(a, b) {
        var c = Th();
        b = void 0 === b ? null : b;
        a = a();
        c.memoizedState = [a, b];
        return a;
      }, useReducer: function(a, b, c) {
        var d = Th();
        b = void 0 !== c ? c(b) : b;
        d.memoizedState = d.baseState = b;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a, lastRenderedState: b };
        d.queue = a;
        a = a.dispatch = xi.bind(null, M, a);
        return [d.memoizedState, a];
      }, useRef: function(a) {
        var b = Th();
        a = { current: a };
        return b.memoizedState = a;
      }, useState: hi, useDebugValue: ri, useDeferredValue: function(a) {
        return Th().memoizedState = a;
      }, useTransition: function() {
        var a = hi(false), b = a[0];
        a = vi.bind(null, a[1]);
        Th().memoizedState = a;
        return [b, a];
      }, useMutableSource: function() {
      }, useSyncExternalStore: function(a, b, c) {
        var d = M, e = Th();
        if (I) {
          if (void 0 === c) throw Error(p(407));
          c = c();
        } else {
          c = b();
          if (null === Q) throw Error(p(349));
          0 !== (Hh & 30) || di(d, b, c);
        }
        e.memoizedState = c;
        var f = { value: c, getSnapshot: b };
        e.queue = f;
        mi(ai.bind(
          null,
          d,
          f,
          a
        ), [a]);
        d.flags |= 2048;
        bi(9, ci.bind(null, d, f, c, b), void 0, null);
        return c;
      }, useId: function() {
        var a = Th(), b = Q.identifierPrefix;
        if (I) {
          var c = sg;
          var d = rg;
          c = (d & ~(1 << 32 - oc(d) - 1)).toString(32) + c;
          b = ":" + b + "R" + c;
          c = Kh++;
          0 < c && (b += "H" + c.toString(32));
          b += ":";
        } else c = Lh++, b = ":" + b + "r" + c.toString(32) + ":";
        return a.memoizedState = b;
      }, unstable_isNewReconciler: false };
      var Ph = {
        readContext: eh,
        useCallback: si,
        useContext: eh,
        useEffect: $h,
        useImperativeHandle: qi,
        useInsertionEffect: ni,
        useLayoutEffect: oi,
        useMemo: ti,
        useReducer: Wh,
        useRef: ji,
        useState: function() {
          return Wh(Vh);
        },
        useDebugValue: ri,
        useDeferredValue: function(a) {
          var b = Uh();
          return ui(b, N.memoizedState, a);
        },
        useTransition: function() {
          var a = Wh(Vh)[0], b = Uh().memoizedState;
          return [a, b];
        },
        useMutableSource: Yh,
        useSyncExternalStore: Zh,
        useId: wi,
        unstable_isNewReconciler: false
      };
      var Qh = { readContext: eh, useCallback: si, useContext: eh, useEffect: $h, useImperativeHandle: qi, useInsertionEffect: ni, useLayoutEffect: oi, useMemo: ti, useReducer: Xh, useRef: ji, useState: function() {
        return Xh(Vh);
      }, useDebugValue: ri, useDeferredValue: function(a) {
        var b = Uh();
        return null === N ? b.memoizedState = a : ui(b, N.memoizedState, a);
      }, useTransition: function() {
        var a = Xh(Vh)[0], b = Uh().memoizedState;
        return [a, b];
      }, useMutableSource: Yh, useSyncExternalStore: Zh, useId: wi, unstable_isNewReconciler: false };
      function Ci(a, b) {
        if (a && a.defaultProps) {
          b = A({}, b);
          a = a.defaultProps;
          for (var c in a) void 0 === b[c] && (b[c] = a[c]);
          return b;
        }
        return b;
      }
      function Di(a, b, c, d) {
        b = a.memoizedState;
        c = c(d, b);
        c = null === c || void 0 === c ? b : A({}, b, c);
        a.memoizedState = c;
        0 === a.lanes && (a.updateQueue.baseState = c);
      }
      var Ei = { isMounted: function(a) {
        return (a = a._reactInternals) ? Vb(a) === a : false;
      }, enqueueSetState: function(a, b, c) {
        a = a._reactInternals;
        var d = R(), e = yi(a), f = mh(d, e);
        f.payload = b;
        void 0 !== c && null !== c && (f.callback = c);
        b = nh(a, f, e);
        null !== b && (gi(b, a, e, d), oh(b, a, e));
      }, enqueueReplaceState: function(a, b, c) {
        a = a._reactInternals;
        var d = R(), e = yi(a), f = mh(d, e);
        f.tag = 1;
        f.payload = b;
        void 0 !== c && null !== c && (f.callback = c);
        b = nh(a, f, e);
        null !== b && (gi(b, a, e, d), oh(b, a, e));
      }, enqueueForceUpdate: function(a, b) {
        a = a._reactInternals;
        var c = R(), d = yi(a), e = mh(c, d);
        e.tag = 2;
        void 0 !== b && null !== b && (e.callback = b);
        b = nh(a, e, d);
        null !== b && (gi(b, a, d, c), oh(b, a, d));
      } };
      function Fi(a, b, c, d, e, f, g) {
        a = a.stateNode;
        return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f, g) : b.prototype && b.prototype.isPureReactComponent ? !Ie(c, d) || !Ie(e, f) : true;
      }
      function Gi(a, b, c) {
        var d = false, e = Vf;
        var f = b.contextType;
        "object" === typeof f && null !== f ? f = eh(f) : (e = Zf(b) ? Xf : H.current, d = b.contextTypes, f = (d = null !== d && void 0 !== d) ? Yf(a, e) : Vf);
        b = new b(c, f);
        a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
        b.updater = Ei;
        a.stateNode = b;
        b._reactInternals = a;
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f);
        return b;
      }
      function Hi(a, b, c, d) {
        a = b.state;
        "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
        "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
        b.state !== a && Ei.enqueueReplaceState(b, b.state, null);
      }
      function Ii(a, b, c, d) {
        var e = a.stateNode;
        e.props = c;
        e.state = a.memoizedState;
        e.refs = {};
        kh(a);
        var f = b.contextType;
        "object" === typeof f && null !== f ? e.context = eh(f) : (f = Zf(b) ? Xf : H.current, e.context = Yf(a, f));
        e.state = a.memoizedState;
        f = b.getDerivedStateFromProps;
        "function" === typeof f && (Di(a, b, f, c), e.state = a.memoizedState);
        "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && Ei.enqueueReplaceState(e, e.state, null), qh(a, c, e, d), e.state = a.memoizedState);
        "function" === typeof e.componentDidMount && (a.flags |= 4194308);
      }
      function Ji(a, b) {
        try {
          var c = "", d = b;
          do
            c += Pa(d), d = d.return;
          while (d);
          var e = c;
        } catch (f) {
          e = "\nError generating stack: " + f.message + "\n" + f.stack;
        }
        return { value: a, source: b, stack: e, digest: null };
      }
      function Ki(a, b, c) {
        return { value: a, source: null, stack: null != c ? c : null, digest: null != b ? b : null };
      }
      function Li(a, b) {
        try {
          console.error(b.value);
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      var Mi = "function" === typeof WeakMap ? WeakMap : Map;
      function Ni(a, b, c) {
        c = mh(-1, c);
        c.tag = 3;
        c.payload = { element: null };
        var d = b.value;
        c.callback = function() {
          Oi || (Oi = true, Pi = d);
          Li(a, b);
        };
        return c;
      }
      function Qi(a, b, c) {
        c = mh(-1, c);
        c.tag = 3;
        var d = a.type.getDerivedStateFromError;
        if ("function" === typeof d) {
          var e = b.value;
          c.payload = function() {
            return d(e);
          };
          c.callback = function() {
            Li(a, b);
          };
        }
        var f = a.stateNode;
        null !== f && "function" === typeof f.componentDidCatch && (c.callback = function() {
          Li(a, b);
          "function" !== typeof d && (null === Ri ? Ri = /* @__PURE__ */ new Set([this]) : Ri.add(this));
          var c2 = b.stack;
          this.componentDidCatch(b.value, { componentStack: null !== c2 ? c2 : "" });
        });
        return c;
      }
      function Si(a, b, c) {
        var d = a.pingCache;
        if (null === d) {
          d = a.pingCache = new Mi();
          var e = /* @__PURE__ */ new Set();
          d.set(b, e);
        } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
        e.has(c) || (e.add(c), a = Ti.bind(null, a, b, c), b.then(a, a));
      }
      function Ui(a) {
        do {
          var b;
          if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
          if (b) return a;
          a = a.return;
        } while (null !== a);
        return null;
      }
      function Vi(a, b, c, d, e) {
        if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = mh(-1, 1), b.tag = 2, nh(c, b, 1))), c.lanes |= 1), a;
        a.flags |= 65536;
        a.lanes = e;
        return a;
      }
      var Wi = ua.ReactCurrentOwner;
      var dh = false;
      function Xi(a, b, c, d) {
        b.child = null === a ? Vg(b, null, c, d) : Ug(b, a.child, c, d);
      }
      function Yi(a, b, c, d, e) {
        c = c.render;
        var f = b.ref;
        ch(b, e);
        d = Nh(a, b, c, d, f, e);
        c = Sh();
        if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
        I && c && vg(b);
        b.flags |= 1;
        Xi(a, b, d, e);
        return b.child;
      }
      function $i(a, b, c, d, e) {
        if (null === a) {
          var f = c.type;
          if ("function" === typeof f && !aj(f) && void 0 === f.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f, bj(a, b, f, d, e);
          a = Rg(c.type, null, d, b, b.mode, e);
          a.ref = b.ref;
          a.return = b;
          return b.child = a;
        }
        f = a.child;
        if (0 === (a.lanes & e)) {
          var g = f.memoizedProps;
          c = c.compare;
          c = null !== c ? c : Ie;
          if (c(g, d) && a.ref === b.ref) return Zi(a, b, e);
        }
        b.flags |= 1;
        a = Pg(f, d);
        a.ref = b.ref;
        a.return = b;
        return b.child = a;
      }
      function bj(a, b, c, d, e) {
        if (null !== a) {
          var f = a.memoizedProps;
          if (Ie(f, d) && a.ref === b.ref) if (dh = false, b.pendingProps = d = f, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (dh = true);
          else return b.lanes = a.lanes, Zi(a, b, e);
        }
        return cj(a, b, c, d, e);
      }
      function dj(a, b, c) {
        var d = b.pendingProps, e = d.children, f = null !== a ? a.memoizedState : null;
        if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, G(ej, fj), fj |= c;
        else {
          if (0 === (c & 1073741824)) return a = null !== f ? f.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, G(ej, fj), fj |= a, null;
          b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
          d = null !== f ? f.baseLanes : c;
          G(ej, fj);
          fj |= d;
        }
        else null !== f ? (d = f.baseLanes | c, b.memoizedState = null) : d = c, G(ej, fj), fj |= d;
        Xi(a, b, e, c);
        return b.child;
      }
      function gj(a, b) {
        var c = b.ref;
        if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
      }
      function cj(a, b, c, d, e) {
        var f = Zf(c) ? Xf : H.current;
        f = Yf(b, f);
        ch(b, e);
        c = Nh(a, b, c, d, f, e);
        d = Sh();
        if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
        I && d && vg(b);
        b.flags |= 1;
        Xi(a, b, c, e);
        return b.child;
      }
      function hj(a, b, c, d, e) {
        if (Zf(c)) {
          var f = true;
          cg(b);
        } else f = false;
        ch(b, e);
        if (null === b.stateNode) ij(a, b), Gi(b, c, d), Ii(b, c, d, e), d = true;
        else if (null === a) {
          var g = b.stateNode, h = b.memoizedProps;
          g.props = h;
          var k = g.context, l = c.contextType;
          "object" === typeof l && null !== l ? l = eh(l) : (l = Zf(c) ? Xf : H.current, l = Yf(b, l));
          var m = c.getDerivedStateFromProps, q = "function" === typeof m || "function" === typeof g.getSnapshotBeforeUpdate;
          q || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k !== l) && Hi(b, g, d, l);
          jh = false;
          var r = b.memoizedState;
          g.state = r;
          qh(b, d, g, e);
          k = b.memoizedState;
          h !== d || r !== k || Wf.current || jh ? ("function" === typeof m && (Di(b, c, m, d), k = b.memoizedState), (h = jh || Fi(b, c, h, d, r, k, l)) ? (q || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
        } else {
          g = b.stateNode;
          lh(a, b);
          h = b.memoizedProps;
          l = b.type === b.elementType ? h : Ci(b.type, h);
          g.props = l;
          q = b.pendingProps;
          r = g.context;
          k = c.contextType;
          "object" === typeof k && null !== k ? k = eh(k) : (k = Zf(c) ? Xf : H.current, k = Yf(b, k));
          var y = c.getDerivedStateFromProps;
          (m = "function" === typeof y || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== q || r !== k) && Hi(b, g, d, k);
          jh = false;
          r = b.memoizedState;
          g.state = r;
          qh(b, d, g, e);
          var n = b.memoizedState;
          h !== q || r !== n || Wf.current || jh ? ("function" === typeof y && (Di(b, c, y, d), n = b.memoizedState), (l = jh || Fi(b, c, l, d, r, n, k) || false) ? (m || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, n, k), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, n, k)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = n), g.props = d, g.state = n, g.context = k, d = l) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 1024), d = false);
        }
        return jj(a, b, c, d, f, e);
      }
      function jj(a, b, c, d, e, f) {
        gj(a, b);
        var g = 0 !== (b.flags & 128);
        if (!d && !g) return e && dg(b, c, false), Zi(a, b, f);
        d = b.stateNode;
        Wi.current = b;
        var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
        b.flags |= 1;
        null !== a && g ? (b.child = Ug(b, a.child, null, f), b.child = Ug(b, null, h, f)) : Xi(a, b, h, f);
        b.memoizedState = d.state;
        e && dg(b, c, true);
        return b.child;
      }
      function kj(a) {
        var b = a.stateNode;
        b.pendingContext ? ag(a, b.pendingContext, b.pendingContext !== b.context) : b.context && ag(a, b.context, false);
        yh(a, b.containerInfo);
      }
      function lj(a, b, c, d, e) {
        Ig();
        Jg(e);
        b.flags |= 256;
        Xi(a, b, c, d);
        return b.child;
      }
      var mj = { dehydrated: null, treeContext: null, retryLane: 0 };
      function nj(a) {
        return { baseLanes: a, cachePool: null, transitions: null };
      }
      function oj(a, b, c) {
        var d = b.pendingProps, e = L.current, f = false, g = 0 !== (b.flags & 128), h;
        (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
        if (h) f = true, b.flags &= -129;
        else if (null === a || null !== a.memoizedState) e |= 1;
        G(L, e & 1);
        if (null === a) {
          Eg(b);
          a = b.memoizedState;
          if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : "$!" === a.data ? b.lanes = 8 : b.lanes = 1073741824, null;
          g = d.children;
          a = d.fallback;
          return f ? (d = b.mode, f = b.child, g = { mode: "hidden", children: g }, 0 === (d & 1) && null !== f ? (f.childLanes = 0, f.pendingProps = g) : f = pj(g, d, 0, null), a = Tg(a, d, c, null), f.return = b, a.return = b, f.sibling = a, b.child = f, b.child.memoizedState = nj(c), b.memoizedState = mj, a) : qj(b, g);
        }
        e = a.memoizedState;
        if (null !== e && (h = e.dehydrated, null !== h)) return rj(a, b, g, d, h, e, c);
        if (f) {
          f = d.fallback;
          g = b.mode;
          e = a.child;
          h = e.sibling;
          var k = { mode: "hidden", children: d.children };
          0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = Pg(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
          null !== h ? f = Pg(h, f) : (f = Tg(f, g, c, null), f.flags |= 2);
          f.return = b;
          d.return = b;
          d.sibling = f;
          b.child = d;
          d = f;
          f = b.child;
          g = a.child.memoizedState;
          g = null === g ? nj(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
          f.memoizedState = g;
          f.childLanes = a.childLanes & ~c;
          b.memoizedState = mj;
          return d;
        }
        f = a.child;
        a = f.sibling;
        d = Pg(f, { mode: "visible", children: d.children });
        0 === (b.mode & 1) && (d.lanes = c);
        d.return = b;
        d.sibling = null;
        null !== a && (c = b.deletions, null === c ? (b.deletions = [a], b.flags |= 16) : c.push(a));
        b.child = d;
        b.memoizedState = null;
        return d;
      }
      function qj(a, b) {
        b = pj({ mode: "visible", children: b }, a.mode, 0, null);
        b.return = a;
        return a.child = b;
      }
      function sj(a, b, c, d) {
        null !== d && Jg(d);
        Ug(b, a.child, null, c);
        a = qj(b, b.pendingProps.children);
        a.flags |= 2;
        b.memoizedState = null;
        return a;
      }
      function rj(a, b, c, d, e, f, g) {
        if (c) {
          if (b.flags & 256) return b.flags &= -257, d = Ki(Error(p(422))), sj(a, b, g, d);
          if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
          f = d.fallback;
          e = b.mode;
          d = pj({ mode: "visible", children: d.children }, e, 0, null);
          f = Tg(f, e, g, null);
          f.flags |= 2;
          d.return = b;
          f.return = b;
          d.sibling = f;
          b.child = d;
          0 !== (b.mode & 1) && Ug(b, a.child, null, g);
          b.child.memoizedState = nj(g);
          b.memoizedState = mj;
          return f;
        }
        if (0 === (b.mode & 1)) return sj(a, b, g, null);
        if ("$!" === e.data) {
          d = e.nextSibling && e.nextSibling.dataset;
          if (d) var h = d.dgst;
          d = h;
          f = Error(p(419));
          d = Ki(f, d, void 0);
          return sj(a, b, g, d);
        }
        h = 0 !== (g & a.childLanes);
        if (dh || h) {
          d = Q;
          if (null !== d) {
            switch (g & -g) {
              case 4:
                e = 2;
                break;
              case 16:
                e = 8;
                break;
              case 64:
              case 128:
              case 256:
              case 512:
              case 1024:
              case 2048:
              case 4096:
              case 8192:
              case 16384:
              case 32768:
              case 65536:
              case 131072:
              case 262144:
              case 524288:
              case 1048576:
              case 2097152:
              case 4194304:
              case 8388608:
              case 16777216:
              case 33554432:
              case 67108864:
                e = 32;
                break;
              case 536870912:
                e = 268435456;
                break;
              default:
                e = 0;
            }
            e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
            0 !== e && e !== f.retryLane && (f.retryLane = e, ih(a, e), gi(d, a, e, -1));
          }
          tj();
          d = Ki(Error(p(421)));
          return sj(a, b, g, d);
        }
        if ("$?" === e.data) return b.flags |= 128, b.child = a.child, b = uj.bind(null, a), e._reactRetry = b, null;
        a = f.treeContext;
        yg = Lf(e.nextSibling);
        xg = b;
        I = true;
        zg = null;
        null !== a && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a.id, sg = a.overflow, qg = b);
        b = qj(b, d.children);
        b.flags |= 4096;
        return b;
      }
      function vj(a, b, c) {
        a.lanes |= b;
        var d = a.alternate;
        null !== d && (d.lanes |= b);
        bh(a.return, b, c);
      }
      function wj(a, b, c, d, e) {
        var f = a.memoizedState;
        null === f ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f.isBackwards = b, f.rendering = null, f.renderingStartTime = 0, f.last = d, f.tail = c, f.tailMode = e);
      }
      function xj(a, b, c) {
        var d = b.pendingProps, e = d.revealOrder, f = d.tail;
        Xi(a, b, d.children, c);
        d = L.current;
        if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
        else {
          if (null !== a && 0 !== (a.flags & 128)) a: for (a = b.child; null !== a; ) {
            if (13 === a.tag) null !== a.memoizedState && vj(a, c, b);
            else if (19 === a.tag) vj(a, c, b);
            else if (null !== a.child) {
              a.child.return = a;
              a = a.child;
              continue;
            }
            if (a === b) break a;
            for (; null === a.sibling; ) {
              if (null === a.return || a.return === b) break a;
              a = a.return;
            }
            a.sibling.return = a.return;
            a = a.sibling;
          }
          d &= 1;
        }
        G(L, d);
        if (0 === (b.mode & 1)) b.memoizedState = null;
        else switch (e) {
          case "forwards":
            c = b.child;
            for (e = null; null !== c; ) a = c.alternate, null !== a && null === Ch(a) && (e = c), c = c.sibling;
            c = e;
            null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
            wj(b, false, e, c, f);
            break;
          case "backwards":
            c = null;
            e = b.child;
            for (b.child = null; null !== e; ) {
              a = e.alternate;
              if (null !== a && null === Ch(a)) {
                b.child = e;
                break;
              }
              a = e.sibling;
              e.sibling = c;
              c = e;
              e = a;
            }
            wj(b, true, c, null, f);
            break;
          case "together":
            wj(b, false, null, null, void 0);
            break;
          default:
            b.memoizedState = null;
        }
        return b.child;
      }
      function ij(a, b) {
        0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
      }
      function Zi(a, b, c) {
        null !== a && (b.dependencies = a.dependencies);
        rh |= b.lanes;
        if (0 === (c & b.childLanes)) return null;
        if (null !== a && b.child !== a.child) throw Error(p(153));
        if (null !== b.child) {
          a = b.child;
          c = Pg(a, a.pendingProps);
          b.child = c;
          for (c.return = b; null !== a.sibling; ) a = a.sibling, c = c.sibling = Pg(a, a.pendingProps), c.return = b;
          c.sibling = null;
        }
        return b.child;
      }
      function yj(a, b, c) {
        switch (b.tag) {
          case 3:
            kj(b);
            Ig();
            break;
          case 5:
            Ah(b);
            break;
          case 1:
            Zf(b.type) && cg(b);
            break;
          case 4:
            yh(b, b.stateNode.containerInfo);
            break;
          case 10:
            var d = b.type._context, e = b.memoizedProps.value;
            G(Wg, d._currentValue);
            d._currentValue = e;
            break;
          case 13:
            d = b.memoizedState;
            if (null !== d) {
              if (null !== d.dehydrated) return G(L, L.current & 1), b.flags |= 128, null;
              if (0 !== (c & b.child.childLanes)) return oj(a, b, c);
              G(L, L.current & 1);
              a = Zi(a, b, c);
              return null !== a ? a.sibling : null;
            }
            G(L, L.current & 1);
            break;
          case 19:
            d = 0 !== (c & b.childLanes);
            if (0 !== (a.flags & 128)) {
              if (d) return xj(a, b, c);
              b.flags |= 128;
            }
            e = b.memoizedState;
            null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
            G(L, L.current);
            if (d) break;
            else return null;
          case 22:
          case 23:
            return b.lanes = 0, dj(a, b, c);
        }
        return Zi(a, b, c);
      }
      var zj;
      var Aj;
      var Bj;
      var Cj;
      zj = function(a, b) {
        for (var c = b.child; null !== c; ) {
          if (5 === c.tag || 6 === c.tag) a.appendChild(c.stateNode);
          else if (4 !== c.tag && null !== c.child) {
            c.child.return = c;
            c = c.child;
            continue;
          }
          if (c === b) break;
          for (; null === c.sibling; ) {
            if (null === c.return || c.return === b) return;
            c = c.return;
          }
          c.sibling.return = c.return;
          c = c.sibling;
        }
      };
      Aj = function() {
      };
      Bj = function(a, b, c, d) {
        var e = a.memoizedProps;
        if (e !== d) {
          a = b.stateNode;
          xh(uh.current);
          var f = null;
          switch (c) {
            case "input":
              e = Ya(a, e);
              d = Ya(a, d);
              f = [];
              break;
            case "select":
              e = A({}, e, { value: void 0 });
              d = A({}, d, { value: void 0 });
              f = [];
              break;
            case "textarea":
              e = gb(a, e);
              d = gb(a, d);
              f = [];
              break;
            default:
              "function" !== typeof e.onClick && "function" === typeof d.onClick && (a.onclick = Bf);
          }
          ub(c, d);
          var g;
          c = null;
          for (l in e) if (!d.hasOwnProperty(l) && e.hasOwnProperty(l) && null != e[l]) if ("style" === l) {
            var h = e[l];
            for (g in h) h.hasOwnProperty(g) && (c || (c = {}), c[g] = "");
          } else "dangerouslySetInnerHTML" !== l && "children" !== l && "suppressContentEditableWarning" !== l && "suppressHydrationWarning" !== l && "autoFocus" !== l && (ea.hasOwnProperty(l) ? f || (f = []) : (f = f || []).push(l, null));
          for (l in d) {
            var k = d[l];
            h = null != e ? e[l] : void 0;
            if (d.hasOwnProperty(l) && k !== h && (null != k || null != h)) if ("style" === l) if (h) {
              for (g in h) !h.hasOwnProperty(g) || k && k.hasOwnProperty(g) || (c || (c = {}), c[g] = "");
              for (g in k) k.hasOwnProperty(g) && h[g] !== k[g] && (c || (c = {}), c[g] = k[g]);
            } else c || (f || (f = []), f.push(
              l,
              c
            )), c = k;
            else "dangerouslySetInnerHTML" === l ? (k = k ? k.__html : void 0, h = h ? h.__html : void 0, null != k && h !== k && (f = f || []).push(l, k)) : "children" === l ? "string" !== typeof k && "number" !== typeof k || (f = f || []).push(l, "" + k) : "suppressContentEditableWarning" !== l && "suppressHydrationWarning" !== l && (ea.hasOwnProperty(l) ? (null != k && "onScroll" === l && D("scroll", a), f || h === k || (f = [])) : (f = f || []).push(l, k));
          }
          c && (f = f || []).push("style", c);
          var l = f;
          if (b.updateQueue = l) b.flags |= 4;
        }
      };
      Cj = function(a, b, c, d) {
        c !== d && (b.flags |= 4);
      };
      function Dj(a, b) {
        if (!I) switch (a.tailMode) {
          case "hidden":
            b = a.tail;
            for (var c = null; null !== b; ) null !== b.alternate && (c = b), b = b.sibling;
            null === c ? a.tail = null : c.sibling = null;
            break;
          case "collapsed":
            c = a.tail;
            for (var d = null; null !== c; ) null !== c.alternate && (d = c), c = c.sibling;
            null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
        }
      }
      function S(a) {
        var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
        if (b) for (var e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
        else for (e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
        a.subtreeFlags |= d;
        a.childLanes = c;
        return b;
      }
      function Ej(a, b, c) {
        var d = b.pendingProps;
        wg(b);
        switch (b.tag) {
          case 2:
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return S(b), null;
          case 1:
            return Zf(b.type) && $f(), S(b), null;
          case 3:
            d = b.stateNode;
            zh();
            E(Wf);
            E(H);
            Eh();
            d.pendingContext && (d.context = d.pendingContext, d.pendingContext = null);
            if (null === a || null === a.child) Gg(b) ? b.flags |= 4 : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== zg && (Fj(zg), zg = null));
            Aj(a, b);
            S(b);
            return null;
          case 5:
            Bh(b);
            var e = xh(wh.current);
            c = b.type;
            if (null !== a && null != b.stateNode) Bj(a, b, c, d, e), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
            else {
              if (!d) {
                if (null === b.stateNode) throw Error(p(166));
                S(b);
                return null;
              }
              a = xh(uh.current);
              if (Gg(b)) {
                d = b.stateNode;
                c = b.type;
                var f = b.memoizedProps;
                d[Of] = b;
                d[Pf] = f;
                a = 0 !== (b.mode & 1);
                switch (c) {
                  case "dialog":
                    D("cancel", d);
                    D("close", d);
                    break;
                  case "iframe":
                  case "object":
                  case "embed":
                    D("load", d);
                    break;
                  case "video":
                  case "audio":
                    for (e = 0; e < lf.length; e++) D(lf[e], d);
                    break;
                  case "source":
                    D("error", d);
                    break;
                  case "img":
                  case "image":
                  case "link":
                    D(
                      "error",
                      d
                    );
                    D("load", d);
                    break;
                  case "details":
                    D("toggle", d);
                    break;
                  case "input":
                    Za(d, f);
                    D("invalid", d);
                    break;
                  case "select":
                    d._wrapperState = { wasMultiple: !!f.multiple };
                    D("invalid", d);
                    break;
                  case "textarea":
                    hb(d, f), D("invalid", d);
                }
                ub(c, f);
                e = null;
                for (var g in f) if (f.hasOwnProperty(g)) {
                  var h = f[g];
                  "children" === g ? "string" === typeof h ? d.textContent !== h && (true !== f.suppressHydrationWarning && Af(d.textContent, h, a), e = ["children", h]) : "number" === typeof h && d.textContent !== "" + h && (true !== f.suppressHydrationWarning && Af(
                    d.textContent,
                    h,
                    a
                  ), e = ["children", "" + h]) : ea.hasOwnProperty(g) && null != h && "onScroll" === g && D("scroll", d);
                }
                switch (c) {
                  case "input":
                    Va(d);
                    db(d, f, true);
                    break;
                  case "textarea":
                    Va(d);
                    jb(d);
                    break;
                  case "select":
                  case "option":
                    break;
                  default:
                    "function" === typeof f.onClick && (d.onclick = Bf);
                }
                d = e;
                b.updateQueue = d;
                null !== d && (b.flags |= 4);
              } else {
                g = 9 === e.nodeType ? e : e.ownerDocument;
                "http://www.w3.org/1999/xhtml" === a && (a = kb(c));
                "http://www.w3.org/1999/xhtml" === a ? "script" === c ? (a = g.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild)) : "string" === typeof d.is ? a = g.createElement(c, { is: d.is }) : (a = g.createElement(c), "select" === c && (g = a, d.multiple ? g.multiple = true : d.size && (g.size = d.size))) : a = g.createElementNS(a, c);
                a[Of] = b;
                a[Pf] = d;
                zj(a, b, false, false);
                b.stateNode = a;
                a: {
                  g = vb(c, d);
                  switch (c) {
                    case "dialog":
                      D("cancel", a);
                      D("close", a);
                      e = d;
                      break;
                    case "iframe":
                    case "object":
                    case "embed":
                      D("load", a);
                      e = d;
                      break;
                    case "video":
                    case "audio":
                      for (e = 0; e < lf.length; e++) D(lf[e], a);
                      e = d;
                      break;
                    case "source":
                      D("error", a);
                      e = d;
                      break;
                    case "img":
                    case "image":
                    case "link":
                      D(
                        "error",
                        a
                      );
                      D("load", a);
                      e = d;
                      break;
                    case "details":
                      D("toggle", a);
                      e = d;
                      break;
                    case "input":
                      Za(a, d);
                      e = Ya(a, d);
                      D("invalid", a);
                      break;
                    case "option":
                      e = d;
                      break;
                    case "select":
                      a._wrapperState = { wasMultiple: !!d.multiple };
                      e = A({}, d, { value: void 0 });
                      D("invalid", a);
                      break;
                    case "textarea":
                      hb(a, d);
                      e = gb(a, d);
                      D("invalid", a);
                      break;
                    default:
                      e = d;
                  }
                  ub(c, e);
                  h = e;
                  for (f in h) if (h.hasOwnProperty(f)) {
                    var k = h[f];
                    "style" === f ? sb(a, k) : "dangerouslySetInnerHTML" === f ? (k = k ? k.__html : void 0, null != k && nb(a, k)) : "children" === f ? "string" === typeof k ? ("textarea" !== c || "" !== k) && ob(a, k) : "number" === typeof k && ob(a, "" + k) : "suppressContentEditableWarning" !== f && "suppressHydrationWarning" !== f && "autoFocus" !== f && (ea.hasOwnProperty(f) ? null != k && "onScroll" === f && D("scroll", a) : null != k && ta(a, f, k, g));
                  }
                  switch (c) {
                    case "input":
                      Va(a);
                      db(a, d, false);
                      break;
                    case "textarea":
                      Va(a);
                      jb(a);
                      break;
                    case "option":
                      null != d.value && a.setAttribute("value", "" + Sa(d.value));
                      break;
                    case "select":
                      a.multiple = !!d.multiple;
                      f = d.value;
                      null != f ? fb(a, !!d.multiple, f, false) : null != d.defaultValue && fb(
                        a,
                        !!d.multiple,
                        d.defaultValue,
                        true
                      );
                      break;
                    default:
                      "function" === typeof e.onClick && (a.onclick = Bf);
                  }
                  switch (c) {
                    case "button":
                    case "input":
                    case "select":
                    case "textarea":
                      d = !!d.autoFocus;
                      break a;
                    case "img":
                      d = true;
                      break a;
                    default:
                      d = false;
                  }
                }
                d && (b.flags |= 4);
              }
              null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
            }
            S(b);
            return null;
          case 6:
            if (a && null != b.stateNode) Cj(a, b, a.memoizedProps, d);
            else {
              if ("string" !== typeof d && null === b.stateNode) throw Error(p(166));
              c = xh(wh.current);
              xh(uh.current);
              if (Gg(b)) {
                d = b.stateNode;
                c = b.memoizedProps;
                d[Of] = b;
                if (f = d.nodeValue !== c) {
                  if (a = xg, null !== a) switch (a.tag) {
                    case 3:
                      Af(d.nodeValue, c, 0 !== (a.mode & 1));
                      break;
                    case 5:
                      true !== a.memoizedProps.suppressHydrationWarning && Af(d.nodeValue, c, 0 !== (a.mode & 1));
                  }
                }
                f && (b.flags |= 4);
              } else d = (9 === c.nodeType ? c : c.ownerDocument).createTextNode(d), d[Of] = b, b.stateNode = d;
            }
            S(b);
            return null;
          case 13:
            E(L);
            d = b.memoizedState;
            if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
              if (I && null !== yg && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) Hg(), Ig(), b.flags |= 98560, f = false;
              else if (f = Gg(b), null !== d && null !== d.dehydrated) {
                if (null === a) {
                  if (!f) throw Error(p(318));
                  f = b.memoizedState;
                  f = null !== f ? f.dehydrated : null;
                  if (!f) throw Error(p(317));
                  f[Of] = b;
                } else Ig(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
                S(b);
                f = false;
              } else null !== zg && (Fj(zg), zg = null), f = true;
              if (!f) return b.flags & 65536 ? b : null;
            }
            if (0 !== (b.flags & 128)) return b.lanes = c, b;
            d = null !== d;
            d !== (null !== a && null !== a.memoizedState) && d && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (L.current & 1) ? 0 === T && (T = 3) : tj()));
            null !== b.updateQueue && (b.flags |= 4);
            S(b);
            return null;
          case 4:
            return zh(), Aj(a, b), null === a && sf(b.stateNode.containerInfo), S(b), null;
          case 10:
            return ah(b.type._context), S(b), null;
          case 17:
            return Zf(b.type) && $f(), S(b), null;
          case 19:
            E(L);
            f = b.memoizedState;
            if (null === f) return S(b), null;
            d = 0 !== (b.flags & 128);
            g = f.rendering;
            if (null === g) if (d) Dj(f, false);
            else {
              if (0 !== T || null !== a && 0 !== (a.flags & 128)) for (a = b.child; null !== a; ) {
                g = Ch(a);
                if (null !== g) {
                  b.flags |= 128;
                  Dj(f, false);
                  d = g.updateQueue;
                  null !== d && (b.updateQueue = d, b.flags |= 4);
                  b.subtreeFlags = 0;
                  d = c;
                  for (c = b.child; null !== c; ) f = c, a = d, f.flags &= 14680066, g = f.alternate, null === g ? (f.childLanes = 0, f.lanes = a, f.child = null, f.subtreeFlags = 0, f.memoizedProps = null, f.memoizedState = null, f.updateQueue = null, f.dependencies = null, f.stateNode = null) : (f.childLanes = g.childLanes, f.lanes = g.lanes, f.child = g.child, f.subtreeFlags = 0, f.deletions = null, f.memoizedProps = g.memoizedProps, f.memoizedState = g.memoizedState, f.updateQueue = g.updateQueue, f.type = g.type, a = g.dependencies, f.dependencies = null === a ? null : { lanes: a.lanes, firstContext: a.firstContext }), c = c.sibling;
                  G(L, L.current & 1 | 2);
                  return b.child;
                }
                a = a.sibling;
              }
              null !== f.tail && B() > Gj && (b.flags |= 128, d = true, Dj(f, false), b.lanes = 4194304);
            }
            else {
              if (!d) if (a = Ch(g), null !== a) {
                if (b.flags |= 128, d = true, c = a.updateQueue, null !== c && (b.updateQueue = c, b.flags |= 4), Dj(f, true), null === f.tail && "hidden" === f.tailMode && !g.alternate && !I) return S(b), null;
              } else 2 * B() - f.renderingStartTime > Gj && 1073741824 !== c && (b.flags |= 128, d = true, Dj(f, false), b.lanes = 4194304);
              f.isBackwards ? (g.sibling = b.child, b.child = g) : (c = f.last, null !== c ? c.sibling = g : b.child = g, f.last = g);
            }
            if (null !== f.tail) return b = f.tail, f.rendering = b, f.tail = b.sibling, f.renderingStartTime = B(), b.sibling = null, c = L.current, G(L, d ? c & 1 | 2 : c & 1), b;
            S(b);
            return null;
          case 22:
          case 23:
            return Hj(), d = null !== b.memoizedState, null !== a && null !== a.memoizedState !== d && (b.flags |= 8192), d && 0 !== (b.mode & 1) ? 0 !== (fj & 1073741824) && (S(b), b.subtreeFlags & 6 && (b.flags |= 8192)) : S(b), null;
          case 24:
            return null;
          case 25:
            return null;
        }
        throw Error(p(156, b.tag));
      }
      function Ij(a, b) {
        wg(b);
        switch (b.tag) {
          case 1:
            return Zf(b.type) && $f(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 3:
            return zh(), E(Wf), E(H), Eh(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
          case 5:
            return Bh(b), null;
          case 13:
            E(L);
            a = b.memoizedState;
            if (null !== a && null !== a.dehydrated) {
              if (null === b.alternate) throw Error(p(340));
              Ig();
            }
            a = b.flags;
            return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 19:
            return E(L), null;
          case 4:
            return zh(), null;
          case 10:
            return ah(b.type._context), null;
          case 22:
          case 23:
            return Hj(), null;
          case 24:
            return null;
          default:
            return null;
        }
      }
      var Jj = false;
      var U = false;
      var Kj = "function" === typeof WeakSet ? WeakSet : Set;
      var V = null;
      function Lj(a, b) {
        var c = a.ref;
        if (null !== c) if ("function" === typeof c) try {
          c(null);
        } catch (d) {
          W(a, b, d);
        }
        else c.current = null;
      }
      function Mj(a, b, c) {
        try {
          c();
        } catch (d) {
          W(a, b, d);
        }
      }
      var Nj = false;
      function Oj(a, b) {
        Cf = dd;
        a = Me();
        if (Ne(a)) {
          if ("selectionStart" in a) var c = { start: a.selectionStart, end: a.selectionEnd };
          else a: {
            c = (c = a.ownerDocument) && c.defaultView || window;
            var d = c.getSelection && c.getSelection();
            if (d && 0 !== d.rangeCount) {
              c = d.anchorNode;
              var e = d.anchorOffset, f = d.focusNode;
              d = d.focusOffset;
              try {
                c.nodeType, f.nodeType;
              } catch (F) {
                c = null;
                break a;
              }
              var g = 0, h = -1, k = -1, l = 0, m = 0, q = a, r = null;
              b: for (; ; ) {
                for (var y; ; ) {
                  q !== c || 0 !== e && 3 !== q.nodeType || (h = g + e);
                  q !== f || 0 !== d && 3 !== q.nodeType || (k = g + d);
                  3 === q.nodeType && (g += q.nodeValue.length);
                  if (null === (y = q.firstChild)) break;
                  r = q;
                  q = y;
                }
                for (; ; ) {
                  if (q === a) break b;
                  r === c && ++l === e && (h = g);
                  r === f && ++m === d && (k = g);
                  if (null !== (y = q.nextSibling)) break;
                  q = r;
                  r = q.parentNode;
                }
                q = y;
              }
              c = -1 === h || -1 === k ? null : { start: h, end: k };
            } else c = null;
          }
          c = c || { start: 0, end: 0 };
        } else c = null;
        Df = { focusedElem: a, selectionRange: c };
        dd = false;
        for (V = b; null !== V; ) if (b = V, a = b.child, 0 !== (b.subtreeFlags & 1028) && null !== a) a.return = b, V = a;
        else for (; null !== V; ) {
          b = V;
          try {
            var n = b.alternate;
            if (0 !== (b.flags & 1024)) switch (b.tag) {
              case 0:
              case 11:
              case 15:
                break;
              case 1:
                if (null !== n) {
                  var t = n.memoizedProps, J = n.memoizedState, x = b.stateNode, w = x.getSnapshotBeforeUpdate(b.elementType === b.type ? t : Ci(b.type, t), J);
                  x.__reactInternalSnapshotBeforeUpdate = w;
                }
                break;
              case 3:
                var u = b.stateNode.containerInfo;
                1 === u.nodeType ? u.textContent = "" : 9 === u.nodeType && u.documentElement && u.removeChild(u.documentElement);
                break;
              case 5:
              case 6:
              case 4:
              case 17:
                break;
              default:
                throw Error(p(163));
            }
          } catch (F) {
            W(b, b.return, F);
          }
          a = b.sibling;
          if (null !== a) {
            a.return = b.return;
            V = a;
            break;
          }
          V = b.return;
        }
        n = Nj;
        Nj = false;
        return n;
      }
      function Pj(a, b, c) {
        var d = b.updateQueue;
        d = null !== d ? d.lastEffect : null;
        if (null !== d) {
          var e = d = d.next;
          do {
            if ((e.tag & a) === a) {
              var f = e.destroy;
              e.destroy = void 0;
              void 0 !== f && Mj(b, c, f);
            }
            e = e.next;
          } while (e !== d);
        }
      }
      function Qj(a, b) {
        b = b.updateQueue;
        b = null !== b ? b.lastEffect : null;
        if (null !== b) {
          var c = b = b.next;
          do {
            if ((c.tag & a) === a) {
              var d = c.create;
              c.destroy = d();
            }
            c = c.next;
          } while (c !== b);
        }
      }
      function Rj(a) {
        var b = a.ref;
        if (null !== b) {
          var c = a.stateNode;
          switch (a.tag) {
            case 5:
              a = c;
              break;
            default:
              a = c;
          }
          "function" === typeof b ? b(a) : b.current = a;
        }
      }
      function Sj(a) {
        var b = a.alternate;
        null !== b && (a.alternate = null, Sj(b));
        a.child = null;
        a.deletions = null;
        a.sibling = null;
        5 === a.tag && (b = a.stateNode, null !== b && (delete b[Of], delete b[Pf], delete b[of], delete b[Qf], delete b[Rf]));
        a.stateNode = null;
        a.return = null;
        a.dependencies = null;
        a.memoizedProps = null;
        a.memoizedState = null;
        a.pendingProps = null;
        a.stateNode = null;
        a.updateQueue = null;
      }
      function Tj(a) {
        return 5 === a.tag || 3 === a.tag || 4 === a.tag;
      }
      function Uj(a) {
        a: for (; ; ) {
          for (; null === a.sibling; ) {
            if (null === a.return || Tj(a.return)) return null;
            a = a.return;
          }
          a.sibling.return = a.return;
          for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag; ) {
            if (a.flags & 2) continue a;
            if (null === a.child || 4 === a.tag) continue a;
            else a.child.return = a, a = a.child;
          }
          if (!(a.flags & 2)) return a.stateNode;
        }
      }
      function Vj(a, b, c) {
        var d = a.tag;
        if (5 === d || 6 === d) a = a.stateNode, b ? 8 === c.nodeType ? c.parentNode.insertBefore(a, b) : c.insertBefore(a, b) : (8 === c.nodeType ? (b = c.parentNode, b.insertBefore(a, c)) : (b = c, b.appendChild(a)), c = c._reactRootContainer, null !== c && void 0 !== c || null !== b.onclick || (b.onclick = Bf));
        else if (4 !== d && (a = a.child, null !== a)) for (Vj(a, b, c), a = a.sibling; null !== a; ) Vj(a, b, c), a = a.sibling;
      }
      function Wj(a, b, c) {
        var d = a.tag;
        if (5 === d || 6 === d) a = a.stateNode, b ? c.insertBefore(a, b) : c.appendChild(a);
        else if (4 !== d && (a = a.child, null !== a)) for (Wj(a, b, c), a = a.sibling; null !== a; ) Wj(a, b, c), a = a.sibling;
      }
      var X = null;
      var Xj = false;
      function Yj(a, b, c) {
        for (c = c.child; null !== c; ) Zj(a, b, c), c = c.sibling;
      }
      function Zj(a, b, c) {
        if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
          lc.onCommitFiberUnmount(kc, c);
        } catch (h) {
        }
        switch (c.tag) {
          case 5:
            U || Lj(c, b);
          case 6:
            var d = X, e = Xj;
            X = null;
            Yj(a, b, c);
            X = d;
            Xj = e;
            null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? a.parentNode.removeChild(c) : a.removeChild(c)) : X.removeChild(c.stateNode));
            break;
          case 18:
            null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? Kf(a.parentNode, c) : 1 === a.nodeType && Kf(a, c), bd(a)) : Kf(X, c.stateNode));
            break;
          case 4:
            d = X;
            e = Xj;
            X = c.stateNode.containerInfo;
            Xj = true;
            Yj(a, b, c);
            X = d;
            Xj = e;
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            if (!U && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
              e = d = d.next;
              do {
                var f = e, g = f.destroy;
                f = f.tag;
                void 0 !== g && (0 !== (f & 2) ? Mj(c, b, g) : 0 !== (f & 4) && Mj(c, b, g));
                e = e.next;
              } while (e !== d);
            }
            Yj(a, b, c);
            break;
          case 1:
            if (!U && (Lj(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
              d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
            } catch (h) {
              W(c, b, h);
            }
            Yj(a, b, c);
            break;
          case 21:
            Yj(a, b, c);
            break;
          case 22:
            c.mode & 1 ? (U = (d = U) || null !== c.memoizedState, Yj(a, b, c), U = d) : Yj(a, b, c);
            break;
          default:
            Yj(a, b, c);
        }
      }
      function ak(a) {
        var b = a.updateQueue;
        if (null !== b) {
          a.updateQueue = null;
          var c = a.stateNode;
          null === c && (c = a.stateNode = new Kj());
          b.forEach(function(b2) {
            var d = bk.bind(null, a, b2);
            c.has(b2) || (c.add(b2), b2.then(d, d));
          });
        }
      }
      function ck(a, b) {
        var c = b.deletions;
        if (null !== c) for (var d = 0; d < c.length; d++) {
          var e = c[d];
          try {
            var f = a, g = b, h = g;
            a: for (; null !== h; ) {
              switch (h.tag) {
                case 5:
                  X = h.stateNode;
                  Xj = false;
                  break a;
                case 3:
                  X = h.stateNode.containerInfo;
                  Xj = true;
                  break a;
                case 4:
                  X = h.stateNode.containerInfo;
                  Xj = true;
                  break a;
              }
              h = h.return;
            }
            if (null === X) throw Error(p(160));
            Zj(f, g, e);
            X = null;
            Xj = false;
            var k = e.alternate;
            null !== k && (k.return = null);
            e.return = null;
          } catch (l) {
            W(e, b, l);
          }
        }
        if (b.subtreeFlags & 12854) for (b = b.child; null !== b; ) dk(b, a), b = b.sibling;
      }
      function dk(a, b) {
        var c = a.alternate, d = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ck(b, a);
            ek(a);
            if (d & 4) {
              try {
                Pj(3, a, a.return), Qj(3, a);
              } catch (t) {
                W(a, a.return, t);
              }
              try {
                Pj(5, a, a.return);
              } catch (t) {
                W(a, a.return, t);
              }
            }
            break;
          case 1:
            ck(b, a);
            ek(a);
            d & 512 && null !== c && Lj(c, c.return);
            break;
          case 5:
            ck(b, a);
            ek(a);
            d & 512 && null !== c && Lj(c, c.return);
            if (a.flags & 32) {
              var e = a.stateNode;
              try {
                ob(e, "");
              } catch (t) {
                W(a, a.return, t);
              }
            }
            if (d & 4 && (e = a.stateNode, null != e)) {
              var f = a.memoizedProps, g = null !== c ? c.memoizedProps : f, h = a.type, k = a.updateQueue;
              a.updateQueue = null;
              if (null !== k) try {
                "input" === h && "radio" === f.type && null != f.name && ab(e, f);
                vb(h, g);
                var l = vb(h, f);
                for (g = 0; g < k.length; g += 2) {
                  var m = k[g], q = k[g + 1];
                  "style" === m ? sb(e, q) : "dangerouslySetInnerHTML" === m ? nb(e, q) : "children" === m ? ob(e, q) : ta(e, m, q, l);
                }
                switch (h) {
                  case "input":
                    bb(e, f);
                    break;
                  case "textarea":
                    ib(e, f);
                    break;
                  case "select":
                    var r = e._wrapperState.wasMultiple;
                    e._wrapperState.wasMultiple = !!f.multiple;
                    var y = f.value;
                    null != y ? fb(e, !!f.multiple, y, false) : r !== !!f.multiple && (null != f.defaultValue ? fb(
                      e,
                      !!f.multiple,
                      f.defaultValue,
                      true
                    ) : fb(e, !!f.multiple, f.multiple ? [] : "", false));
                }
                e[Pf] = f;
              } catch (t) {
                W(a, a.return, t);
              }
            }
            break;
          case 6:
            ck(b, a);
            ek(a);
            if (d & 4) {
              if (null === a.stateNode) throw Error(p(162));
              e = a.stateNode;
              f = a.memoizedProps;
              try {
                e.nodeValue = f;
              } catch (t) {
                W(a, a.return, t);
              }
            }
            break;
          case 3:
            ck(b, a);
            ek(a);
            if (d & 4 && null !== c && c.memoizedState.isDehydrated) try {
              bd(b.containerInfo);
            } catch (t) {
              W(a, a.return, t);
            }
            break;
          case 4:
            ck(b, a);
            ek(a);
            break;
          case 13:
            ck(b, a);
            ek(a);
            e = a.child;
            e.flags & 8192 && (f = null !== e.memoizedState, e.stateNode.isHidden = f, !f || null !== e.alternate && null !== e.alternate.memoizedState || (fk = B()));
            d & 4 && ak(a);
            break;
          case 22:
            m = null !== c && null !== c.memoizedState;
            a.mode & 1 ? (U = (l = U) || m, ck(b, a), U = l) : ck(b, a);
            ek(a);
            if (d & 8192) {
              l = null !== a.memoizedState;
              if ((a.stateNode.isHidden = l) && !m && 0 !== (a.mode & 1)) for (V = a, m = a.child; null !== m; ) {
                for (q = V = m; null !== V; ) {
                  r = V;
                  y = r.child;
                  switch (r.tag) {
                    case 0:
                    case 11:
                    case 14:
                    case 15:
                      Pj(4, r, r.return);
                      break;
                    case 1:
                      Lj(r, r.return);
                      var n = r.stateNode;
                      if ("function" === typeof n.componentWillUnmount) {
                        d = r;
                        c = r.return;
                        try {
                          b = d, n.props = b.memoizedProps, n.state = b.memoizedState, n.componentWillUnmount();
                        } catch (t) {
                          W(d, c, t);
                        }
                      }
                      break;
                    case 5:
                      Lj(r, r.return);
                      break;
                    case 22:
                      if (null !== r.memoizedState) {
                        gk(q);
                        continue;
                      }
                  }
                  null !== y ? (y.return = r, V = y) : gk(q);
                }
                m = m.sibling;
              }
              a: for (m = null, q = a; ; ) {
                if (5 === q.tag) {
                  if (null === m) {
                    m = q;
                    try {
                      e = q.stateNode, l ? (f = e.style, "function" === typeof f.setProperty ? f.setProperty("display", "none", "important") : f.display = "none") : (h = q.stateNode, k = q.memoizedProps.style, g = void 0 !== k && null !== k && k.hasOwnProperty("display") ? k.display : null, h.style.display = rb("display", g));
                    } catch (t) {
                      W(a, a.return, t);
                    }
                  }
                } else if (6 === q.tag) {
                  if (null === m) try {
                    q.stateNode.nodeValue = l ? "" : q.memoizedProps;
                  } catch (t) {
                    W(a, a.return, t);
                  }
                } else if ((22 !== q.tag && 23 !== q.tag || null === q.memoizedState || q === a) && null !== q.child) {
                  q.child.return = q;
                  q = q.child;
                  continue;
                }
                if (q === a) break a;
                for (; null === q.sibling; ) {
                  if (null === q.return || q.return === a) break a;
                  m === q && (m = null);
                  q = q.return;
                }
                m === q && (m = null);
                q.sibling.return = q.return;
                q = q.sibling;
              }
            }
            break;
          case 19:
            ck(b, a);
            ek(a);
            d & 4 && ak(a);
            break;
          case 21:
            break;
          default:
            ck(
              b,
              a
            ), ek(a);
        }
      }
      function ek(a) {
        var b = a.flags;
        if (b & 2) {
          try {
            a: {
              for (var c = a.return; null !== c; ) {
                if (Tj(c)) {
                  var d = c;
                  break a;
                }
                c = c.return;
              }
              throw Error(p(160));
            }
            switch (d.tag) {
              case 5:
                var e = d.stateNode;
                d.flags & 32 && (ob(e, ""), d.flags &= -33);
                var f = Uj(a);
                Wj(a, f, e);
                break;
              case 3:
              case 4:
                var g = d.stateNode.containerInfo, h = Uj(a);
                Vj(a, h, g);
                break;
              default:
                throw Error(p(161));
            }
          } catch (k) {
            W(a, a.return, k);
          }
          a.flags &= -3;
        }
        b & 4096 && (a.flags &= -4097);
      }
      function hk(a, b, c) {
        V = a;
        ik(a, b, c);
      }
      function ik(a, b, c) {
        for (var d = 0 !== (a.mode & 1); null !== V; ) {
          var e = V, f = e.child;
          if (22 === e.tag && d) {
            var g = null !== e.memoizedState || Jj;
            if (!g) {
              var h = e.alternate, k = null !== h && null !== h.memoizedState || U;
              h = Jj;
              var l = U;
              Jj = g;
              if ((U = k) && !l) for (V = e; null !== V; ) g = V, k = g.child, 22 === g.tag && null !== g.memoizedState ? jk(e) : null !== k ? (k.return = g, V = k) : jk(e);
              for (; null !== f; ) V = f, ik(f, b, c), f = f.sibling;
              V = e;
              Jj = h;
              U = l;
            }
            kk(a, b, c);
          } else 0 !== (e.subtreeFlags & 8772) && null !== f ? (f.return = e, V = f) : kk(a, b, c);
        }
      }
      function kk(a) {
        for (; null !== V; ) {
          var b = V;
          if (0 !== (b.flags & 8772)) {
            var c = b.alternate;
            try {
              if (0 !== (b.flags & 8772)) switch (b.tag) {
                case 0:
                case 11:
                case 15:
                  U || Qj(5, b);
                  break;
                case 1:
                  var d = b.stateNode;
                  if (b.flags & 4 && !U) if (null === c) d.componentDidMount();
                  else {
                    var e = b.elementType === b.type ? c.memoizedProps : Ci(b.type, c.memoizedProps);
                    d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
                  }
                  var f = b.updateQueue;
                  null !== f && sh(b, f, d);
                  break;
                case 3:
                  var g = b.updateQueue;
                  if (null !== g) {
                    c = null;
                    if (null !== b.child) switch (b.child.tag) {
                      case 5:
                        c = b.child.stateNode;
                        break;
                      case 1:
                        c = b.child.stateNode;
                    }
                    sh(b, g, c);
                  }
                  break;
                case 5:
                  var h = b.stateNode;
                  if (null === c && b.flags & 4) {
                    c = h;
                    var k = b.memoizedProps;
                    switch (b.type) {
                      case "button":
                      case "input":
                      case "select":
                      case "textarea":
                        k.autoFocus && c.focus();
                        break;
                      case "img":
                        k.src && (c.src = k.src);
                    }
                  }
                  break;
                case 6:
                  break;
                case 4:
                  break;
                case 12:
                  break;
                case 13:
                  if (null === b.memoizedState) {
                    var l = b.alternate;
                    if (null !== l) {
                      var m = l.memoizedState;
                      if (null !== m) {
                        var q = m.dehydrated;
                        null !== q && bd(q);
                      }
                    }
                  }
                  break;
                case 19:
                case 17:
                case 21:
                case 22:
                case 23:
                case 25:
                  break;
                default:
                  throw Error(p(163));
              }
              U || b.flags & 512 && Rj(b);
            } catch (r) {
              W(b, b.return, r);
            }
          }
          if (b === a) {
            V = null;
            break;
          }
          c = b.sibling;
          if (null !== c) {
            c.return = b.return;
            V = c;
            break;
          }
          V = b.return;
        }
      }
      function gk(a) {
        for (; null !== V; ) {
          var b = V;
          if (b === a) {
            V = null;
            break;
          }
          var c = b.sibling;
          if (null !== c) {
            c.return = b.return;
            V = c;
            break;
          }
          V = b.return;
        }
      }
      function jk(a) {
        for (; null !== V; ) {
          var b = V;
          try {
            switch (b.tag) {
              case 0:
              case 11:
              case 15:
                var c = b.return;
                try {
                  Qj(4, b);
                } catch (k) {
                  W(b, c, k);
                }
                break;
              case 1:
                var d = b.stateNode;
                if ("function" === typeof d.componentDidMount) {
                  var e = b.return;
                  try {
                    d.componentDidMount();
                  } catch (k) {
                    W(b, e, k);
                  }
                }
                var f = b.return;
                try {
                  Rj(b);
                } catch (k) {
                  W(b, f, k);
                }
                break;
              case 5:
                var g = b.return;
                try {
                  Rj(b);
                } catch (k) {
                  W(b, g, k);
                }
            }
          } catch (k) {
            W(b, b.return, k);
          }
          if (b === a) {
            V = null;
            break;
          }
          var h = b.sibling;
          if (null !== h) {
            h.return = b.return;
            V = h;
            break;
          }
          V = b.return;
        }
      }
      var lk = Math.ceil;
      var mk = ua.ReactCurrentDispatcher;
      var nk = ua.ReactCurrentOwner;
      var ok = ua.ReactCurrentBatchConfig;
      var K = 0;
      var Q = null;
      var Y = null;
      var Z = 0;
      var fj = 0;
      var ej = Uf(0);
      var T = 0;
      var pk = null;
      var rh = 0;
      var qk = 0;
      var rk = 0;
      var sk = null;
      var tk = null;
      var fk = 0;
      var Gj = Infinity;
      var uk = null;
      var Oi = false;
      var Pi = null;
      var Ri = null;
      var vk = false;
      var wk = null;
      var xk = 0;
      var yk = 0;
      var zk = null;
      var Ak = -1;
      var Bk = 0;
      function R() {
        return 0 !== (K & 6) ? B() : -1 !== Ak ? Ak : Ak = B();
      }
      function yi(a) {
        if (0 === (a.mode & 1)) return 1;
        if (0 !== (K & 2) && 0 !== Z) return Z & -Z;
        if (null !== Kg.transition) return 0 === Bk && (Bk = yc()), Bk;
        a = C;
        if (0 !== a) return a;
        a = window.event;
        a = void 0 === a ? 16 : jd(a.type);
        return a;
      }
      function gi(a, b, c, d) {
        if (50 < yk) throw yk = 0, zk = null, Error(p(185));
        Ac(a, c, d);
        if (0 === (K & 2) || a !== Q) a === Q && (0 === (K & 2) && (qk |= c), 4 === T && Ck(a, Z)), Dk(a, d), 1 === c && 0 === K && 0 === (b.mode & 1) && (Gj = B() + 500, fg && jg());
      }
      function Dk(a, b) {
        var c = a.callbackNode;
        wc(a, b);
        var d = uc(a, a === Q ? Z : 0);
        if (0 === d) null !== c && bc(c), a.callbackNode = null, a.callbackPriority = 0;
        else if (b = d & -d, a.callbackPriority !== b) {
          null != c && bc(c);
          if (1 === b) 0 === a.tag ? ig(Ek.bind(null, a)) : hg(Ek.bind(null, a)), Jf(function() {
            0 === (K & 6) && jg();
          }), c = null;
          else {
            switch (Dc(d)) {
              case 1:
                c = fc;
                break;
              case 4:
                c = gc;
                break;
              case 16:
                c = hc;
                break;
              case 536870912:
                c = jc;
                break;
              default:
                c = hc;
            }
            c = Fk(c, Gk.bind(null, a));
          }
          a.callbackPriority = b;
          a.callbackNode = c;
        }
      }
      function Gk(a, b) {
        Ak = -1;
        Bk = 0;
        if (0 !== (K & 6)) throw Error(p(327));
        var c = a.callbackNode;
        if (Hk() && a.callbackNode !== c) return null;
        var d = uc(a, a === Q ? Z : 0);
        if (0 === d) return null;
        if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Ik(a, d);
        else {
          b = d;
          var e = K;
          K |= 2;
          var f = Jk();
          if (Q !== a || Z !== b) uk = null, Gj = B() + 500, Kk(a, b);
          do
            try {
              Lk();
              break;
            } catch (h) {
              Mk(a, h);
            }
          while (1);
          $g();
          mk.current = f;
          K = e;
          null !== Y ? b = 0 : (Q = null, Z = 0, b = T);
        }
        if (0 !== b) {
          2 === b && (e = xc(a), 0 !== e && (d = e, b = Nk(a, e)));
          if (1 === b) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
          if (6 === b) Ck(a, d);
          else {
            e = a.current.alternate;
            if (0 === (d & 30) && !Ok(e) && (b = Ik(a, d), 2 === b && (f = xc(a), 0 !== f && (d = f, b = Nk(a, f))), 1 === b)) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
            a.finishedWork = e;
            a.finishedLanes = d;
            switch (b) {
              case 0:
              case 1:
                throw Error(p(345));
              case 2:
                Pk(a, tk, uk);
                break;
              case 3:
                Ck(a, d);
                if ((d & 130023424) === d && (b = fk + 500 - B(), 10 < b)) {
                  if (0 !== uc(a, 0)) break;
                  e = a.suspendedLanes;
                  if ((e & d) !== d) {
                    R();
                    a.pingedLanes |= a.suspendedLanes & e;
                    break;
                  }
                  a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), b);
                  break;
                }
                Pk(a, tk, uk);
                break;
              case 4:
                Ck(a, d);
                if ((d & 4194240) === d) break;
                b = a.eventTimes;
                for (e = -1; 0 < d; ) {
                  var g = 31 - oc(d);
                  f = 1 << g;
                  g = b[g];
                  g > e && (e = g);
                  d &= ~f;
                }
                d = e;
                d = B() - d;
                d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * lk(d / 1960)) - d;
                if (10 < d) {
                  a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), d);
                  break;
                }
                Pk(a, tk, uk);
                break;
              case 5:
                Pk(a, tk, uk);
                break;
              default:
                throw Error(p(329));
            }
          }
        }
        Dk(a, B());
        return a.callbackNode === c ? Gk.bind(null, a) : null;
      }
      function Nk(a, b) {
        var c = sk;
        a.current.memoizedState.isDehydrated && (Kk(a, b).flags |= 256);
        a = Ik(a, b);
        2 !== a && (b = tk, tk = c, null !== b && Fj(b));
        return a;
      }
      function Fj(a) {
        null === tk ? tk = a : tk.push.apply(tk, a);
      }
      function Ok(a) {
        for (var b = a; ; ) {
          if (b.flags & 16384) {
            var c = b.updateQueue;
            if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
              var e = c[d], f = e.getSnapshot;
              e = e.value;
              try {
                if (!He(f(), e)) return false;
              } catch (g) {
                return false;
              }
            }
          }
          c = b.child;
          if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
          else {
            if (b === a) break;
            for (; null === b.sibling; ) {
              if (null === b.return || b.return === a) return true;
              b = b.return;
            }
            b.sibling.return = b.return;
            b = b.sibling;
          }
        }
        return true;
      }
      function Ck(a, b) {
        b &= ~rk;
        b &= ~qk;
        a.suspendedLanes |= b;
        a.pingedLanes &= ~b;
        for (a = a.expirationTimes; 0 < b; ) {
          var c = 31 - oc(b), d = 1 << c;
          a[c] = -1;
          b &= ~d;
        }
      }
      function Ek(a) {
        if (0 !== (K & 6)) throw Error(p(327));
        Hk();
        var b = uc(a, 0);
        if (0 === (b & 1)) return Dk(a, B()), null;
        var c = Ik(a, b);
        if (0 !== a.tag && 2 === c) {
          var d = xc(a);
          0 !== d && (b = d, c = Nk(a, d));
        }
        if (1 === c) throw c = pk, Kk(a, 0), Ck(a, b), Dk(a, B()), c;
        if (6 === c) throw Error(p(345));
        a.finishedWork = a.current.alternate;
        a.finishedLanes = b;
        Pk(a, tk, uk);
        Dk(a, B());
        return null;
      }
      function Qk(a, b) {
        var c = K;
        K |= 1;
        try {
          return a(b);
        } finally {
          K = c, 0 === K && (Gj = B() + 500, fg && jg());
        }
      }
      function Rk(a) {
        null !== wk && 0 === wk.tag && 0 === (K & 6) && Hk();
        var b = K;
        K |= 1;
        var c = ok.transition, d = C;
        try {
          if (ok.transition = null, C = 1, a) return a();
        } finally {
          C = d, ok.transition = c, K = b, 0 === (K & 6) && jg();
        }
      }
      function Hj() {
        fj = ej.current;
        E(ej);
      }
      function Kk(a, b) {
        a.finishedWork = null;
        a.finishedLanes = 0;
        var c = a.timeoutHandle;
        -1 !== c && (a.timeoutHandle = -1, Gf(c));
        if (null !== Y) for (c = Y.return; null !== c; ) {
          var d = c;
          wg(d);
          switch (d.tag) {
            case 1:
              d = d.type.childContextTypes;
              null !== d && void 0 !== d && $f();
              break;
            case 3:
              zh();
              E(Wf);
              E(H);
              Eh();
              break;
            case 5:
              Bh(d);
              break;
            case 4:
              zh();
              break;
            case 13:
              E(L);
              break;
            case 19:
              E(L);
              break;
            case 10:
              ah(d.type._context);
              break;
            case 22:
            case 23:
              Hj();
          }
          c = c.return;
        }
        Q = a;
        Y = a = Pg(a.current, null);
        Z = fj = b;
        T = 0;
        pk = null;
        rk = qk = rh = 0;
        tk = sk = null;
        if (null !== fh) {
          for (b = 0; b < fh.length; b++) if (c = fh[b], d = c.interleaved, null !== d) {
            c.interleaved = null;
            var e = d.next, f = c.pending;
            if (null !== f) {
              var g = f.next;
              f.next = e;
              d.next = g;
            }
            c.pending = d;
          }
          fh = null;
        }
        return a;
      }
      function Mk(a, b) {
        do {
          var c = Y;
          try {
            $g();
            Fh.current = Rh;
            if (Ih) {
              for (var d = M.memoizedState; null !== d; ) {
                var e = d.queue;
                null !== e && (e.pending = null);
                d = d.next;
              }
              Ih = false;
            }
            Hh = 0;
            O = N = M = null;
            Jh = false;
            Kh = 0;
            nk.current = null;
            if (null === c || null === c.return) {
              T = 1;
              pk = b;
              Y = null;
              break;
            }
            a: {
              var f = a, g = c.return, h = c, k = b;
              b = Z;
              h.flags |= 32768;
              if (null !== k && "object" === typeof k && "function" === typeof k.then) {
                var l = k, m = h, q = m.tag;
                if (0 === (m.mode & 1) && (0 === q || 11 === q || 15 === q)) {
                  var r = m.alternate;
                  r ? (m.updateQueue = r.updateQueue, m.memoizedState = r.memoizedState, m.lanes = r.lanes) : (m.updateQueue = null, m.memoizedState = null);
                }
                var y = Ui(g);
                if (null !== y) {
                  y.flags &= -257;
                  Vi(y, g, h, f, b);
                  y.mode & 1 && Si(f, l, b);
                  b = y;
                  k = l;
                  var n = b.updateQueue;
                  if (null === n) {
                    var t = /* @__PURE__ */ new Set();
                    t.add(k);
                    b.updateQueue = t;
                  } else n.add(k);
                  break a;
                } else {
                  if (0 === (b & 1)) {
                    Si(f, l, b);
                    tj();
                    break a;
                  }
                  k = Error(p(426));
                }
              } else if (I && h.mode & 1) {
                var J = Ui(g);
                if (null !== J) {
                  0 === (J.flags & 65536) && (J.flags |= 256);
                  Vi(J, g, h, f, b);
                  Jg(Ji(k, h));
                  break a;
                }
              }
              f = k = Ji(k, h);
              4 !== T && (T = 2);
              null === sk ? sk = [f] : sk.push(f);
              f = g;
              do {
                switch (f.tag) {
                  case 3:
                    f.flags |= 65536;
                    b &= -b;
                    f.lanes |= b;
                    var x = Ni(f, k, b);
                    ph(f, x);
                    break a;
                  case 1:
                    h = k;
                    var w = f.type, u = f.stateNode;
                    if (0 === (f.flags & 128) && ("function" === typeof w.getDerivedStateFromError || null !== u && "function" === typeof u.componentDidCatch && (null === Ri || !Ri.has(u)))) {
                      f.flags |= 65536;
                      b &= -b;
                      f.lanes |= b;
                      var F = Qi(f, h, b);
                      ph(f, F);
                      break a;
                    }
                }
                f = f.return;
              } while (null !== f);
            }
            Sk(c);
          } catch (na) {
            b = na;
            Y === c && null !== c && (Y = c = c.return);
            continue;
          }
          break;
        } while (1);
      }
      function Jk() {
        var a = mk.current;
        mk.current = Rh;
        return null === a ? Rh : a;
      }
      function tj() {
        if (0 === T || 3 === T || 2 === T) T = 4;
        null === Q || 0 === (rh & 268435455) && 0 === (qk & 268435455) || Ck(Q, Z);
      }
      function Ik(a, b) {
        var c = K;
        K |= 2;
        var d = Jk();
        if (Q !== a || Z !== b) uk = null, Kk(a, b);
        do
          try {
            Tk();
            break;
          } catch (e) {
            Mk(a, e);
          }
        while (1);
        $g();
        K = c;
        mk.current = d;
        if (null !== Y) throw Error(p(261));
        Q = null;
        Z = 0;
        return T;
      }
      function Tk() {
        for (; null !== Y; ) Uk(Y);
      }
      function Lk() {
        for (; null !== Y && !cc(); ) Uk(Y);
      }
      function Uk(a) {
        var b = Vk(a.alternate, a, fj);
        a.memoizedProps = a.pendingProps;
        null === b ? Sk(a) : Y = b;
        nk.current = null;
      }
      function Sk(a) {
        var b = a;
        do {
          var c = b.alternate;
          a = b.return;
          if (0 === (b.flags & 32768)) {
            if (c = Ej(c, b, fj), null !== c) {
              Y = c;
              return;
            }
          } else {
            c = Ij(c, b);
            if (null !== c) {
              c.flags &= 32767;
              Y = c;
              return;
            }
            if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
            else {
              T = 6;
              Y = null;
              return;
            }
          }
          b = b.sibling;
          if (null !== b) {
            Y = b;
            return;
          }
          Y = b = a;
        } while (null !== b);
        0 === T && (T = 5);
      }
      function Pk(a, b, c) {
        var d = C, e = ok.transition;
        try {
          ok.transition = null, C = 1, Wk(a, b, c, d);
        } finally {
          ok.transition = e, C = d;
        }
        return null;
      }
      function Wk(a, b, c, d) {
        do
          Hk();
        while (null !== wk);
        if (0 !== (K & 6)) throw Error(p(327));
        c = a.finishedWork;
        var e = a.finishedLanes;
        if (null === c) return null;
        a.finishedWork = null;
        a.finishedLanes = 0;
        if (c === a.current) throw Error(p(177));
        a.callbackNode = null;
        a.callbackPriority = 0;
        var f = c.lanes | c.childLanes;
        Bc(a, f);
        a === Q && (Y = Q = null, Z = 0);
        0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || vk || (vk = true, Fk(hc, function() {
          Hk();
          return null;
        }));
        f = 0 !== (c.flags & 15990);
        if (0 !== (c.subtreeFlags & 15990) || f) {
          f = ok.transition;
          ok.transition = null;
          var g = C;
          C = 1;
          var h = K;
          K |= 4;
          nk.current = null;
          Oj(a, c);
          dk(c, a);
          Oe(Df);
          dd = !!Cf;
          Df = Cf = null;
          a.current = c;
          hk(c, a, e);
          dc();
          K = h;
          C = g;
          ok.transition = f;
        } else a.current = c;
        vk && (vk = false, wk = a, xk = e);
        f = a.pendingLanes;
        0 === f && (Ri = null);
        mc(c.stateNode, d);
        Dk(a, B());
        if (null !== b) for (d = a.onRecoverableError, c = 0; c < b.length; c++) e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
        if (Oi) throw Oi = false, a = Pi, Pi = null, a;
        0 !== (xk & 1) && 0 !== a.tag && Hk();
        f = a.pendingLanes;
        0 !== (f & 1) ? a === zk ? yk++ : (yk = 0, zk = a) : yk = 0;
        jg();
        return null;
      }
      function Hk() {
        if (null !== wk) {
          var a = Dc(xk), b = ok.transition, c = C;
          try {
            ok.transition = null;
            C = 16 > a ? 16 : a;
            if (null === wk) var d = false;
            else {
              a = wk;
              wk = null;
              xk = 0;
              if (0 !== (K & 6)) throw Error(p(331));
              var e = K;
              K |= 4;
              for (V = a.current; null !== V; ) {
                var f = V, g = f.child;
                if (0 !== (V.flags & 16)) {
                  var h = f.deletions;
                  if (null !== h) {
                    for (var k = 0; k < h.length; k++) {
                      var l = h[k];
                      for (V = l; null !== V; ) {
                        var m = V;
                        switch (m.tag) {
                          case 0:
                          case 11:
                          case 15:
                            Pj(8, m, f);
                        }
                        var q = m.child;
                        if (null !== q) q.return = m, V = q;
                        else for (; null !== V; ) {
                          m = V;
                          var r = m.sibling, y = m.return;
                          Sj(m);
                          if (m === l) {
                            V = null;
                            break;
                          }
                          if (null !== r) {
                            r.return = y;
                            V = r;
                            break;
                          }
                          V = y;
                        }
                      }
                    }
                    var n = f.alternate;
                    if (null !== n) {
                      var t = n.child;
                      if (null !== t) {
                        n.child = null;
                        do {
                          var J = t.sibling;
                          t.sibling = null;
                          t = J;
                        } while (null !== t);
                      }
                    }
                    V = f;
                  }
                }
                if (0 !== (f.subtreeFlags & 2064) && null !== g) g.return = f, V = g;
                else b: for (; null !== V; ) {
                  f = V;
                  if (0 !== (f.flags & 2048)) switch (f.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Pj(9, f, f.return);
                  }
                  var x = f.sibling;
                  if (null !== x) {
                    x.return = f.return;
                    V = x;
                    break b;
                  }
                  V = f.return;
                }
              }
              var w = a.current;
              for (V = w; null !== V; ) {
                g = V;
                var u = g.child;
                if (0 !== (g.subtreeFlags & 2064) && null !== u) u.return = g, V = u;
                else b: for (g = w; null !== V; ) {
                  h = V;
                  if (0 !== (h.flags & 2048)) try {
                    switch (h.tag) {
                      case 0:
                      case 11:
                      case 15:
                        Qj(9, h);
                    }
                  } catch (na) {
                    W(h, h.return, na);
                  }
                  if (h === g) {
                    V = null;
                    break b;
                  }
                  var F = h.sibling;
                  if (null !== F) {
                    F.return = h.return;
                    V = F;
                    break b;
                  }
                  V = h.return;
                }
              }
              K = e;
              jg();
              if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
                lc.onPostCommitFiberRoot(kc, a);
              } catch (na) {
              }
              d = true;
            }
            return d;
          } finally {
            C = c, ok.transition = b;
          }
        }
        return false;
      }
      function Xk(a, b, c) {
        b = Ji(c, b);
        b = Ni(a, b, 1);
        a = nh(a, b, 1);
        b = R();
        null !== a && (Ac(a, 1, b), Dk(a, b));
      }
      function W(a, b, c) {
        if (3 === a.tag) Xk(a, a, c);
        else for (; null !== b; ) {
          if (3 === b.tag) {
            Xk(b, a, c);
            break;
          } else if (1 === b.tag) {
            var d = b.stateNode;
            if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Ri || !Ri.has(d))) {
              a = Ji(c, a);
              a = Qi(b, a, 1);
              b = nh(b, a, 1);
              a = R();
              null !== b && (Ac(b, 1, a), Dk(b, a));
              break;
            }
          }
          b = b.return;
        }
      }
      function Ti(a, b, c) {
        var d = a.pingCache;
        null !== d && d.delete(b);
        b = R();
        a.pingedLanes |= a.suspendedLanes & c;
        Q === a && (Z & c) === c && (4 === T || 3 === T && (Z & 130023424) === Z && 500 > B() - fk ? Kk(a, 0) : rk |= c);
        Dk(a, b);
      }
      function Yk(a, b) {
        0 === b && (0 === (a.mode & 1) ? b = 1 : (b = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
        var c = R();
        a = ih(a, b);
        null !== a && (Ac(a, b, c), Dk(a, c));
      }
      function uj(a) {
        var b = a.memoizedState, c = 0;
        null !== b && (c = b.retryLane);
        Yk(a, c);
      }
      function bk(a, b) {
        var c = 0;
        switch (a.tag) {
          case 13:
            var d = a.stateNode;
            var e = a.memoizedState;
            null !== e && (c = e.retryLane);
            break;
          case 19:
            d = a.stateNode;
            break;
          default:
            throw Error(p(314));
        }
        null !== d && d.delete(b);
        Yk(a, c);
      }
      var Vk;
      Vk = function(a, b, c) {
        if (null !== a) if (a.memoizedProps !== b.pendingProps || Wf.current) dh = true;
        else {
          if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return dh = false, yj(a, b, c);
          dh = 0 !== (a.flags & 131072) ? true : false;
        }
        else dh = false, I && 0 !== (b.flags & 1048576) && ug(b, ng, b.index);
        b.lanes = 0;
        switch (b.tag) {
          case 2:
            var d = b.type;
            ij(a, b);
            a = b.pendingProps;
            var e = Yf(b, H.current);
            ch(b, c);
            e = Nh(null, b, d, a, e, c);
            var f = Sh();
            b.flags |= 1;
            "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, Zf(d) ? (f = true, cg(b)) : f = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, kh(b), e.updater = Ei, b.stateNode = e, e._reactInternals = b, Ii(b, d, a, c), b = jj(null, b, d, true, f, c)) : (b.tag = 0, I && f && vg(b), Xi(null, b, e, c), b = b.child);
            return b;
          case 16:
            d = b.elementType;
            a: {
              ij(a, b);
              a = b.pendingProps;
              e = d._init;
              d = e(d._payload);
              b.type = d;
              e = b.tag = Zk(d);
              a = Ci(d, a);
              switch (e) {
                case 0:
                  b = cj(null, b, d, a, c);
                  break a;
                case 1:
                  b = hj(null, b, d, a, c);
                  break a;
                case 11:
                  b = Yi(null, b, d, a, c);
                  break a;
                case 14:
                  b = $i(null, b, d, Ci(d.type, a), c);
                  break a;
              }
              throw Error(p(
                306,
                d,
                ""
              ));
            }
            return b;
          case 0:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), cj(a, b, d, e, c);
          case 1:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), hj(a, b, d, e, c);
          case 3:
            a: {
              kj(b);
              if (null === a) throw Error(p(387));
              d = b.pendingProps;
              f = b.memoizedState;
              e = f.element;
              lh(a, b);
              qh(b, d, null, c);
              var g = b.memoizedState;
              d = g.element;
              if (f.isDehydrated) if (f = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f, b.memoizedState = f, b.flags & 256) {
                e = Ji(Error(p(423)), b);
                b = lj(a, b, d, c, e);
                break a;
              } else if (d !== e) {
                e = Ji(Error(p(424)), b);
                b = lj(a, b, d, c, e);
                break a;
              } else for (yg = Lf(b.stateNode.containerInfo.firstChild), xg = b, I = true, zg = null, c = Vg(b, null, d, c), b.child = c; c; ) c.flags = c.flags & -3 | 4096, c = c.sibling;
              else {
                Ig();
                if (d === e) {
                  b = Zi(a, b, c);
                  break a;
                }
                Xi(a, b, d, c);
              }
              b = b.child;
            }
            return b;
          case 5:
            return Ah(b), null === a && Eg(b), d = b.type, e = b.pendingProps, f = null !== a ? a.memoizedProps : null, g = e.children, Ef(d, e) ? g = null : null !== f && Ef(d, f) && (b.flags |= 32), gj(a, b), Xi(a, b, g, c), b.child;
          case 6:
            return null === a && Eg(b), null;
          case 13:
            return oj(a, b, c);
          case 4:
            return yh(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Ug(b, null, d, c) : Xi(a, b, d, c), b.child;
          case 11:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), Yi(a, b, d, e, c);
          case 7:
            return Xi(a, b, b.pendingProps, c), b.child;
          case 8:
            return Xi(a, b, b.pendingProps.children, c), b.child;
          case 12:
            return Xi(a, b, b.pendingProps.children, c), b.child;
          case 10:
            a: {
              d = b.type._context;
              e = b.pendingProps;
              f = b.memoizedProps;
              g = e.value;
              G(Wg, d._currentValue);
              d._currentValue = g;
              if (null !== f) if (He(f.value, g)) {
                if (f.children === e.children && !Wf.current) {
                  b = Zi(a, b, c);
                  break a;
                }
              } else for (f = b.child, null !== f && (f.return = b); null !== f; ) {
                var h = f.dependencies;
                if (null !== h) {
                  g = f.child;
                  for (var k = h.firstContext; null !== k; ) {
                    if (k.context === d) {
                      if (1 === f.tag) {
                        k = mh(-1, c & -c);
                        k.tag = 2;
                        var l = f.updateQueue;
                        if (null !== l) {
                          l = l.shared;
                          var m = l.pending;
                          null === m ? k.next = k : (k.next = m.next, m.next = k);
                          l.pending = k;
                        }
                      }
                      f.lanes |= c;
                      k = f.alternate;
                      null !== k && (k.lanes |= c);
                      bh(
                        f.return,
                        c,
                        b
                      );
                      h.lanes |= c;
                      break;
                    }
                    k = k.next;
                  }
                } else if (10 === f.tag) g = f.type === b.type ? null : f.child;
                else if (18 === f.tag) {
                  g = f.return;
                  if (null === g) throw Error(p(341));
                  g.lanes |= c;
                  h = g.alternate;
                  null !== h && (h.lanes |= c);
                  bh(g, c, b);
                  g = f.sibling;
                } else g = f.child;
                if (null !== g) g.return = f;
                else for (g = f; null !== g; ) {
                  if (g === b) {
                    g = null;
                    break;
                  }
                  f = g.sibling;
                  if (null !== f) {
                    f.return = g.return;
                    g = f;
                    break;
                  }
                  g = g.return;
                }
                f = g;
              }
              Xi(a, b, e.children, c);
              b = b.child;
            }
            return b;
          case 9:
            return e = b.type, d = b.pendingProps.children, ch(b, c), e = eh(e), d = d(e), b.flags |= 1, Xi(a, b, d, c), b.child;
          case 14:
            return d = b.type, e = Ci(d, b.pendingProps), e = Ci(d.type, e), $i(a, b, d, e, c);
          case 15:
            return bj(a, b, b.type, b.pendingProps, c);
          case 17:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), ij(a, b), b.tag = 1, Zf(d) ? (a = true, cg(b)) : a = false, ch(b, c), Gi(b, d, e), Ii(b, d, e, c), jj(null, b, d, true, a, c);
          case 19:
            return xj(a, b, c);
          case 22:
            return dj(a, b, c);
        }
        throw Error(p(156, b.tag));
      };
      function Fk(a, b) {
        return ac(a, b);
      }
      function $k(a, b, c, d) {
        this.tag = a;
        this.key = c;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.ref = null;
        this.pendingProps = b;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = d;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function Bg(a, b, c, d) {
        return new $k(a, b, c, d);
      }
      function aj(a) {
        a = a.prototype;
        return !(!a || !a.isReactComponent);
      }
      function Zk(a) {
        if ("function" === typeof a) return aj(a) ? 1 : 0;
        if (void 0 !== a && null !== a) {
          a = a.$$typeof;
          if (a === Da) return 11;
          if (a === Ga) return 14;
        }
        return 2;
      }
      function Pg(a, b) {
        var c = a.alternate;
        null === c ? (c = Bg(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
        c.flags = a.flags & 14680064;
        c.childLanes = a.childLanes;
        c.lanes = a.lanes;
        c.child = a.child;
        c.memoizedProps = a.memoizedProps;
        c.memoizedState = a.memoizedState;
        c.updateQueue = a.updateQueue;
        b = a.dependencies;
        c.dependencies = null === b ? null : { lanes: b.lanes, firstContext: b.firstContext };
        c.sibling = a.sibling;
        c.index = a.index;
        c.ref = a.ref;
        return c;
      }
      function Rg(a, b, c, d, e, f) {
        var g = 2;
        d = a;
        if ("function" === typeof a) aj(a) && (g = 1);
        else if ("string" === typeof a) g = 5;
        else a: switch (a) {
          case ya:
            return Tg(c.children, e, f, b);
          case za:
            g = 8;
            e |= 8;
            break;
          case Aa:
            return a = Bg(12, c, b, e | 2), a.elementType = Aa, a.lanes = f, a;
          case Ea:
            return a = Bg(13, c, b, e), a.elementType = Ea, a.lanes = f, a;
          case Fa:
            return a = Bg(19, c, b, e), a.elementType = Fa, a.lanes = f, a;
          case Ia:
            return pj(c, e, f, b);
          default:
            if ("object" === typeof a && null !== a) switch (a.$$typeof) {
              case Ba:
                g = 10;
                break a;
              case Ca:
                g = 9;
                break a;
              case Da:
                g = 11;
                break a;
              case Ga:
                g = 14;
                break a;
              case Ha:
                g = 16;
                d = null;
                break a;
            }
            throw Error(p(130, null == a ? a : typeof a, ""));
        }
        b = Bg(g, c, b, e);
        b.elementType = a;
        b.type = d;
        b.lanes = f;
        return b;
      }
      function Tg(a, b, c, d) {
        a = Bg(7, a, d, b);
        a.lanes = c;
        return a;
      }
      function pj(a, b, c, d) {
        a = Bg(22, a, d, b);
        a.elementType = Ia;
        a.lanes = c;
        a.stateNode = { isHidden: false };
        return a;
      }
      function Qg(a, b, c) {
        a = Bg(6, a, null, b);
        a.lanes = c;
        return a;
      }
      function Sg(a, b, c) {
        b = Bg(4, null !== a.children ? a.children : [], a.key, b);
        b.lanes = c;
        b.stateNode = { containerInfo: a.containerInfo, pendingChildren: null, implementation: a.implementation };
        return b;
      }
      function al(a, b, c, d, e) {
        this.tag = b;
        this.containerInfo = a;
        this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = -1;
        this.callbackNode = this.pendingContext = this.context = null;
        this.callbackPriority = 0;
        this.eventTimes = zc(0);
        this.expirationTimes = zc(-1);
        this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = zc(0);
        this.identifierPrefix = d;
        this.onRecoverableError = e;
        this.mutableSourceEagerHydrationData = null;
      }
      function bl(a, b, c, d, e, f, g, h, k) {
        a = new al(a, b, c, h, k);
        1 === b ? (b = 1, true === f && (b |= 8)) : b = 0;
        f = Bg(3, null, null, b);
        a.current = f;
        f.stateNode = a;
        f.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
        kh(f);
        return a;
      }
      function cl(a, b, c) {
        var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return { $$typeof: wa, key: null == d ? null : "" + d, children: a, containerInfo: b, implementation: c };
      }
      function dl(a) {
        if (!a) return Vf;
        a = a._reactInternals;
        a: {
          if (Vb(a) !== a || 1 !== a.tag) throw Error(p(170));
          var b = a;
          do {
            switch (b.tag) {
              case 3:
                b = b.stateNode.context;
                break a;
              case 1:
                if (Zf(b.type)) {
                  b = b.stateNode.__reactInternalMemoizedMergedChildContext;
                  break a;
                }
            }
            b = b.return;
          } while (null !== b);
          throw Error(p(171));
        }
        if (1 === a.tag) {
          var c = a.type;
          if (Zf(c)) return bg(a, c, b);
        }
        return b;
      }
      function el(a, b, c, d, e, f, g, h, k) {
        a = bl(c, d, true, a, e, f, g, h, k);
        a.context = dl(null);
        c = a.current;
        d = R();
        e = yi(c);
        f = mh(d, e);
        f.callback = void 0 !== b && null !== b ? b : null;
        nh(c, f, e);
        a.current.lanes = e;
        Ac(a, e, d);
        Dk(a, d);
        return a;
      }
      function fl(a, b, c, d) {
        var e = b.current, f = R(), g = yi(e);
        c = dl(c);
        null === b.context ? b.context = c : b.pendingContext = c;
        b = mh(f, g);
        b.payload = { element: a };
        d = void 0 === d ? null : d;
        null !== d && (b.callback = d);
        a = nh(e, b, g);
        null !== a && (gi(a, e, g, f), oh(a, e, g));
        return g;
      }
      function gl(a) {
        a = a.current;
        if (!a.child) return null;
        switch (a.child.tag) {
          case 5:
            return a.child.stateNode;
          default:
            return a.child.stateNode;
        }
      }
      function hl(a, b) {
        a = a.memoizedState;
        if (null !== a && null !== a.dehydrated) {
          var c = a.retryLane;
          a.retryLane = 0 !== c && c < b ? c : b;
        }
      }
      function il(a, b) {
        hl(a, b);
        (a = a.alternate) && hl(a, b);
      }
      function jl() {
        return null;
      }
      var kl = "function" === typeof reportError ? reportError : function(a) {
        console.error(a);
      };
      function ll(a) {
        this._internalRoot = a;
      }
      ml.prototype.render = ll.prototype.render = function(a) {
        var b = this._internalRoot;
        if (null === b) throw Error(p(409));
        fl(a, b, null, null);
      };
      ml.prototype.unmount = ll.prototype.unmount = function() {
        var a = this._internalRoot;
        if (null !== a) {
          this._internalRoot = null;
          var b = a.containerInfo;
          Rk(function() {
            fl(null, a, null, null);
          });
          b[uf] = null;
        }
      };
      function ml(a) {
        this._internalRoot = a;
      }
      ml.prototype.unstable_scheduleHydration = function(a) {
        if (a) {
          var b = Hc();
          a = { blockedOn: null, target: a, priority: b };
          for (var c = 0; c < Qc.length && 0 !== b && b < Qc[c].priority; c++) ;
          Qc.splice(c, 0, a);
          0 === c && Vc(a);
        }
      };
      function nl(a) {
        return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType);
      }
      function ol(a) {
        return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || " react-mount-point-unstable " !== a.nodeValue));
      }
      function pl() {
      }
      function ql(a, b, c, d, e) {
        if (e) {
          if ("function" === typeof d) {
            var f = d;
            d = function() {
              var a2 = gl(g);
              f.call(a2);
            };
          }
          var g = el(b, d, a, 0, null, false, false, "", pl);
          a._reactRootContainer = g;
          a[uf] = g.current;
          sf(8 === a.nodeType ? a.parentNode : a);
          Rk();
          return g;
        }
        for (; e = a.lastChild; ) a.removeChild(e);
        if ("function" === typeof d) {
          var h = d;
          d = function() {
            var a2 = gl(k);
            h.call(a2);
          };
        }
        var k = bl(a, 0, false, null, null, false, false, "", pl);
        a._reactRootContainer = k;
        a[uf] = k.current;
        sf(8 === a.nodeType ? a.parentNode : a);
        Rk(function() {
          fl(b, k, c, d);
        });
        return k;
      }
      function rl(a, b, c, d, e) {
        var f = c._reactRootContainer;
        if (f) {
          var g = f;
          if ("function" === typeof e) {
            var h = e;
            e = function() {
              var a2 = gl(g);
              h.call(a2);
            };
          }
          fl(b, g, a, e);
        } else g = ql(c, b, a, e, d);
        return gl(g);
      }
      Ec = function(a) {
        switch (a.tag) {
          case 3:
            var b = a.stateNode;
            if (b.current.memoizedState.isDehydrated) {
              var c = tc(b.pendingLanes);
              0 !== c && (Cc(b, c | 1), Dk(b, B()), 0 === (K & 6) && (Gj = B() + 500, jg()));
            }
            break;
          case 13:
            Rk(function() {
              var b2 = ih(a, 1);
              if (null !== b2) {
                var c2 = R();
                gi(b2, a, 1, c2);
              }
            }), il(a, 1);
        }
      };
      Fc = function(a) {
        if (13 === a.tag) {
          var b = ih(a, 134217728);
          if (null !== b) {
            var c = R();
            gi(b, a, 134217728, c);
          }
          il(a, 134217728);
        }
      };
      Gc = function(a) {
        if (13 === a.tag) {
          var b = yi(a), c = ih(a, b);
          if (null !== c) {
            var d = R();
            gi(c, a, b, d);
          }
          il(a, b);
        }
      };
      Hc = function() {
        return C;
      };
      Ic = function(a, b) {
        var c = C;
        try {
          return C = a, b();
        } finally {
          C = c;
        }
      };
      yb = function(a, b, c) {
        switch (b) {
          case "input":
            bb(a, c);
            b = c.name;
            if ("radio" === c.type && null != b) {
              for (c = a; c.parentNode; ) c = c.parentNode;
              c = c.querySelectorAll("input[name=" + JSON.stringify("" + b) + '][type="radio"]');
              for (b = 0; b < c.length; b++) {
                var d = c[b];
                if (d !== a && d.form === a.form) {
                  var e = Db(d);
                  if (!e) throw Error(p(90));
                  Wa(d);
                  bb(d, e);
                }
              }
            }
            break;
          case "textarea":
            ib(a, c);
            break;
          case "select":
            b = c.value, null != b && fb(a, !!c.multiple, b, false);
        }
      };
      Gb = Qk;
      Hb = Rk;
      var sl = { usingClientEntryPoint: false, Events: [Cb, ue, Db, Eb, Fb, Qk] };
      var tl = { findFiberByHostInstance: Wc, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" };
      var ul = { bundleType: tl.bundleType, version: tl.version, rendererPackageName: tl.rendererPackageName, rendererConfig: tl.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: ua.ReactCurrentDispatcher, findHostInstanceByFiber: function(a) {
        a = Zb(a);
        return null === a ? null : a.stateNode;
      }, findFiberByHostInstance: tl.findFiberByHostInstance || jl, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
      if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
        vl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!vl.isDisabled && vl.supportsFiber) try {
          kc = vl.inject(ul), lc = vl;
        } catch (a) {
        }
      }
      var vl;
      exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = sl;
      exports.createPortal = function(a, b) {
        var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
        if (!nl(b)) throw Error(p(200));
        return cl(a, b, null, c);
      };
      exports.createRoot = function(a, b) {
        if (!nl(a)) throw Error(p(299));
        var c = false, d = "", e = kl;
        null !== b && void 0 !== b && (true === b.unstable_strictMode && (c = true), void 0 !== b.identifierPrefix && (d = b.identifierPrefix), void 0 !== b.onRecoverableError && (e = b.onRecoverableError));
        b = bl(a, 1, false, null, null, c, false, d, e);
        a[uf] = b.current;
        sf(8 === a.nodeType ? a.parentNode : a);
        return new ll(b);
      };
      exports.findDOMNode = function(a) {
        if (null == a) return null;
        if (1 === a.nodeType) return a;
        var b = a._reactInternals;
        if (void 0 === b) {
          if ("function" === typeof a.render) throw Error(p(188));
          a = Object.keys(a).join(",");
          throw Error(p(268, a));
        }
        a = Zb(b);
        a = null === a ? null : a.stateNode;
        return a;
      };
      exports.flushSync = function(a) {
        return Rk(a);
      };
      exports.hydrate = function(a, b, c) {
        if (!ol(b)) throw Error(p(200));
        return rl(null, a, b, true, c);
      };
      exports.hydrateRoot = function(a, b, c) {
        if (!nl(a)) throw Error(p(405));
        var d = null != c && c.hydratedSources || null, e = false, f = "", g = kl;
        null !== c && void 0 !== c && (true === c.unstable_strictMode && (e = true), void 0 !== c.identifierPrefix && (f = c.identifierPrefix), void 0 !== c.onRecoverableError && (g = c.onRecoverableError));
        b = el(b, null, a, 1, null != c ? c : null, e, false, f, g);
        a[uf] = b.current;
        sf(a);
        if (d) for (a = 0; a < d.length; a++) c = d[a], e = c._getVersion, e = e(c._source), null == b.mutableSourceEagerHydrationData ? b.mutableSourceEagerHydrationData = [c, e] : b.mutableSourceEagerHydrationData.push(
          c,
          e
        );
        return new ml(b);
      };
      exports.render = function(a, b, c) {
        if (!ol(b)) throw Error(p(200));
        return rl(null, a, b, false, c);
      };
      exports.unmountComponentAtNode = function(a) {
        if (!ol(a)) throw Error(p(40));
        return a._reactRootContainer ? (Rk(function() {
          rl(null, null, a, false, function() {
            a._reactRootContainer = null;
            a[uf] = null;
          });
        }), true) : false;
      };
      exports.unstable_batchedUpdates = Qk;
      exports.unstable_renderSubtreeIntoContainer = function(a, b, c, d) {
        if (!ol(c)) throw Error(p(200));
        if (null == a || void 0 === a._reactInternals) throw Error(p(38));
        return rl(a, b, c, false, d);
      };
      exports.version = "18.3.1-next-f1338f8080-20240426";
    }
  });

  // web/node_modules/react-dom/index.js
  var require_react_dom = __commonJS({
    "web/node_modules/react-dom/index.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // web/node_modules/react-dom/client.js
  var require_client = __commonJS({
    "web/node_modules/react-dom/client.js"(exports) {
      "use strict";
      var m = require_react_dom();
      if (true) {
        exports.createRoot = m.createRoot;
        exports.hydrateRoot = m.hydrateRoot;
      } else {
        i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
        exports.createRoot = function(c, o) {
          i.usingClientEntryPoint = true;
          try {
            return m.createRoot(c, o);
          } finally {
            i.usingClientEntryPoint = false;
          }
        };
        exports.hydrateRoot = function(c, h, o) {
          i.usingClientEntryPoint = true;
          try {
            return m.hydrateRoot(c, h, o);
          } finally {
            i.usingClientEntryPoint = false;
          }
        };
      }
      var i;
    }
  });

  // web/node_modules/react/cjs/react-jsx-runtime.production.min.js
  var require_react_jsx_runtime_production_min = __commonJS({
    "web/node_modules/react/cjs/react-jsx-runtime.production.min.js"(exports) {
      "use strict";
      var f = require_react();
      var k = Symbol.for("react.element");
      var l = Symbol.for("react.fragment");
      var m = Object.prototype.hasOwnProperty;
      var n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner;
      var p = { key: true, ref: true, __self: true, __source: true };
      function q(c, a, g) {
        var b, d = {}, e = null, h = null;
        void 0 !== g && (e = "" + g);
        void 0 !== a.key && (e = "" + a.key);
        void 0 !== a.ref && (h = a.ref);
        for (b in a) m.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
        if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
        return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
      }
      exports.Fragment = l;
      exports.jsx = q;
      exports.jsxs = q;
    }
  });

  // web/node_modules/react/jsx-runtime.js
  var require_jsx_runtime = __commonJS({
    "web/node_modules/react/jsx-runtime.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_jsx_runtime_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/browser-r1/entry.tsx
  var import_client3 = __toESM(require_client());

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/contexts/AuthProviderContext/index.tsx
  var import_react = __toESM(require_react());

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/browser-r1/auth.ts
  var current = null;
  var listeners = /* @__PURE__ */ new Set();
  var roles = /* @__PURE__ */ new Map();
  var pendingRoles = /* @__PURE__ */ new Map();
  var fixture = {
    ensureCalls: [],
    session() {
      return current;
    },
    async setSession(id, role = null, token = "synthetic-" + id) {
      current = id ? { user: { id, email: id + "@example.invalid", user_metadata: {}, app_metadata: {} }, access_token: token } : null;
      if (id) roles.set(id, role);
      await Promise.all([...listeners].map((fn) => fn(current ? "TOKEN_REFRESHED" : "SIGNED_OUT", current)));
    },
    deferRole(id) {
      let resolve;
      const promise = new Promise((res) => resolve = res);
      pendingRoles.set(id, { promise, resolve });
    },
    resolveRole(id, role, error = null) {
      const pending = pendingRoles.get(id);
      pendingRoles.delete(id);
      pending?.resolve({ data: { role }, error });
    }
  };
  var auth_default = {
    auth: {
      getSession: async () => ({ data: { session: current }, error: null }),
      onAuthStateChange(fn) {
        listeners.add(fn);
        return { data: { subscription: { unsubscribe() {
          listeners.delete(fn);
        } } } };
      },
      async signOut() {
        await fixture.setSession(null);
        return { error: null };
      }
    },
    from(table) {
      return { select() {
        return { eq(_key, id) {
          return { maybeSingle() {
            return table === "users" ? pendingRoles.get(id)?.promise ?? Promise.resolve({ data: { role: roles.get(id) ?? null }, error: null }) : Promise.resolve({ data: null, error: null });
          } };
        } };
      } };
    }
  };

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/lib/supabase/browser-auth.ts
  var SUPABASE_STORAGE_KEY_PATTERNS = [
    /^sb-.*auth-token/i,
    /^sb-.*code-verifier/i,
    /^fhfh-public-readonly-supabase$/i,
    /^fhfh:post-password-reset-next$/i
  ];
  function clearMatchingStorage(storage) {
    if (!storage) {
      return;
    }
    const keysToRemove = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && SUPABASE_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  }
  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        reject(new Error("Timed out while resetting the local auth session."));
      }, timeoutMs);
      promise.then((value) => {
        window.clearTimeout(timeoutHandle);
        resolve(value);
      }).catch((error) => {
        window.clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }
  async function resetSupabaseBrowserAuthState(supabase, timeoutMs = 5e3) {
    if (typeof window === "undefined") {
      return;
    }
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), timeoutMs);
    } catch {
    }
    try {
      clearMatchingStorage(window.localStorage);
    } catch {
    }
    try {
      clearMatchingStorage(window.sessionStorage);
    } catch {
    }
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/browser-r1/ensure.ts
  async function ensureUserRecords(user) {
    fixture.ensureCalls.push(user.id);
  }

  // web/lib/socialShare/access.ts
  function isSocialShareRole(role) {
    return role === "social_editor" || role === "admin";
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/contexts/AuthProviderContext/index.tsx
  var import_jsx_runtime = __toESM(require_jsx_runtime());
  var AuthContext = (0, import_react.createContext)({
    isLoading: true,
    isRoleLoading: true,
    user: null,
    signOut: async () => void 0,
    refreshProfileAvatar: async () => void 0
  });
  var useAuth = () => (0, import_react.useContext)(AuthContext);
  function AuthProvider({ children }) {
    const [user, setUser] = (0, import_react.useState)(null);
    const [isLoading, setIsLoading] = (0, import_react.useState)(true);
    const [isRoleLoading, setIsRoleLoading] = (0, import_react.useState)(true);
    const roleRequestRef = (0, import_react.useRef)(0);
    const ensuredUserIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
    const avatarUserRef = (0, import_react.useRef)(null);
    const avatarRequestRef = (0, import_react.useRef)(0);
    const sessionRevisionRef = (0, import_react.useRef)(0);
    const refreshProfileAvatar = (0, import_react.useCallback)(async (userId) => {
      const avatarUser = avatarUserRef.current;
      if (!avatarUser || avatarUser.id !== userId) return;
      const requestId = ++avatarRequestRef.current;
      try {
        const { data, error } = await auth_default.from("user_profiles").select("avatar_url").eq("user_id", userId).maybeSingle();
        if (error || avatarUserRef.current !== avatarUser || avatarRequestRef.current !== requestId) return;
        const avatarUrl = data?.avatar_url?.trim() || avatarUser.metadataUrl;
        setUser(
          (currentUser) => currentUser?.id === userId && currentUser.avatarUrl !== avatarUrl ? { ...currentUser, avatarUrl } : currentUser
        );
      } catch {
      }
    }, []);
    const signOut = (0, import_react.useCallback)(async () => {
      sessionRevisionRef.current++;
      avatarUserRef.current = null;
      avatarRequestRef.current++;
      setUser(null);
      setIsLoading(false);
      await resetSupabaseBrowserAuthState(auth_default);
    }, []);
    (0, import_react.useEffect)(() => {
      let isMounted = true;
      async function syncUserFromSession(session) {
        if (!isMounted) return;
        avatarRequestRef.current++;
        avatarUserRef.current = null;
        if (!session) {
          roleRequestRef.current++;
          setUser(null);
          setIsLoading(false);
          setIsRoleLoading(false);
          return;
        }
        const mappedUser = mapUser(session.user, { role: null });
        avatarUserRef.current = { id: session.user.id, metadataUrl: mappedUser?.avatarUrl ?? null };
        setUser(
          (currentUser) => currentUser && mappedUser && currentUser.id === mappedUser.id ? { ...mappedUser, avatarUrl: currentUser.avatarUrl, role: currentUser.role } : mappedUser
        );
        setIsLoading(false);
        void refreshProfileAvatar(session.user.id);
        if (!ensuredUserIdsRef.current.has(session.user.id)) {
          ensuredUserIdsRef.current.add(session.user.id);
          void ensureUserRecords(session.user).catch(() => {
            ensuredUserIdsRef.current.delete(session.user.id);
          });
        }
        const roleRequest = ++roleRequestRef.current;
        setIsRoleLoading(true);
        const finishRoleRequest = () => {
          if (isMounted && roleRequestRef.current === roleRequest) setIsRoleLoading(false);
        };
        void auth_default.from("users").select("role").eq("user_id", session.user.id).maybeSingle().then(({ data, error }) => {
          if (!isMounted || roleRequestRef.current !== roleRequest) return;
          finishRoleRequest();
          const resolvedRole = !error && isSocialShareRole(data?.role) ? data.role : null;
          setUser((currentUser) => {
            if (!currentUser || currentUser.id !== session.user.id) {
              return currentUser;
            }
            if (currentUser.role === resolvedRole) {
              return currentUser;
            }
            return {
              ...currentUser,
              role: resolvedRole
            };
          });
        }, () => {
          if (!isMounted || roleRequestRef.current !== roleRequest) return;
          finishRoleRequest();
          setUser((currentUser) => currentUser?.id === session.user.id ? { ...currentUser, role: null } : currentUser);
        });
      }
      const initialSessionRevision = sessionRevisionRef.current;
      void auth_default.auth.getSession().then(({ data }) => {
        if (!isMounted || sessionRevisionRef.current !== initialSessionRevision) return;
        return syncUserFromSession(data.session);
      }).catch(() => {
        if (!isMounted || sessionRevisionRef.current !== initialSessionRevision) return;
        setUser(null);
        setIsLoading(false);
        setIsRoleLoading(false);
      });
      const { data: authListener } = auth_default.auth.onAuthStateChange(
        async (_event, session) => {
          if (!isMounted) return;
          sessionRevisionRef.current++;
          await syncUserFromSession(session);
        }
      );
      return () => {
        isMounted = false;
        avatarUserRef.current = null;
        authListener.subscription.unsubscribe();
      };
    }, [refreshProfileAvatar]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthContext.Provider, { value: { user, isLoading, isRoleLoading, signOut, refreshProfileAvatar }, children });
  }
  function mapUser(user, extra) {
    if (!user) {
      return null;
    }
    const metadata = user.user_metadata ?? {};
    const appMetadata = user.app_metadata ?? {};
    const displayName = metadata["preferred_username"] || metadata["full_name"] || metadata["name"] || user.email || user.id;
    const avatarUrl = metadata["avatar_url"] || metadata["picture"] || null;
    const providers = Array.isArray(appMetadata["providers"]) ? appMetadata["providers"].filter(
      (provider) => typeof provider === "string"
    ) : [];
    return {
      id: user.id,
      email: user.email ?? null,
      name: displayName,
      displayName,
      avatarUrl,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      isEmailVerified: Boolean(user.email_confirmed_at),
      providers,
      role: null,
      ...extra
    };
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/SocialShareAccessGate.tsx
  var import_react2 = __toESM(require_react());

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/browser-r1/link.tsx
  var import_jsx_runtime2 = __toESM(require_jsx_runtime());
  function Link({ children, href }) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href, children });
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/SocialShareAccessGate.tsx
  var import_jsx_runtime3 = __toESM(require_jsx_runtime());
  function SocialShareAccessGate({ children }) {
    const { user, isLoading, isRoleLoading } = useAuth();
    if (isLoading || isRoleLoading) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "status", children: "Checking share studio access\u2026" });
    if (!user || !isSocialShareRole(user.role)) return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { "aria-labelledby": "share-access-title", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { id: "share-access-title", children: "Share studio" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", children: user ? "Social editor access is required to use this studio." : "Sign in with your FHFH social editor account to continue." }),
      !user && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Link, { href: "/auth", children: "Sign in" })
    ] });
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react2.Fragment, { children }, user.id);
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/SocialShare.tsx
  var import_react3 = __toESM(require_react());

  // web/lib/socialShare/types.ts
  var SOCIAL_SHARE_FORMATS = [
    "game-grid",
    "tuesday-trends",
    "remaining-week",
    "player-spotlight",
    "category-rescue"
  ];
  var SCHEDULE_FORMATS = ["game-grid", "remaining-week", "tuesday-trends"];
  var SHARE_TIME_ZONE = "America/New_York";
  var isSocialShareFormat = (value) => SOCIAL_SHARE_FORMATS.includes(value);

  // web/lib/NHL/types.ts
  var DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // web/lib/teamsInfo.ts
  var teamsInfo = {
    NJD: {
      name: "New Jersey Devils",
      shortName: "Devils",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#a20620",
      // Red
      jersey: "#FFFFFF",
      // White
      accent: "#154734",
      // Green
      lightColor: "#f03554",
      // Lighter Red
      darkColor: "#670919",
      // Darker Red
      alt: "#670919",
      // White
      franchiseId: 23,
      nstAbbr: "N.J",
      id: 1,
      abbrev: "NJD",
      location: "New Jersey"
    },
    NYI: {
      name: "New York Islanders",
      shortName: "Islanders",
      primaryColor: "#003087",
      // Blue
      secondaryColor: "#000000",
      // White
      jersey: "#FC4C02",
      // Orange
      accent: "#FFFFFF",
      // Black
      lightColor: "#1f5fd5",
      // Lighter Blue
      darkColor: "#08265f",
      // Darker Blue
      alt: "#08265f",
      franchiseId: 22,
      nstAbbr: "NYI",
      id: 2,
      abbrev: "NYI",
      location: "New York"
    },
    NYR: {
      name: "New York Rangers",
      shortName: "Rangers",
      primaryColor: "#0038A8",
      // Blue
      secondaryColor: "#FFFFFF",
      // White
      jersey: "#CE1126",
      // Red
      accent: "#A2AAAD",
      // Silver
      lightColor: "#255ed0",
      // Lighter Blue
      darkColor: "#001d5c",
      // Darker Blue
      alt: "#255ed0",
      franchiseId: 10,
      nstAbbr: "NYR",
      id: 3,
      abbrev: "NYR",
      location: "New York"
    },
    PHI: {
      name: "Philadelphia Flyers",
      shortName: "Flyers",
      primaryColor: "#cf3308",
      secondaryColor: "#FFFFFF",
      jersey: "#000000",
      accent: "#FFFFFF",
      lightColor: "#ef794b",
      // Lighter Orange
      darkColor: "#b7340d",
      // Darker Orange
      alt: "#b7340d",
      franchiseId: 16,
      nstAbbr: "PHI",
      id: 4,
      abbrev: "PHI",
      location: "Philadelphia"
    },
    PIT: {
      name: "Pittsburgh Penguins",
      shortName: "Penguins",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#FFB81C",
      // Gold
      jersey: "#FFFFFF",
      // White
      accent: "#ffa200",
      // Gold
      lightColor: "#ffc852",
      // Lighter Yellow
      darkColor: "#ffa200",
      // Darker
      alt: "#FFFFFF",
      franchiseId: 17,
      nstAbbr: "PIT",
      id: 5,
      abbrev: "PIT",
      location: "Pittsburgh"
    },
    BOS: {
      name: "Boston Bruins",
      shortName: "Bruins",
      primaryColor: "#000000",
      // black
      secondaryColor: "#ffc64d",
      // yellow
      jersey: "#FFFFFF",
      // white
      accent: "#FFB81C",
      // gold
      lightColor: "#dfc16c",
      // Lighter Yellow
      darkColor: "#e19a01",
      // Darker Yellow
      alt: "#202020",
      // charcoal
      franchiseId: 6,
      nstAbbr: "BOS",
      id: 6,
      abbrev: "BOS",
      location: "Boston"
    },
    BUF: {
      name: "Buffalo Sabres",
      shortName: "Sabres",
      primaryColor: "#02235e",
      // blue
      secondaryColor: "#FFB81C",
      // gold
      jersey: "#FFFFFF",
      // white
      accent: "#ADAFAA",
      // silver
      lightColor: "#2762c7",
      // Lighter Blue
      darkColor: "#072f6f",
      // Darker Blue
      alt: "#2762c7",
      franchiseId: 19,
      nstAbbr: "BUF",
      id: 7,
      abbrev: "BUF",
      location: "Buffalo"
    },
    MTL: {
      name: "Montr\xE9al Canadiens",
      shortName: "Canadiens",
      primaryColor: "#001E62",
      // Blue
      secondaryColor: "#6CACE4",
      // light blue
      jersey: "#A6192E",
      // Red
      accent: "#FFFFFF",
      // White
      lightColor: "#1f5fd5",
      // Lighter Blue
      darkColor: "#08265f",
      // Darker Blue
      alt: "#1f5fd5",
      // White
      franchiseId: 1,
      nstAbbr: "MTL",
      id: 8,
      abbrev: "MTL",
      location: "Montr\xE9al"
    },
    OTT: {
      name: "Ottawa Senators",
      shortName: "Senators",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#a20620",
      // Red
      jersey: "#B9975B",
      // Gold
      accent: "#FFFFFF",
      // White
      lightColor: "#ec2b4b",
      // Red
      darkColor: "#931523",
      // Darker Red
      alt: "#B9975B",
      franchiseId: 30,
      nstAbbr: "OTT",
      id: 9,
      abbrev: "OTT",
      location: "Ottawa"
    },
    TOR: {
      name: "Toronto Maple Leafs",
      shortName: "Maple Leafs",
      primaryColor: "#00205B",
      // Blue
      secondaryColor: "#FFFFFF",
      // White
      jersey: "#A2AAAD",
      // Silver
      accent: "#ffffff",
      // White
      alt: "#080a91",
      // White
      lightColor: "#3478f6",
      // Lighter Blue
      darkColor: "#080a91",
      // Darker Blue
      franchiseId: 5,
      nstAbbr: "TOR",
      id: 10,
      abbrev: "TOR",
      location: "Toronto"
    },
    CAR: {
      name: "Carolina Hurricanes",
      shortName: "Hurricanes",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#b10018",
      // Red
      jersey: "#A4A9AD",
      // Silver
      accent: "#FFFFFF",
      // White
      alt: "#e92549",
      // White
      lightColor: "#e92549",
      // Lighter Red
      darkColor: "#8a0113",
      // Darker Red
      franchiseId: 26,
      nstAbbr: "CAR",
      id: 12,
      abbrev: "CAR",
      location: "Carolina"
    },
    FLA: {
      name: "Florida Panthers",
      shortName: "Panthers",
      primaryColor: "#041E42",
      // Blue
      secondaryColor: "#b9975B",
      // Gold
      jersey: "#c8102e",
      // Red
      accent: "#FFFFFF",
      // White
      lightColor: "#ea304f",
      // Lighter red
      darkColor: "#6a0415",
      // Darker red
      alt: "#000000",
      franchiseId: 33,
      nstAbbr: "FLA",
      id: 13,
      abbrev: "FLA",
      location: "Florida"
    },
    TBL: {
      name: "Tampa Bay Lightning",
      shortName: "Lightning",
      primaryColor: "#00205B",
      secondaryColor: "#FFFFFF",
      jersey: "#A2AAAD",
      accent: "#000000",
      lightColor: "#3478f6",
      // Lighter Blue
      darkColor: "#1b1d7e",
      // Darker Blue
      alt: "#3478f6",
      franchiseId: 31,
      nstAbbr: "T.B",
      id: 14,
      abbrev: "TBL",
      location: "Tampa Bay"
    },
    WSH: {
      name: "Washington Capitals",
      shortName: "Capitals",
      primaryColor: "#041E42",
      // Blue
      secondaryColor: "#C8102E",
      // Red
      jersey: "#FFFFFF",
      // White
      accent: "#A2AAAD",
      // Silver
      lightColor: "#1352aa",
      // Lighter Blue
      darkColor: "#011f4a",
      // Darker Blue
      alt: "#103a75",
      franchiseId: 24,
      nstAbbr: "WSH",
      id: 15,
      abbrev: "WSH",
      location: "Washington"
    },
    CHI: {
      name: "Chicago Blackhawks",
      shortName: "Blackhawks",
      primaryColor: "#a20620",
      // Red
      secondaryColor: "#000000",
      // Black
      jersey: "#FFFFFF",
      // White
      accent: "#CC8A00",
      // Yellow
      alt: "#00833E",
      // Green
      lightColor: "#d72d49",
      // Lighter Red
      darkColor: "#6c0415",
      // Darker Red
      franchiseId: 11,
      nstAbbr: "CHI",
      id: 16,
      abbrev: "CHI",
      location: "Chicago"
    },
    DET: {
      name: "Detroit Red Wings",
      shortName: "Red Wings",
      primaryColor: "#a20620",
      // Red
      secondaryColor: "#FFFFFF",
      // White
      jersey: "#8D9093",
      // Silver
      accent: "#DDCBA4",
      // Tan
      alt: "#d72d49",
      lightColor: "#d72d49",
      // Lighter Red
      darkColor: "#6c0415",
      // Darker Red
      franchiseId: 12,
      nstAbbr: "DET",
      id: 17,
      abbrev: "DET",
      location: "Detroit"
    },
    NSH: {
      name: "Nashville Predators",
      shortName: "Predators",
      primaryColor: "#041e42",
      // Blue
      secondaryColor: "#FFb81c",
      // Gold
      jersey: "#FFFFFF",
      // White
      accent: "#A2AAAD",
      // Silver
      lightColor: "#efbe53",
      // Lighter gold
      darkColor: "#da9501",
      // Darker gold
      alt: "#da9501",
      franchiseId: 34,
      nstAbbr: "NSH",
      id: 18,
      abbrev: "NSH",
      location: "Nashville"
    },
    STL: {
      name: "St. Louis Blues",
      shortName: "Blues",
      primaryColor: "#041E42",
      // Blue
      secondaryColor: "#FCB514",
      // Yellow
      jersey: "#1749a8",
      // Blue
      accent: "#FFFFFF",
      // White
      lightColor: "#3478f6",
      // Lighter Blue
      darkColor: "#1b1d7e",
      // Darker Blue
      alt: "#3478f6",
      franchiseId: 18,
      nstAbbr: "STL",
      id: 19,
      abbrev: "STL",
      location: "St. Louis"
    },
    CGY: {
      name: "Calgary Flames",
      shortName: "Flames",
      primaryColor: "#8a0113",
      // Red
      secondaryColor: "#FAAF19",
      // Yellow
      jersey: "#FFFFFF",
      // White
      accent: "#000000",
      // Black
      alt: "#d72d49",
      // White
      lightColor: "#d72d49",
      // Lighter Red
      darkColor: "#6c0415",
      // Darker Red
      franchiseId: 21,
      nstAbbr: "CGY",
      id: 20,
      abbrev: "CGY",
      location: "Calgary"
    },
    COL: {
      name: "Colorado Avalanche",
      shortName: "Avalanche",
      primaryColor: "#041e42",
      // Blue
      secondaryColor: "#902647",
      // Burgundy
      jersey: "#236192",
      // Blue
      accent: "#FFFFFF",
      // White
      lightColor: "#3478f6",
      // Lighter Blue
      darkColor: "#1b1d7e",
      // Darker Blue
      alt: "#3478f6",
      franchiseId: 27,
      nstAbbr: "COL",
      id: 21,
      abbrev: "COL",
      location: "Colorado"
    },
    EDM: {
      name: "Edmonton Oilers",
      shortName: "Oilers",
      primaryColor: "#041E42",
      // Blue
      secondaryColor: "#FC4C02",
      // Orange
      jersey: "#FFFFFF",
      // White
      accent: "#A2AAAD",
      // Silver
      alt: "#1953bf",
      lightColor: "#1953bf",
      // Lighter Blue
      darkColor: "#1b1d7e",
      // Darker Blue
      franchiseId: 25,
      nstAbbr: "EDM",
      id: 22,
      abbrev: "EDM",
      location: "Edmonton"
    },
    VAN: {
      name: "Vancouver Canucks",
      shortName: "Canucks",
      primaryColor: "#00205B",
      // Blue
      secondaryColor: "#00843D",
      // Green
      jersey: "#ffffff",
      // White
      accent: "#041C2C",
      // Navy
      alt: "#259358",
      // White
      lightColor: "#259358",
      // Lighter green
      darkColor: "#024421",
      // Darker green
      franchiseId: 20,
      nstAbbr: "VAN",
      id: 23,
      abbrev: "VAN",
      location: "Vancouver"
    },
    ANA: {
      name: "Anaheim Ducks",
      shortName: "Ducks",
      primaryColor: "#af4d35",
      // Orange
      secondaryColor: "#89734C",
      // Gold
      jersey: "#010101",
      // black
      accent: "#ffffff",
      // White
      alt: "#ec623c",
      // White
      lightColor: "#ec623c",
      // Lighter orange
      darkColor: "#992809",
      // Darker orange
      franchiseId: 32,
      nstAbbr: "ANA",
      id: 24,
      abbrev: "ANA",
      location: "Anaheim"
    },
    DAL: {
      name: "Dallas Stars",
      shortName: "Stars",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#44D62C",
      // Green
      jersey: "#006847",
      // Green
      accent: "#FFFFFF",
      // White
      lightColor: "#65ed50",
      // Lighter green
      darkColor: "#116704",
      // Darker green
      alt: "#65ed50",
      franchiseId: 15,
      nstAbbr: "DAL",
      id: 25,
      abbrev: "DAL",
      location: "Dallas"
    },
    LAK: {
      name: "Los Angeles Kings",
      shortName: "Kings",
      primaryColor: "#000000",
      // Black
      secondaryColor: "#A2AAAD",
      // Silver
      jersey: "#FFFFFF",
      // White
      accent: "#bac8cd",
      // Silver
      lightColor: "#bac8cd",
      // Lighter silver
      darkColor: "#656768",
      // Darker Black
      alt: "#656768",
      franchiseId: 14,
      nstAbbr: "L.A",
      id: 26,
      abbrev: "LAK",
      location: "Los Angeles"
    },
    SJS: {
      name: "San Jose Sharks",
      shortName: "Sharks",
      primaryColor: "#006D75",
      // Teal
      secondaryColor: "#000000",
      // Black
      jersey: "#FFFFFF",
      // White
      accent: "#EA7200",
      // Orange
      lightColor: "#1a8d96",
      // Lighter teal
      darkColor: "#015156",
      // Darker teal
      alt: "#1a8d96",
      franchiseId: 29,
      nstAbbr: "S.J",
      id: 28,
      abbrev: "SJS",
      location: "San Jose"
    },
    CBJ: {
      name: "Columbus Blue Jackets",
      shortName: "Blue Jackets",
      primaryColor: "#041E42",
      // Navy
      secondaryColor: "#7DA1C4",
      // Light Blue
      jersey: "#ffffff",
      // White
      accent: "#c8102e",
      // Red
      lightColor: "#1756a3",
      // Lighter Blue
      darkColor: "#001835",
      // Darker Blue
      alt: "#1756a3",
      franchiseId: 36,
      nstAbbr: "CBJ",
      id: 29,
      abbrev: "CBJ",
      location: "Columbus"
    },
    MIN: {
      name: "Minnesota Wild",
      shortName: "Wild",
      primaryColor: "#154734",
      // Green
      secondaryColor: "#DDCBA4",
      // Tan
      jersey: "#A6192E",
      // Red
      accent: "#FFFFFF",
      // White
      alt: "#24694f",
      lightColor: "#24694f",
      // Lighter green
      darkColor: "#0b2e21",
      // Darker green
      franchiseId: 37,
      nstAbbr: "MIN",
      id: 30,
      abbrev: "MIN",
      location: "Minnesota"
    },
    WPG: {
      name: "Winnipeg Jets",
      shortName: "Jets",
      primaryColor: "#041E42",
      // Blue
      secondaryColor: "#A2AAAD",
      // Silver
      jersey: "#004C97",
      // Blue
      accent: "#55565A",
      // Grey
      lightColor: "#1953bf",
      // Lighter Blue
      darkColor: "#1b1d7e",
      // Darker Blue
      alt: "#1953bf",
      franchiseId: 35,
      nstAbbr: "WPG",
      id: 52,
      abbrev: "WPG",
      location: "Winnipeg"
    },
    VGK: {
      name: "Vegas Golden Knights",
      shortName: "Knights",
      primaryColor: "#24292c",
      // Grey
      secondaryColor: "#B4975A",
      // Gold
      jersey: "#8d0519",
      // Red
      accent: "#000000",
      // Black
      lightColor: "#696e72",
      // Lighter Grey
      darkColor: "#0f1112",
      // Darker Grey
      alt: "#696e72",
      franchiseId: 38,
      nstAbbr: "VGK",
      id: 54,
      abbrev: "VGK",
      location: "Vegas"
    },
    SEA: {
      name: "Seattle Kraken",
      shortName: "Kraken",
      primaryColor: "#001628",
      // Blue
      secondaryColor: "#68A2B9",
      // Light Blue
      jersey: "#99D9D9",
      // Light Blue
      accent: "#E9072B",
      // Red
      lightColor: "#6bcdf4",
      // Lighter Blue
      darkColor: "#4592b0",
      // Darker Blue
      alt: "#6bcdf4",
      franchiseId: 39,
      nstAbbr: "SEA",
      id: 55,
      abbrev: "SEA",
      location: "Seattle"
    },
    UTA: {
      name: "Utah Mammoth",
      shortName: "Mammoth",
      primaryColor: "#010101",
      // Black
      secondaryColor: "#69B3E7",
      // Light Blue
      jersey: "#FFFFFF",
      // White
      accent: "#47a4c9",
      // Light Blue
      lightColor: "#67bdfb",
      // Lighter Blue
      darkColor: "#47a4c9",
      // Darker Blue
      alt: "#67bdfb",
      franchiseId: 40,
      nstAbbr: "UTA",
      id: 68,
      // Updated to new NHL team ID so schedules match
      abbrev: "UTA",
      location: "Utah",
      legacyIds: [53, 59]
    }
  };
  var activeTeamAbbreviations = new Set(
    Object.keys(teamsInfo)
  );
  var legacyTeamIdToAbbr = {};
  Object.entries(teamsInfo).forEach(([abbr, info]) => {
    info.legacyIds?.forEach((legacyId) => {
      legacyTeamIdToAbbr[legacyId] = abbr;
    });
  });

  // web/lib/rosterScheduleData/normalize.ts
  function planningScheduleStatus(gameStatus, scheduleStatus) {
    const game = gameStatus.trim().toUpperCase(), schedule = scheduleStatus.trim().toUpperCase();
    if (/CANCEL|^CNCL$/.test(schedule) || /CANCEL|^CNCL$/.test(game)) return "cancelled";
    if (/POST|^PPD$|^SUSPENDED$/.test(schedule) || /POST|^PPD$|^SUSPENDED$/.test(game)) return "postponed";
    if (["OFF", "FINAL", "FINAL_OT", "FINAL_SO", "OVER"].includes(game)) return "final";
    if (["LIVE", "CRIT"].includes(game)) return "live";
    return ["FUT", "PRE"].includes(game) && schedule === "OK" ? "scheduled" : null;
  }

  // web/lib/rosterScheduleOptimizer/planningDates.ts
  function localDate(value, zone) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const part = (kind) => parts.find((item) => item.type === kind)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  // web/components/GameGrid/utils/calcWeekScore.ts
  function calculateSlateCrowding(slateCounts, totalTeamGames, scheduleComplete = true) {
    const validCounts = slateCounts.filter((count) => typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= 16);
    const complete = scheduleComplete && totalTeamGames > 0 && slateCounts.length === totalTeamGames && validCounts.length === totalTeamGames;
    const meanGrade = complete ? validCounts.reduce((sum, count) => sum + (16 - count) / 15, 0) / totalTeamGames : null;
    return {
      adjustment: meanGrade == null ? 0 : 0.25 * (2 * meanGrade - 1),
      meanGrade,
      knownGames: validCounts.length,
      expectedGames: totalTeamGames,
      status: totalTeamGames === 0 ? "no_games" : complete ? "available" : "unavailable"
    };
  }
  function calculateMatchupBonus(winOddsList, totalTeamGames) {
    if (!Number.isFinite(totalTeamGames) || totalTeamGames <= 0) return 0;
    const totalBonus = winOddsList.reduce((total, odds) => {
      if (typeof odds !== "number" || !Number.isFinite(odds)) return total;
      const percentage = Math.max(0, Math.min(100, odds));
      return total + percentage / 100 - 0.5;
    }, 0);
    return Math.max(-0.5, Math.min(0.5, totalBonus / totalTeamGames));
  }
  function calcWeekScore(winOddsList, offNights, totalGamesPerWeek, totalTeamGames, slateCounts = [], scheduleComplete = true) {
    if (totalTeamGames === 0) return -100;
    const totalGamesWeight = 6;
    const offNightsWeight = 4;
    const avgTeamGames = totalGamesPerWeek / 16;
    const adjustedTeamGames = totalTeamGames - avgTeamGames;
    return adjustedTeamGames * totalGamesWeight + offNights * offNightsWeight + calculateMatchupBonus(winOddsList, totalTeamGames) + calculateSlateCrowding(slateCounts, totalTeamGames, scheduleComplete).adjustment;
  }

  // web/components/GameGrid/utils/helper.ts
  function isRegularScheduleGame(game) {
    const inactive = ["PPD", "CNCL", "POSTPONED", "CANCELLED"];
    return game?.gameType === 2 && Number.isFinite(game.id) && game.id > 0 && !inactive.includes(game.gameScheduleState?.toUpperCase() ?? "") && !inactive.includes(game.gameState?.toUpperCase() ?? "");
  }
  function calcWeightedOffNights(matchUps, numGamesPerDay, excludedDays = [], days = DAYS) {
    const TOTAL_TEAMS = 32;
    const BASELINE_GAMES = 7;
    const OFF_NIGHT_THRESHOLD = 8;
    const BASELINE_WEIGHT_AT_7 = (9 - 7) / 7;
    let total = 0;
    days.forEach((day, i) => {
      if (excludedDays.includes(day)) return;
      const matchUp = matchUps[day];
      const hasMatchUp_ = isRegularScheduleGame(matchUp);
      const games = numGamesPerDay[i] ?? 0;
      const isOffNight = games <= OFF_NIGHT_THRESHOLD;
      if (hasMatchUp_ && isOffNight) {
        const sharePerGame = 2 / TOTAL_TEAMS;
        const baselineShare = BASELINE_GAMES * sharePerGame;
        const nightShare = games * sharePerGame;
        const shareDiff = Math.max(0, baselineShare - nightShare);
        const multiplier = 1 + shareDiff;
        const weight = BASELINE_WEIGHT_AT_7 * multiplier;
        total += weight;
      }
    });
    return total;
  }

  // web/lib/socialShare/schedule.ts
  function assertCalendarDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).toISOString().slice(0, 10) !== date) throw new Error("Use a real YYYY-MM-DD calendar date.");
    return date;
  }
  function weekDates(weekStart) {
    assertCalendarDate(weekStart);
    const start = Date.parse(`${weekStart}T00:00:00Z`);
    if (new Date(start).getUTCDay() !== 1) throw new Error("weekStart must be a Monday.");
    return Array.from({ length: 7 }, (_, i) => new Date(start + i * 864e5).toISOString().slice(0, 10));
  }
  function calendarWeekStart(asOfIso) {
    if (!Number.isFinite(Date.parse(asOfIso))) throw new Error("Invalid as-of timestamp.");
    const date = localDate(asOfIso, SHARE_TIME_ZONE);
    const time = Date.parse(`${date}T00:00:00Z`);
    const offset = (new Date(time).getUTCDay() + 6) % 7;
    return new Date(time - offset * 864e5).toISOString().slice(0, 10);
  }
  function selectedWeekDates(weekStart, selected) {
    const dates = weekDates(weekStart);
    if (new Set(selected).size !== selected.length || selected.some((date) => !dates.includes(assertCalendarDate(date)))) throw new Error("Selected dates must be unique dates within the selected week.");
    return dates.filter((date) => selected.includes(date));
  }
  function currentSeason(weekStart) {
    const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
    return year * 1e4 + year + 1;
  }
  function timestamp(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    try {
      assertCalendarDate(value.slice(0, 10));
    } catch {
      return null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  var staticTeams = [...activeTeamAbbreviations].map((abbreviation) => ({ id: teamsInfo[abbreviation].id, abbreviation: String(abbreviation), name: teamsInfo[abbreviation].name }));
  function publicTeam(team) {
    const known = staticTeams.find((item) => item.id === team.id);
    const abbreviation = team.abbrev ?? known?.abbreviation;
    if (!Number.isSafeInteger(team.id) || team.id <= 0 || !abbreviation || !/^[A-Z]{3}$/.test(abbreviation)) throw new Error("Invalid source team identity.");
    if (known && known.abbreviation !== abbreviation) throw new Error("Conflicting source team identity.");
    if (!known && !(team.id === 53 && abbreviation === "ARI" || team.id === 59 && abbreviation === "UTA")) throw new Error("Unsupported source team identity.");
    return { id: team.id, abbreviation, name: team.name || known?.name || abbreviation };
  }
  function editionId(snapshot) {
    const content = JSON.stringify([snapshot.format, snapshot.weekStart, snapshot.generatedAt, snapshot.source, snapshot.games, snapshot.selectedDates]);
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
    return `schedule-${(hash >>> 0).toString(16)}`;
  }
  function selectScheduleDates(snapshot, selectedDates) {
    const selected = selectedWeekDates(snapshot.weekStart, selectedDates);
    const asOf2 = Date.parse(snapshot.generatedAt);
    const reasons = [...snapshot.source.reasons];
    const regular = snapshot.games.filter((game) => game.gameType === 2);
    const remaining = regular.filter((game) => selected.includes(game.date) && game.status === "scheduled" && game.startTimeUtc !== null && Date.parse(game.startTimeUtc) > asOf2);
    for (const game of regular) {
      if (selected.includes(game.date) && (game.status === "unknown" || game.status === "scheduled" && !game.startTimeUtc)) reasons.push(`Game ${game.id} has an unknown start or state on a selected date.`);
    }
    const days = weekDates(snapshot.weekStart).map((date, i) => {
      const leagueGames = regular.filter((game) => game.date === date && ["scheduled", "live", "final"].includes(game.status)).length;
      return { date, label: DAYS[i], leagueGames, offNight: leagueGames <= 8, selected: selected.includes(date) };
    });
    let expiresAt = null;
    let state = snapshot.source.state;
    if (state === "ready" && reasons.length) state = "partial";
    const fetched = snapshot.source.fetchedAt ? Date.parse(snapshot.source.fetchedAt) : NaN;
    const updated = snapshot.source.updatedAt ? Date.parse(snapshot.source.updatedAt) : null;
    if (!Number.isFinite(fetched) || fetched > asOf2 || updated !== null && updated > asOf2) {
      state = "missing";
      reasons.push("Schedule provenance is missing or in the future.");
    } else {
      const sixHours = 6 * 36e5;
      const soon = remaining.some((game) => Date.parse(game.startTimeUtc) - asOf2 <= sixHours);
      let expiry = fetched + (soon ? 15 * 6e4 : sixHours);
      for (const game of remaining) {
        const start = Date.parse(game.startTimeUtc);
        expiry = Math.min(expiry, start, start - sixHours <= asOf2 ? Infinity : Math.max(start - sixHours, fetched + 15 * 6e4));
      }
      expiresAt = new Date(expiry).toISOString();
      if (expiry <= asOf2) {
        state = "stale";
        reasons.push("Schedule read is older than the applicable freshness limit.");
      }
    }
    if (!SCHEDULE_FORMATS.includes(snapshot.format)) {
      state = "blocked";
      reasons.push("This format requires ownership or player evidence that is not available in this schedule-only edition.");
    }
    const rows = snapshot.teams.map((team) => {
      const games = snapshot.games.filter((game) => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
      const opportunities = remaining.filter((game) => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
      const matchUps = {};
      let weightedOffNights = 0;
      for (const game of opportunities) {
        const day = DAYS[days.findIndex((item) => item.date === game.date)];
        matchUps[day] = { id: game.id, season: game.season, gameType: 2, homeTeam: { id: game.homeTeam.id }, awayTeam: { id: game.awayTeam.id } };
        weightedOffNights += calcWeightedOffNights({ [day]: matchUps[day] }, days.map((item) => item.leagueGames));
      }
      const offNightGames = opportunities.filter((game) => days.find((day) => day.date === game.date)?.offNight).length;
      const slateCounts = opportunities.map((game) => days.find((day) => day.date === game.date).leagueGames);
      return { team, rank: 0, score: calcWeekScore([], offNightGames, remaining.length, opportunities.length, slateCounts, snapshot.source.state === "ready"), remainingGames: opportunities.length, offNightGames, weightedOffNights, games };
    }).sort((a, b) => b.score - a.score || a.team.abbreviation.localeCompare(b.team.abbreviation) || a.team.id - b.team.id).map((row, i) => ({ ...row, rank: i + 1 }));
    const result = { ...snapshot, selectedDates: selected, state, reasons: [...new Set(reasons)], days, rows, expiresAt };
    result.id = editionId(result);
    return result;
  }
  function buildScheduleSnapshot(input) {
    const dates = weekDates(input.weekStart);
    const generatedAt = timestamp(input.generatedAt);
    if (!generatedAt) throw new Error("Invalid generatedAt timestamp.");
    const coveredDates = [...new Set(input.schedule.coveredDates ?? [])].filter((date) => dates.includes(date)).sort();
    const reasons = [];
    if (coveredDates.length !== 7) reasons.push("Upstream schedule does not cover all seven dates.");
    const fetchedAt = timestamp(input.schedule.fetchedAt ?? input.schedule.retrievedAt);
    const updatedAt = timestamp(input.schedule.updatedAt);
    if (input.schedule.updatedAt && !updatedAt) reasons.push("Invalid provider update timestamp.");
    const records = input.schedule.games ?? Object.values(input.schedule.data).flatMap((week) => Object.values(week)).filter((game) => !!game);
    const gamesById = /* @__PURE__ */ new Map();
    const rejectedIds = /* @__PURE__ */ new Set();
    for (const raw of records) {
      try {
        if (!Number.isSafeInteger(raw.id) || raw.id <= 0 || raw.season !== currentSeason(input.weekStart) || !Number.isSafeInteger(raw.gameType) || !raw.gameDate || !dates.includes(assertCalendarDate(raw.gameDate))) throw new Error("Invalid game identity, date, type or season.");
        const startTimeUtc = timestamp(raw.startTimeUTC);
        if (raw.startTimeUTC && !startTimeUtc) throw new Error("Invalid start timestamp.");
        if (startTimeUtc && localDate(startTimeUtc, SHARE_TIME_ZONE) !== raw.gameDate) throw new Error("Start time falls outside the source calendar date.");
        const homeTeam = publicTeam(raw.homeTeam), awayTeam = publicTeam(raw.awayTeam);
        if (homeTeam.id === awayTeam.id) throw new Error("Identical opponent identities.");
        const game = { id: raw.id, season: raw.season, gameType: raw.gameType, date: raw.gameDate, startTimeUtc, status: planningScheduleStatus(raw.gameState ?? "", raw.gameScheduleState ?? "") ?? "unknown", homeTeam, awayTeam };
        const prior = gamesById.get(game.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(game)) throw new Error("Conflicting records for game ID.");
        if (!rejectedIds.has(game.id)) gamesById.set(game.id, game);
      } catch {
        reasons.push(`Invalid or conflicting source game ${raw.id}.`);
        rejectedIds.add(raw.id);
        gamesById.delete(raw.id);
      }
    }
    const games = [...gamesById.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    if (input.schedule.numGamesPerDay.length !== 7 || dates.some((date, i) => !Number.isSafeInteger(input.schedule.numGamesPerDay[i]) || input.schedule.numGamesPerDay[i] < 0 || games.filter((game) => game.date === date).length !== input.schedule.numGamesPerDay[i])) reasons.push("Declared source daily game counts do not reconcile with the complete game records.");
    const teams = [...staticTeams];
    for (const game of games) for (const team of [game.homeTeam, game.awayTeam]) if (!teams.some((item) => item.id === team.id)) teams.push(team);
    const snapshot = { schemaVersion: 1, id: "", format: input.format, state: "ready", reasons: [], generatedAt, expiresAt: null, timeZone: SHARE_TIME_ZONE, weekStart: input.weekStart, weekEnd: dates[6], selectedDates: [], basis: "schedule_only", source: { name: "NHL schedule", fetchedAt, updatedAt, coveredDates, state: reasons.length ? "partial" : "ready", reasons }, days: [], teams, games, rows: [] };
    return selectScheduleDates(snapshot, input.selectedDates ?? (input.format === "remaining-week" ? dates.slice(3) : dates));
  }

  // web/node_modules/html-to-image/es/util.js
  function resolveUrl(url, baseUrl) {
    if (url.match(/^[a-z]+:\/\//i)) {
      return url;
    }
    if (url.match(/^\/\//)) {
      return window.location.protocol + url;
    }
    if (url.match(/^[a-z]+:/i)) {
      return url;
    }
    const doc = document.implementation.createHTMLDocument();
    const base = doc.createElement("base");
    const a = doc.createElement("a");
    doc.head.appendChild(base);
    doc.body.appendChild(a);
    if (baseUrl) {
      base.href = baseUrl;
    }
    a.href = url;
    return a.href;
  }
  var uuid = /* @__PURE__ */ (() => {
    let counter = 0;
    const random = () => (
      // eslint-disable-next-line no-bitwise
      `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
    );
    return () => {
      counter += 1;
      return `u${random()}${counter}`;
    };
  })();
  function toArray(arrayLike) {
    const arr = [];
    for (let i = 0, l = arrayLike.length; i < l; i++) {
      arr.push(arrayLike[i]);
    }
    return arr;
  }
  var styleProps = null;
  function getStyleProperties(options = {}) {
    if (styleProps) {
      return styleProps;
    }
    if (options.includeStyleProperties) {
      styleProps = options.includeStyleProperties;
      return styleProps;
    }
    styleProps = toArray(window.getComputedStyle(document.documentElement));
    return styleProps;
  }
  function px(node, styleProperty) {
    const win = node.ownerDocument.defaultView || window;
    const val = win.getComputedStyle(node).getPropertyValue(styleProperty);
    return val ? parseFloat(val.replace("px", "")) : 0;
  }
  function getNodeWidth(node) {
    const leftBorder = px(node, "border-left-width");
    const rightBorder = px(node, "border-right-width");
    return node.clientWidth + leftBorder + rightBorder;
  }
  function getNodeHeight(node) {
    const topBorder = px(node, "border-top-width");
    const bottomBorder = px(node, "border-bottom-width");
    return node.clientHeight + topBorder + bottomBorder;
  }
  function getImageSize(targetNode, options = {}) {
    const width = options.width || getNodeWidth(targetNode);
    const height = options.height || getNodeHeight(targetNode);
    return { width, height };
  }
  function getPixelRatio() {
    let ratio;
    let FINAL_PROCESS;
    try {
      FINAL_PROCESS = process;
    } catch (e) {
    }
    const val = FINAL_PROCESS && FINAL_PROCESS.env ? FINAL_PROCESS.env.devicePixelRatio : null;
    if (val) {
      ratio = parseInt(val, 10);
      if (Number.isNaN(ratio)) {
        ratio = 1;
      }
    }
    return ratio || window.devicePixelRatio || 1;
  }
  var canvasDimensionLimit = 16384;
  function checkCanvasDimensions(canvas) {
    if (canvas.width > canvasDimensionLimit || canvas.height > canvasDimensionLimit) {
      if (canvas.width > canvasDimensionLimit && canvas.height > canvasDimensionLimit) {
        if (canvas.width > canvas.height) {
          canvas.height *= canvasDimensionLimit / canvas.width;
          canvas.width = canvasDimensionLimit;
        } else {
          canvas.width *= canvasDimensionLimit / canvas.height;
          canvas.height = canvasDimensionLimit;
        }
      } else if (canvas.width > canvasDimensionLimit) {
        canvas.height *= canvasDimensionLimit / canvas.width;
        canvas.width = canvasDimensionLimit;
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height;
        canvas.height = canvasDimensionLimit;
      }
    }
  }
  function canvasToBlob(canvas, options = {}) {
    if (canvas.toBlob) {
      return new Promise((resolve) => {
        canvas.toBlob(resolve, options.type ? options.type : "image/png", options.quality ? options.quality : 1);
      });
    }
    return new Promise((resolve) => {
      const binaryString = window.atob(canvas.toDataURL(options.type ? options.type : void 0, options.quality ? options.quality : void 0).split(",")[1]);
      const len = binaryString.length;
      const binaryArray = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        binaryArray[i] = binaryString.charCodeAt(i);
      }
      resolve(new Blob([binaryArray], {
        type: options.type ? options.type : "image/png"
      }));
    });
  }
  function createImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        img.decode().then(() => {
          requestAnimationFrame(() => resolve(img));
        });
      };
      img.onerror = reject;
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
    });
  }
  async function svgToDataURL(svg) {
    return Promise.resolve().then(() => new XMLSerializer().serializeToString(svg)).then(encodeURIComponent).then((html) => `data:image/svg+xml;charset=utf-8,${html}`);
  }
  async function nodeToDataURL(node, width, height) {
    const xmlns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(xmlns, "svg");
    const foreignObject = document.createElementNS(xmlns, "foreignObject");
    svg.setAttribute("width", `${width}`);
    svg.setAttribute("height", `${height}`);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    foreignObject.setAttribute("width", "100%");
    foreignObject.setAttribute("height", "100%");
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    foreignObject.setAttribute("externalResourcesRequired", "true");
    svg.appendChild(foreignObject);
    foreignObject.appendChild(node);
    return svgToDataURL(svg);
  }
  var isInstanceOfElement = (node, instance) => {
    if (node instanceof instance)
      return true;
    const nodePrototype = Object.getPrototypeOf(node);
    if (nodePrototype === null)
      return false;
    return nodePrototype.constructor.name === instance.name || isInstanceOfElement(nodePrototype, instance);
  };

  // web/node_modules/html-to-image/es/clone-pseudos.js
  function formatCSSText(style) {
    const content = style.getPropertyValue("content");
    return `${style.cssText} content: '${content.replace(/'|"/g, "")}';`;
  }
  function formatCSSProperties(style, options) {
    return getStyleProperties(options).map((name) => {
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);
      return `${name}: ${value}${priority ? " !important" : ""};`;
    }).join(" ");
  }
  function getPseudoElementStyle(className, pseudo, style, options) {
    const selector = `.${className}:${pseudo}`;
    const cssText = style.cssText ? formatCSSText(style) : formatCSSProperties(style, options);
    return document.createTextNode(`${selector}{${cssText}}`);
  }
  function clonePseudoElement(nativeNode, clonedNode, pseudo, options) {
    const style = window.getComputedStyle(nativeNode, pseudo);
    const content = style.getPropertyValue("content");
    if (content === "" || content === "none") {
      return;
    }
    const className = uuid();
    try {
      clonedNode.className = `${clonedNode.className} ${className}`;
    } catch (err) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.appendChild(getPseudoElementStyle(className, pseudo, style, options));
    clonedNode.appendChild(styleElement);
  }
  function clonePseudoElements(nativeNode, clonedNode, options) {
    clonePseudoElement(nativeNode, clonedNode, ":before", options);
    clonePseudoElement(nativeNode, clonedNode, ":after", options);
  }

  // web/node_modules/html-to-image/es/mimes.js
  var WOFF = "application/font-woff";
  var JPEG = "image/jpeg";
  var mimes = {
    woff: WOFF,
    woff2: WOFF,
    ttf: "application/font-truetype",
    eot: "application/vnd.ms-fontobject",
    png: "image/png",
    jpg: JPEG,
    jpeg: JPEG,
    gif: "image/gif",
    tiff: "image/tiff",
    svg: "image/svg+xml",
    webp: "image/webp"
  };
  function getExtension(url) {
    const match = /\.([^./]*?)$/g.exec(url);
    return match ? match[1] : "";
  }
  function getMimeType(url) {
    const extension = getExtension(url).toLowerCase();
    return mimes[extension] || "";
  }

  // web/node_modules/html-to-image/es/dataurl.js
  function getContentFromDataUrl(dataURL) {
    return dataURL.split(/,/)[1];
  }
  function isDataUrl(url) {
    return url.search(/^(data:)/) !== -1;
  }
  function makeDataUrl(content, mimeType) {
    return `data:${mimeType};base64,${content}`;
  }
  async function fetchAsDataURL(url, init, process2) {
    const res = await fetch(url, init);
    if (res.status === 404) {
      throw new Error(`Resource "${res.url}" not found`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onloadend = () => {
        try {
          resolve(process2({ res, result: reader.result }));
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsDataURL(blob);
    });
  }
  var cache = {};
  function getCacheKey(url, contentType, includeQueryParams) {
    let key = url.replace(/\?.*/, "");
    if (includeQueryParams) {
      key = url;
    }
    if (/ttf|otf|eot|woff2?/i.test(key)) {
      key = key.replace(/.*\//, "");
    }
    return contentType ? `[${contentType}]${key}` : key;
  }
  async function resourceToDataURL(resourceUrl, contentType, options) {
    const cacheKey = getCacheKey(resourceUrl, contentType, options.includeQueryParams);
    if (cache[cacheKey] != null) {
      return cache[cacheKey];
    }
    if (options.cacheBust) {
      resourceUrl += (/\?/.test(resourceUrl) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime();
    }
    let dataURL;
    try {
      const content = await fetchAsDataURL(resourceUrl, options.fetchRequestInit, ({ res, result }) => {
        if (!contentType) {
          contentType = res.headers.get("Content-Type") || "";
        }
        return getContentFromDataUrl(result);
      });
      dataURL = makeDataUrl(content, contentType);
    } catch (error) {
      dataURL = options.imagePlaceholder || "";
      let msg = `Failed to fetch resource: ${resourceUrl}`;
      if (error) {
        msg = typeof error === "string" ? error : error.message;
      }
      if (msg) {
        console.warn(msg);
      }
    }
    cache[cacheKey] = dataURL;
    return dataURL;
  }

  // web/node_modules/html-to-image/es/clone-node.js
  async function cloneCanvasElement(canvas) {
    const dataURL = canvas.toDataURL();
    if (dataURL === "data:,") {
      return canvas.cloneNode(false);
    }
    return createImage(dataURL);
  }
  async function cloneVideoElement(video, options) {
    if (video.currentSrc) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx === null || ctx === void 0 ? void 0 : ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL2 = canvas.toDataURL();
      return createImage(dataURL2);
    }
    const poster = video.poster;
    const contentType = getMimeType(poster);
    const dataURL = await resourceToDataURL(poster, contentType, options);
    return createImage(dataURL);
  }
  async function cloneIFrameElement(iframe, options) {
    var _a;
    try {
      if ((_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) === null || _a === void 0 ? void 0 : _a.body) {
        return await cloneNode(iframe.contentDocument.body, options, true);
      }
    } catch (_b) {
    }
    return iframe.cloneNode(false);
  }
  async function cloneSingleNode(node, options) {
    if (isInstanceOfElement(node, HTMLCanvasElement)) {
      return cloneCanvasElement(node);
    }
    if (isInstanceOfElement(node, HTMLVideoElement)) {
      return cloneVideoElement(node, options);
    }
    if (isInstanceOfElement(node, HTMLIFrameElement)) {
      return cloneIFrameElement(node, options);
    }
    return node.cloneNode(isSVGElement(node));
  }
  var isSlotElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SLOT";
  var isSVGElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SVG";
  async function cloneChildren(nativeNode, clonedNode, options) {
    var _a, _b;
    if (isSVGElement(clonedNode)) {
      return clonedNode;
    }
    let children = [];
    if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
      children = toArray(nativeNode.assignedNodes());
    } else if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && ((_a = nativeNode.contentDocument) === null || _a === void 0 ? void 0 : _a.body)) {
      children = toArray(nativeNode.contentDocument.body.childNodes);
    } else {
      children = toArray(((_b = nativeNode.shadowRoot) !== null && _b !== void 0 ? _b : nativeNode).childNodes);
    }
    if (children.length === 0 || isInstanceOfElement(nativeNode, HTMLVideoElement)) {
      return clonedNode;
    }
    await children.reduce((deferred, child) => deferred.then(() => cloneNode(child, options)).then((clonedChild) => {
      if (clonedChild) {
        clonedNode.appendChild(clonedChild);
      }
    }), Promise.resolve());
    return clonedNode;
  }
  function cloneCSSStyle(nativeNode, clonedNode, options) {
    const targetStyle = clonedNode.style;
    if (!targetStyle) {
      return;
    }
    const sourceStyle = window.getComputedStyle(nativeNode);
    if (sourceStyle.cssText) {
      targetStyle.cssText = sourceStyle.cssText;
      targetStyle.transformOrigin = sourceStyle.transformOrigin;
    } else {
      getStyleProperties(options).forEach((name) => {
        let value = sourceStyle.getPropertyValue(name);
        if (name === "font-size" && value.endsWith("px")) {
          const reducedFont = Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1;
          value = `${reducedFont}px`;
        }
        if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && name === "display" && value === "inline") {
          value = "block";
        }
        if (name === "d" && clonedNode.getAttribute("d")) {
          value = `path(${clonedNode.getAttribute("d")})`;
        }
        targetStyle.setProperty(name, value, sourceStyle.getPropertyPriority(name));
      });
    }
  }
  function cloneInputValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
      clonedNode.innerHTML = nativeNode.value;
    }
    if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
      clonedNode.setAttribute("value", nativeNode.value);
    }
  }
  function cloneSelectValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
      const clonedSelect = clonedNode;
      const selectedOption = Array.from(clonedSelect.children).find((child) => nativeNode.value === child.getAttribute("value"));
      if (selectedOption) {
        selectedOption.setAttribute("selected", "");
      }
    }
  }
  function decorate(nativeNode, clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      cloneCSSStyle(nativeNode, clonedNode, options);
      clonePseudoElements(nativeNode, clonedNode, options);
      cloneInputValue(nativeNode, clonedNode);
      cloneSelectValue(nativeNode, clonedNode);
    }
    return clonedNode;
  }
  async function ensureSVGSymbols(clone, options) {
    const uses = clone.querySelectorAll ? clone.querySelectorAll("use") : [];
    if (uses.length === 0) {
      return clone;
    }
    const processedDefs = {};
    for (let i = 0; i < uses.length; i++) {
      const use = uses[i];
      const id = use.getAttribute("xlink:href");
      if (id) {
        const exist = clone.querySelector(id);
        const definition = document.querySelector(id);
        if (!exist && definition && !processedDefs[id]) {
          processedDefs[id] = await cloneNode(definition, options, true);
        }
      }
    }
    const nodes = Object.values(processedDefs);
    if (nodes.length) {
      const ns = "http://www.w3.org/1999/xhtml";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("xmlns", ns);
      svg.style.position = "absolute";
      svg.style.width = "0";
      svg.style.height = "0";
      svg.style.overflow = "hidden";
      svg.style.display = "none";
      const defs = document.createElementNS(ns, "defs");
      svg.appendChild(defs);
      for (let i = 0; i < nodes.length; i++) {
        defs.appendChild(nodes[i]);
      }
      clone.appendChild(svg);
    }
    return clone;
  }
  async function cloneNode(node, options, isRoot) {
    if (!isRoot && options.filter && !options.filter(node)) {
      return null;
    }
    return Promise.resolve(node).then((clonedNode) => cloneSingleNode(clonedNode, options)).then((clonedNode) => cloneChildren(node, clonedNode, options)).then((clonedNode) => decorate(node, clonedNode, options)).then((clonedNode) => ensureSVGSymbols(clonedNode, options));
  }

  // web/node_modules/html-to-image/es/embed-resources.js
  var URL_REGEX = /url\((['"]?)([^'"]+?)\1\)/g;
  var URL_WITH_FORMAT_REGEX = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g;
  var FONT_SRC_REGEX = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
  function toRegex(url) {
    const escaped = url.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp(`(url\\(['"]?)(${escaped})(['"]?\\))`, "g");
  }
  function parseURLs(cssText) {
    const urls = [];
    cssText.replace(URL_REGEX, (raw, quotation, url) => {
      urls.push(url);
      return raw;
    });
    return urls.filter((url) => !isDataUrl(url));
  }
  async function embed(cssText, resourceURL, baseURL, options, getContentFromUrl) {
    try {
      const resolvedURL = baseURL ? resolveUrl(resourceURL, baseURL) : resourceURL;
      const contentType = getMimeType(resourceURL);
      let dataURL;
      if (getContentFromUrl) {
        const content = await getContentFromUrl(resolvedURL);
        dataURL = makeDataUrl(content, contentType);
      } else {
        dataURL = await resourceToDataURL(resolvedURL, contentType, options);
      }
      return cssText.replace(toRegex(resourceURL), `$1${dataURL}$3`);
    } catch (error) {
    }
    return cssText;
  }
  function filterPreferredFontFormat(str, { preferredFontFormat }) {
    return !preferredFontFormat ? str : str.replace(FONT_SRC_REGEX, (match) => {
      while (true) {
        const [src, , format] = URL_WITH_FORMAT_REGEX.exec(match) || [];
        if (!format) {
          return "";
        }
        if (format === preferredFontFormat) {
          return `src: ${src};`;
        }
      }
    });
  }
  function shouldEmbed(url) {
    return url.search(URL_REGEX) !== -1;
  }
  async function embedResources(cssText, baseUrl, options) {
    if (!shouldEmbed(cssText)) {
      return cssText;
    }
    const filteredCSSText = filterPreferredFontFormat(cssText, options);
    const urls = parseURLs(filteredCSSText);
    return urls.reduce((deferred, url) => deferred.then((css) => embed(css, url, baseUrl, options)), Promise.resolve(filteredCSSText));
  }

  // web/node_modules/html-to-image/es/embed-images.js
  async function embedProp(propName, node, options) {
    var _a;
    const propValue = (_a = node.style) === null || _a === void 0 ? void 0 : _a.getPropertyValue(propName);
    if (propValue) {
      const cssString = await embedResources(propValue, null, options);
      node.style.setProperty(propName, cssString, node.style.getPropertyPriority(propName));
      return true;
    }
    return false;
  }
  async function embedBackground(clonedNode, options) {
    ;
    await embedProp("background", clonedNode, options) || await embedProp("background-image", clonedNode, options);
    await embedProp("mask", clonedNode, options) || await embedProp("-webkit-mask", clonedNode, options) || await embedProp("mask-image", clonedNode, options) || await embedProp("-webkit-mask-image", clonedNode, options);
  }
  async function embedImageNode(clonedNode, options) {
    const isImageElement = isInstanceOfElement(clonedNode, HTMLImageElement);
    if (!(isImageElement && !isDataUrl(clonedNode.src)) && !(isInstanceOfElement(clonedNode, SVGImageElement) && !isDataUrl(clonedNode.href.baseVal))) {
      return;
    }
    const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal;
    const dataURL = await resourceToDataURL(url, getMimeType(url), options);
    await new Promise((resolve, reject) => {
      clonedNode.onload = resolve;
      clonedNode.onerror = options.onImageErrorHandler ? (...attributes) => {
        try {
          resolve(options.onImageErrorHandler(...attributes));
        } catch (error) {
          reject(error);
        }
      } : reject;
      const image = clonedNode;
      if (image.decode) {
        image.decode = resolve;
      }
      if (image.loading === "lazy") {
        image.loading = "eager";
      }
      if (isImageElement) {
        clonedNode.srcset = "";
        clonedNode.src = dataURL;
      } else {
        clonedNode.href.baseVal = dataURL;
      }
    });
  }
  async function embedChildren(clonedNode, options) {
    const children = toArray(clonedNode.childNodes);
    const deferreds = children.map((child) => embedImages(child, options));
    await Promise.all(deferreds).then(() => clonedNode);
  }
  async function embedImages(clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      await embedBackground(clonedNode, options);
      await embedImageNode(clonedNode, options);
      await embedChildren(clonedNode, options);
    }
  }

  // web/node_modules/html-to-image/es/apply-style.js
  function applyStyle(node, options) {
    const { style } = node;
    if (options.backgroundColor) {
      style.backgroundColor = options.backgroundColor;
    }
    if (options.width) {
      style.width = `${options.width}px`;
    }
    if (options.height) {
      style.height = `${options.height}px`;
    }
    const manual = options.style;
    if (manual != null) {
      Object.keys(manual).forEach((key) => {
        style[key] = manual[key];
      });
    }
    return node;
  }

  // web/node_modules/html-to-image/es/embed-webfonts.js
  var cssFetchCache = {};
  async function fetchCSS(url) {
    let cache2 = cssFetchCache[url];
    if (cache2 != null) {
      return cache2;
    }
    const res = await fetch(url);
    const cssText = await res.text();
    cache2 = { url, cssText };
    cssFetchCache[url] = cache2;
    return cache2;
  }
  async function embedFonts(data, options) {
    let cssText = data.cssText;
    const regexUrl = /url\(["']?([^"')]+)["']?\)/g;
    const fontLocs = cssText.match(/url\([^)]+\)/g) || [];
    const loadFonts = fontLocs.map(async (loc) => {
      let url = loc.replace(regexUrl, "$1");
      if (!url.startsWith("https://")) {
        url = new URL(url, data.url).href;
      }
      return fetchAsDataURL(url, options.fetchRequestInit, ({ result }) => {
        cssText = cssText.replace(loc, `url(${result})`);
        return [loc, result];
      });
    });
    return Promise.all(loadFonts).then(() => cssText);
  }
  function parseCSS(source) {
    if (source == null) {
      return [];
    }
    const result = [];
    const commentsRegex = /(\/\*[\s\S]*?\*\/)/gi;
    let cssText = source.replace(commentsRegex, "");
    const keyframesRegex = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
    while (true) {
      const matches = keyframesRegex.exec(cssText);
      if (matches === null) {
        break;
      }
      result.push(matches[0]);
    }
    cssText = cssText.replace(keyframesRegex, "");
    const importRegex = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi;
    const combinedCSSRegex = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})";
    const unifiedRegex = new RegExp(combinedCSSRegex, "gi");
    while (true) {
      let matches = importRegex.exec(cssText);
      if (matches === null) {
        matches = unifiedRegex.exec(cssText);
        if (matches === null) {
          break;
        } else {
          importRegex.lastIndex = unifiedRegex.lastIndex;
        }
      } else {
        unifiedRegex.lastIndex = importRegex.lastIndex;
      }
      result.push(matches[0]);
    }
    return result;
  }
  async function getCSSRules(styleSheets, options) {
    const ret = [];
    const deferreds = [];
    styleSheets.forEach((sheet) => {
      if ("cssRules" in sheet) {
        try {
          toArray(sheet.cssRules || []).forEach((item, index) => {
            if (item.type === CSSRule.IMPORT_RULE) {
              let importIndex = index + 1;
              const url = item.href;
              const deferred = fetchCSS(url).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
                try {
                  sheet.insertRule(rule, rule.startsWith("@import") ? importIndex += 1 : sheet.cssRules.length);
                } catch (error) {
                  console.error("Error inserting rule from remote css", {
                    rule,
                    error
                  });
                }
              })).catch((e) => {
                console.error("Error loading remote css", e.toString());
              });
              deferreds.push(deferred);
            }
          });
        } catch (e) {
          const inline = styleSheets.find((a) => a.href == null) || document.styleSheets[0];
          if (sheet.href != null) {
            deferreds.push(fetchCSS(sheet.href).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
              inline.insertRule(rule, inline.cssRules.length);
            })).catch((err) => {
              console.error("Error loading remote stylesheet", err);
            }));
          }
          console.error("Error inlining remote css file", e);
        }
      }
    });
    return Promise.all(deferreds).then(() => {
      styleSheets.forEach((sheet) => {
        if ("cssRules" in sheet) {
          try {
            toArray(sheet.cssRules || []).forEach((item) => {
              ret.push(item);
            });
          } catch (e) {
            console.error(`Error while reading CSS rules from ${sheet.href}`, e);
          }
        }
      });
      return ret;
    });
  }
  function getWebFontRules(cssRules) {
    return cssRules.filter((rule) => rule.type === CSSRule.FONT_FACE_RULE).filter((rule) => shouldEmbed(rule.style.getPropertyValue("src")));
  }
  async function parseWebFontRules(node, options) {
    if (node.ownerDocument == null) {
      throw new Error("Provided element is not within a Document");
    }
    const styleSheets = toArray(node.ownerDocument.styleSheets);
    const cssRules = await getCSSRules(styleSheets, options);
    return getWebFontRules(cssRules);
  }
  function normalizeFontFamily(font) {
    return font.trim().replace(/["']/g, "");
  }
  function getUsedFonts(node) {
    const fonts2 = /* @__PURE__ */ new Set();
    function traverse(node2) {
      const fontFamily = node2.style.fontFamily || getComputedStyle(node2).fontFamily;
      fontFamily.split(",").forEach((font) => {
        fonts2.add(normalizeFontFamily(font));
      });
      Array.from(node2.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          traverse(child);
        }
      });
    }
    traverse(node);
    return fonts2;
  }
  async function getWebFontCSS(node, options) {
    const rules = await parseWebFontRules(node, options);
    const usedFonts = getUsedFonts(node);
    const cssTexts = await Promise.all(rules.filter((rule) => usedFonts.has(normalizeFontFamily(rule.style.fontFamily))).map((rule) => {
      const baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
      return embedResources(rule.cssText, baseUrl, options);
    }));
    return cssTexts.join("\n");
  }
  async function embedWebFonts(clonedNode, options) {
    const cssText = options.fontEmbedCSS != null ? options.fontEmbedCSS : options.skipFonts ? null : await getWebFontCSS(clonedNode, options);
    if (cssText) {
      const styleNode = document.createElement("style");
      const sytleContent = document.createTextNode(cssText);
      styleNode.appendChild(sytleContent);
      if (clonedNode.firstChild) {
        clonedNode.insertBefore(styleNode, clonedNode.firstChild);
      } else {
        clonedNode.appendChild(styleNode);
      }
    }
  }

  // web/node_modules/html-to-image/es/index.js
  async function toSvg(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const clonedNode = await cloneNode(node, options, true);
    await embedWebFonts(clonedNode, options);
    await embedImages(clonedNode, options);
    applyStyle(clonedNode, options);
    const datauri = await nodeToDataURL(clonedNode, width, height);
    return datauri;
  }
  async function toCanvas(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const svg = await toSvg(node, options);
    const img = await createImage(svg);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ratio = options.pixelRatio || getPixelRatio();
    const canvasWidth = options.canvasWidth || width;
    const canvasHeight = options.canvasHeight || height;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    if (!options.skipAutoScale) {
      checkCanvasDimensions(canvas);
    }
    canvas.style.width = `${canvasWidth}`;
    canvas.style.height = `${canvasHeight}`;
    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  async function toBlob(node, options = {}) {
    const canvas = await toCanvas(node, options);
    const blob = await canvasToBlob(canvas);
    return blob;
  }

  // web/lib/socialShare/export.ts
  var SHARE_SIZE = 1080;
  var fonts = [
    { family: "Share Roboto Condensed", file: "RobotoCondensed-Variable.ttf", weight: "100 900", sample: "700 48px" },
    { family: "Share Train One", file: "TrainOne-Regular.ttf", weight: "400", sample: "400 36px" },
    { family: "Share Martian Mono", file: "MartianMono-Variable.ttf", weight: "100 800", sample: "500 32px" }
  ];
  function bounded(promise, message, ms = 1e4) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(message)), ms);
      promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  async function readyShareFonts() {
    for (const font of fonts) {
      const query = `${font.sample} "${font.family}"`;
      const loaded = await bounded(document.fonts.load(query), "Local fonts did not load. Retry preview preparation.");
      if (!loaded.length || !document.fonts.check(query)) throw new Error(`Required font unavailable: ${font.family}`);
    }
  }
  async function teamLogoDataUrl(abbreviation, size = 96) {
    if (!/^[A-Z]{3}$/.test(abbreviation)) throw new Error("Invalid team abbreviation.");
    const image = new Image();
    image.src = `/teamLogos/${abbreviation}.png`;
    await bounded(image.decode(), "Team logo unavailable", 5e3);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Team logo unavailable");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.imageSmoothingQuality = "high";
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL("image/png");
  }
  function assertExportable(snapshot, options = {}) {
    if (snapshot.state !== "ready" || snapshot.source.state !== "ready") throw new Error("A complete, fresh schedule is required to download.");
    if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= Date.now()) throw new Error("This edition expired. Refresh the schedule before downloading.");
    if (!snapshot.selectedDates.length || !snapshot.rows.some((row) => row.remainingGames > 0)) throw new Error("Select dates with remaining games before downloading.");
    if (options.opponents && snapshot.opponents?.state !== "ready") throw new Error("Current, complete opponent team ratings are required to download this card.");
    if (options.players && snapshot.players?.state !== "ready") throw new Error("Current player ownership and season totals are required to download this card.");
    if (options.trends && snapshot.trends?.state !== "ready") throw new Error("Current rolling game metrics are required to download this card.");
    if (options.movers && snapshot.trends?.moversState !== "ready") throw new Error("Current Yahoo ownership is required to download this card.");
  }
  async function embeddedFonts() {
    return (await Promise.all(fonts.map(async (font) => {
      const response = await bounded(fetch(`/fonts/social-share/${font.file}`), "Local font download timed out.");
      if (!response.ok) throw new Error("Local font file unavailable.");
      const blob = await response.blob();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to embed local font."));
        reader.readAsDataURL(blob);
      });
      return `@font-face{font-family:'${font.family}';src:url('${data}') format('truetype');font-weight:${font.weight};font-style:normal;font-display:block;}`;
    }))).join("\n");
  }
  async function downloadSharePng(node, snapshot, options = {}) {
    assertExportable(snapshot, options);
    await readyShareFonts();
    await Promise.all(Array.from(node.querySelectorAll("img")).map(async (image) => {
      await bounded(image.decode(), "Brand image could not be decoded. Retry preview preparation.");
      if (!image.naturalWidth) throw new Error("Brand image unavailable.");
    }));
    const fontEmbedCSS = await bounded(embeddedFonts(), "Font embedding timed out.");
    assertExportable(snapshot, options);
    const blob = await bounded(toBlob(node, {
      width: SHARE_SIZE,
      height: SHARE_SIZE,
      canvasWidth: SHARE_SIZE,
      canvasHeight: SHARE_SIZE,
      pixelRatio: 1,
      fontEmbedCSS,
      style: { transform: "none", transformOrigin: "top left" }
    }), "PNG creation timed out. Retry with the same edition.", 2e4);
    if (!blob) throw new Error("PNG could not be created.");
    assertExportable(snapshot, options);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fhfh-${snapshot.format}${options.card ? `-${options.card.replace(/[^a-z0-9-]/g, "")}` : ""}-${snapshot.weekStart}-${snapshot.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20)}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }

  // web/lib/socialShare/mondayGrid.ts
  function countsAsOpportunity(snapshot, game) {
    return game.gameType === 2 && game.status === "scheduled" && game.startTimeUtc !== null && snapshot.selectedDates.includes(game.date) && Date.parse(game.startTimeUtc) > Date.parse(snapshot.generatedAt);
  }
  function mondayGridRows(snapshot, trusted) {
    const rows = trusted ? snapshot.rows : [...snapshot.rows].sort((a, b) => a.team.abbreviation.localeCompare(b.team.abbreviation) || a.team.id - b.team.id);
    return rows.map((row) => ({
      team: row.team,
      rank: trusted && row.remainingGames > 0 ? row.rank : null,
      score: row.score,
      remainingGames: row.remainingGames,
      offNightGames: row.offNightGames,
      cells: snapshot.days.map((day) => ({
        date: day.date,
        selected: day.selected,
        offNight: day.offNight,
        games: row.games.filter((game) => game.date === day.date && game.gameType === 2 && !["postponed", "cancelled"].includes(game.status)).sort((a, b) => (a.startTimeUtc ?? "").localeCompare(b.startTimeUtc ?? "") || a.id - b.id).map((game) => {
          const home = game.homeTeam.id === row.team.id;
          return { id: game.id, opponent: home ? game.awayTeam : game.homeTeam, home, counted: countsAsOpportunity(snapshot, game) };
        })
      }))
    }));
  }
  function countTiers(values) {
    const distinct = [...new Set(values)].sort((a, b) => b - a);
    return new Map(distinct.map((value, index) => [
      value,
      distinct.length === 1 ? "neutral" : index === 0 ? "high" : index === distinct.length - 1 ? "low" : index === 1 ? "second" : "between"
    ]));
  }
  function editionCountTiers(snapshot) {
    return { gp: countTiers(snapshot.rows.map((row) => row.remainingGames)), off: countTiers(snapshot.rows.map((row) => row.offNightGames)) };
  }

  // web/lib/socialShare/editionFetch.ts
  var inflight = /* @__PURE__ */ new Map();
  async function fetchEdition(url, fetcher = fetch) {
    const path = url.match(/^\/api\/v1\/social-share\/([a-z-]+)(?:\?[^#\s\\]*)?$/);
    if (!path || !isSocialShareFormat(path[1])) throw new Error("Invalid share studio request.");
    const { data, error } = await auth_default.auth.getSession();
    const session = data.session;
    if (error || !session?.user.id || !session.access_token) throw new Error("Sign in to use the share studio.");
    const key = JSON.stringify([session.user.id, session.access_token, url]);
    const pending = inflight.get(key);
    if (pending) return pending;
    const request = fetcher(url, { cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${session.access_token}` } }).then(async (response) => {
      const body = await response.json();
      const current2 = await auth_default.auth.getSession();
      if (current2.error || current2.data.session?.user.id !== session.user.id || current2.data.session?.access_token !== session.access_token) {
        throw new Error("Your session changed. Reopen the share studio.");
      }
      return { ok: response.ok, status: response.status, body };
    }).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  }

  // web/lib/socialShare/edition.ts
  var POSTING_DAYS = {
    "game-grid": { label: "Monday", index: 0 },
    "tuesday-trends": { label: "Tuesday", index: 1 },
    "remaining-week": { label: "Wednesday", index: 2 }
  };
  function editionLabel(snapshot) {
    const today = localDate(snapshot.generatedAt, SHARE_TIME_ZONE), own = POSTING_DAYS[snapshot.format];
    if (own && today === weekDates(snapshot.weekStart)[own.index]) return own.label;
    return today < snapshot.weekStart ? "Week ahead" : today > snapshot.weekEnd ? "Past week" : "This week";
  }

  // web/components/GameGrid/utils/scheduleOpportunity.ts
  function percentileMap(values) {
    const sorted = values.filter((v) => v.value != null && Number.isFinite(v.value)).sort((a, b) => a.value - b.value);
    const result = /* @__PURE__ */ new Map();
    for (let first = 0; first < sorted.length; ) {
      let end = first + 1;
      while (end < sorted.length && sorted[end].value === sorted[first].value) end++;
      const percentile = sorted.length === 1 ? 50 : 100 * ((first + end - 1) / 2) / (sorted.length - 1);
      sorted.slice(first, end).forEach(({ teamId }) => result.set(teamId, percentile));
      first = end;
    }
    return result;
  }

  // web/lib/socialShare/matchups.ts
  var OPPONENT_STATS_MAX_AGE_MS = 72 * 36e5;
  var EASIEST_LIMIT = 8;
  var STREAM_LIMIT = 6;
  var SOFT_DEFENSE_MAX = 33;
  var STREAM_TEAM_RANK_MAX = 16;
  var opponentsReady = (snapshot) => snapshot.opponents?.state === "ready";
  function opponentDefense(snapshot) {
    const rates = snapshot.opponents?.teams ?? {};
    const allowance = percentileMap(snapshot.teams.map((team) => {
      const rate = rates[team.abbreviation];
      return { teamId: team.id, value: rate ? rate.xga / rate.gp : null };
    }));
    return new Map([...allowance].map(([teamId, pct]) => [teamId, 100 - pct]));
  }
  function countedGames(snapshot, team, defense) {
    return snapshot.games.filter((game) => (game.homeTeam.id === team.id || game.awayTeam.id === team.id) && countsAsOpportunity(snapshot, game)).sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc) || a.id - b.id).map((game) => {
      const home = game.homeTeam.id === team.id, opponent = home ? game.awayTeam : game.homeTeam;
      const day = snapshot.days.find((item) => item.date === game.date);
      return { id: game.id, date: game.date, opponent, home, offNight: day.offNight, leagueGames: day.leagueGames, oppDef: defense.get(opponent.id) ?? null };
    });
  }
  function easiestSchedules(snapshot, trusted) {
    const floor = Math.max(1, Math.min(3, ...snapshot.rows.map((row) => row.remainingGames).filter((games) => games > 0).sort((a, b) => b - a).slice(0, 1)));
    if (!trusted || !opponentsReady(snapshot)) return { floor, rows: [] };
    const defense = opponentDefense(snapshot), rates = snapshot.opponents.teams;
    const scheduled = snapshot.rows.filter((row) => row.remainingGames > 0).map((row) => {
      const games = countedGames(snapshot, row.team, defense);
      const allowances = games.map((game) => rates[game.opponent.abbreviation]).filter(Boolean).map((rate) => rate.xga / rate.gp);
      return { row, games, mean: allowances.length === games.length ? allowances.reduce((sum, value) => sum + value, 0) / games.length : null };
    });
    const allowance = percentileMap(scheduled.map((item) => ({ teamId: item.row.team.id, value: item.mean })));
    const rows = scheduled.filter((item) => item.row.remainingGames >= floor && allowance.has(item.row.team.id)).map((item) => ({ team: item.row.team, rank: 0, weekRank: item.row.rank, remainingGames: item.row.remainingGames, offNightGames: item.row.offNightGames, def: 100 - allowance.get(item.row.team.id), games: item.games })).sort((a, b) => a.def - b.def || b.remainingGames - a.remainingGames || a.weekRank - b.weekRank || a.team.abbreviation.localeCompare(b.team.abbreviation)).slice(0, EASIEST_LIMIT).map((row, i) => ({ ...row, rank: i + 1 }));
    return { floor, rows };
  }
  function rateRanks(snapshot, key) {
    const values = Object.entries(snapshot.opponents?.teams ?? {}).flatMap(([team, rates]) => rates[key] === void 0 || rates.gp <= 0 ? [] : [{ team, perGame: rates[key] / rates.gp }]).sort((a, b) => b.perGame - a.perGame);
    return new Map(values.map(({ team, perGame }) => [team, { perGame, rank: 1 + values.findIndex((item) => item.perGame === perGame), of: values.length }]));
  }
  var topThird = (rate) => !!rate && rate.rank <= Math.ceil(rate.of / 3);
  var previousDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  function streamEvidence(snapshot, team, opponent, date) {
    const gf = rateRanks(snapshot, "gf"), ga = rateRanks(snapshot, "ga"), sf = rateRanks(snapshot, "sf"), sa = rateRanks(snapshot, "sa");
    const goals = { team: gf.get(team.abbreviation) ?? null, opponent: ga.get(opponent.abbreviation) ?? null, storm: false };
    goals.storm = topThird(goals.team) && topThird(goals.opponent);
    const shots = { team: sf.get(team.abbreviation) ?? null, opponent: sa.get(opponent.abbreviation) ?? null, storm: false };
    shots.storm = topThird(shots.team) && topThird(shots.opponent);
    const before = previousDay(date), known = before >= snapshot.weekStart;
    const played = (id) => snapshot.games.some((game) => game.date === before && game.gameType === 2 && !["postponed", "cancelled"].includes(game.status) && (game.homeTeam.id === id || game.awayTeam.id === id));
    const rest = { opponentSecondNight: known ? played(opponent.id) : null, teamSecondNight: known ? played(team.id) : null };
    const flags = [...goals.storm ? ["goals"] : [], ...shots.storm ? ["shots"] : [], ...rest.opponentSecondNight && !rest.teamSecondNight ? ["tired"] : []];
    return { goals, shots, rest, flags };
  }
  function streamingNights(snapshot, trusted) {
    if (!trusted || !opponentsReady(snapshot)) return [];
    const defense = opponentDefense(snapshot);
    return snapshot.rows.filter((row) => row.remainingGames > 0 && row.rank <= STREAM_TEAM_RANK_MAX).flatMap((row) => countedGames(snapshot, row.team, defense).map((game) => ({ ...game, team: row.team, weekRank: row.rank, remainingGames: row.remainingGames, evidence: streamEvidence(snapshot, row.team, game.opponent, game.date) })).filter((night) => night.oppDef !== null && night.oppDef <= SOFT_DEFENSE_MAX || night.evidence.flags.some((flag) => flag !== "tired"))).sort((a, b) => b.evidence.flags.length - a.evidence.flags.length || Number(b.offNight) - Number(a.offNight) || (a.oppDef ?? 100) - (b.oppDef ?? 100) || a.weekRank - b.weekRank || a.date.localeCompare(b.date) || a.id - b.id).filter((night, index, nights) => nights.findIndex((item) => item.team.id === night.team.id) === index).slice(0, STREAM_LIMIT);
  }

  // web/lib/socialShare/pickupsFixture.ts
  var PICKUP_YAHOO_TEAM_ALIASES = { LA: "LAK", NJ: "NJD", SJ: "SJS", TB: "TBL", WAS: "WSH", MON: "MTL" };
  var NHL_TO_YAHOO = Object.fromEntries(Object.entries(PICKUP_YAHOO_TEAM_ALIASES).map(([yahoo, nhl]) => [nhl, yahoo]));

  // web/lib/socialShare/players.ts
  var MIN_SKATER_GAMES = 5;
  var MIN_GOALIE_STARTS = 3;
  var PLAYER_STATS_MAX_AGE_MS = 72 * 36e5;
  var PLAYER_TEAM_RANK_MAX = 10;
  var PLAYERS_PER_LIST = 3;
  var sameDates = (a, b) => a.length === b.length && a.every((date, i) => date === b[i]);
  var playersMatchSelection = (snapshot) => !snapshot.players?.selectedDates || sameDates(snapshot.players.selectedDates, snapshot.selectedDates);
  var playersReady = (snapshot) => snapshot.players?.state === "ready" && playersMatchSelection(snapshot);
  function rankedPlayers(snapshot) {
    const rows = new Map(snapshot.rows.filter((row) => row.remainingGames > 0).map((row) => [row.team.abbreviation, row]));
    return (snapshot.players?.players ?? []).flatMap((player) => {
      const row = rows.get(player.team);
      return row ? [{ ...player, weekRank: row.rank, remainingGames: row.remainingGames, offNightGames: row.offNightGames, widened: row.rank > PLAYER_TEAM_RANK_MAX }] : [];
    });
  }
  function fillThree(candidates, order) {
    const top = candidates.filter((player) => !player.widened).sort(order).slice(0, PLAYERS_PER_LIST);
    const wider = candidates.filter((player) => player.widened).sort((a, b) => a.weekRank - b.weekRank || order(a, b));
    return [...top, ...wider].slice(0, PLAYERS_PER_LIST);
  }
  var tieBreak = (a, b) => a.weekRank - b.weekRank || a.ownership - b.ownership || a.name.localeCompare(b.name) || a.nhlId - b.nhlId;
  var pickupOrder = (a, b) => a.group === "G" && b.group === "G" ? (b.qualityStartPct ?? -1) - (a.qualityStartPct ?? -1) || (b.savePct ?? -1) - (a.savePct ?? -1) || tieBreak(a, b) : (b.pointsPerGame ?? -1) - (a.pointsPerGame ?? -1) || tieBreak(a, b);
  var PICKUP_BANDS = [
    { max: 50, min: 30, label: "30\u201349%" },
    { max: 30, min: 20, label: "20\u201329%" },
    { max: 20, min: 0, label: "Under 20%" }
  ];
  function pickupTiers(snapshot, trusted) {
    if (!trusted || !playersReady(snapshot)) return [];
    const pool = rankedPlayers(snapshot);
    return PICKUP_BANDS.map((band) => ({ ...band, groups: Object.fromEntries(["F", "D", "G"].map((group) => [group, fillThree(pool.filter((player) => player.group === group && player.ownership >= band.min && player.ownership < band.max), pickupOrder)])) }));
  }
  function specialists(snapshot, trusted) {
    const empty = { hits: [], shots: [], blocks: [] };
    if (!trusted || !playersReady(snapshot)) return empty;
    const pool = rankedPlayers(snapshot).filter((player) => player.group !== "G" && player.ownership < 50);
    return Object.fromEntries(["hits", "shots", "blocks"].map((category) => [
      category,
      fillThree(pool.map((player) => ({ ...player, perGame: player[category] / player.gamesPlayed })), (a, b) => b.perGame - a.perGame || tieBreak(a, b))
    ]));
  }

  // web/lib/socialShare/trends.ts
  var TREND_WINDOW_GAMES = 5;
  var MIN_TREND_SEASON_GAMES = 10;
  var MIN_RATE_TOI_SECONDS_LAST5 = 3e3;
  var TREND_LIST = 5;
  var DEPLOYMENT_LIST = 4;
  var RATE_LIST = 3;
  var trendsReady = (snapshot) => snapshot.trends?.state === "ready";
  var moversReady = (snapshot) => snapshot.trends?.moversState === "ready";
  function picks(snapshot, metric, filter = () => true) {
    const games = new Map(snapshot.rows.map((row) => [row.team.abbreviation, row.remainingGames]));
    return (snapshot.trends?.players ?? []).filter(filter).flatMap((player) => {
      const { last5, season } = player[metric];
      return last5 === null || season === null ? [] : [{ ...player, last5, season, delta: last5 - season, weekGames: games.get(player.team) ?? null }];
    });
  }
  var byDelta = (direction) => (a, b) => direction * (b.delta - a.delta) || b.season - a.season || a.name.localeCompare(b.name) || a.nhlId - b.nhlId;
  function hotCold(snapshot, trusted) {
    if (!trusted || !trendsReady(snapshot)) return { hot: [], cold: [] };
    const all = picks(snapshot, "pointsPerGame");
    return { hot: all.filter((pick) => pick.delta > 0).sort(byDelta(1)).slice(0, TREND_LIST), cold: all.filter((pick) => pick.delta < 0).sort(byDelta(-1)).slice(0, TREND_LIST) };
  }
  function deploymentChanges(snapshot, trusted) {
    if (!trusted || !trendsReady(snapshot)) return { up: [], down: [] };
    const all = picks(snapshot, "toiSeconds");
    return { up: all.filter((pick) => pick.delta > 0).sort(byDelta(1)).slice(0, DEPLOYMENT_LIST), down: all.filter((pick) => pick.delta < 0).sort(byDelta(-1)).slice(0, DEPLOYMENT_LIST) };
  }
  function rateStandouts(snapshot, trusted) {
    if (!trusted || !trendsReady(snapshot)) return { sogPer60: [], icfPer60: [], ixgPer60: [] };
    const sampled = (player) => (player.toiSecondsLast5 ?? 0) >= MIN_RATE_TOI_SECONDS_LAST5;
    return Object.fromEntries(["sogPer60", "icfPer60", "ixgPer60"].map((metric) => [metric, picks(snapshot, metric, sampled).filter((pick) => pick.delta > 0).sort(byDelta(1)).slice(0, RATE_LIST)]));
  }
  function ownershipMovers(snapshot, trusted) {
    if (!trusted || !moversReady(snapshot)) return { risers: [], fallers: [] };
    const all = snapshot.trends.movers, order = (direction) => (a, b) => direction * (b.delta - a.delta) || b.latest - a.latest || a.name.localeCompare(b.name);
    return { risers: all.filter((mover) => mover.delta > 0).sort(order(1)).slice(0, TREND_LIST), fallers: all.filter((mover) => mover.delta < 0).sort(order(-1)).slice(0, TREND_LIST) };
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/SocialShare.module.scss
  var SocialShare_module_default = new Proxy({}, { get: (_, key) => String(key) });

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/TeamBanner.tsx
  var import_jsx_runtime4 = __toESM(require_jsx_runtime());
  var luminance = (hex) => {
    const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
    if (!value) return 0.5;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  var sameColor = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  function teamBannerStyle(abbreviation) {
    const info = teamsInfo[abbreviation];
    if (!info) return { "--team-bg": "#2a2f36", "--team-ink": "#ffffff", "--team-dark": "#0b0d10", "--team-light": "#d8dde3", "--team-mid": "#5b6470" };
    const bg = luminance(info.primaryColor) < 0.03 ? info.secondaryColor : info.primaryColor;
    const palette = [info.primaryColor, info.secondaryColor, info.jersey, info.accent, info.alt];
    const dark = [...palette, "#0b0d10"].sort((a, b) => luminance(a) - luminance(b))[0];
    const light = [...palette, "#ffffff"].sort((a, b) => luminance(b) - luminance(a))[0];
    const mid = [info.secondaryColor, info.accent, info.alt, info.primaryColor].find((color) => !sameColor(color, bg) && !sameColor(color, dark) && !sameColor(color, light)) ?? light;
    return { "--team-bg": bg, "--team-ink": luminance(bg) > 0.4 ? "#101317" : "#ffffff", "--team-dark": dark, "--team-light": light, "--team-mid": mid };
  }
  function TeamLogo({ team, logo, size }) {
    return logo ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: logo, alt: "", width: size, height: size }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { className: SocialShare_module_default.logoFallback, children: team.abbreviation });
  }
  function TeamBanner({ team, logo, title, subtitle, right, size = "md" }) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: SocialShare_module_default.teamBanner, "data-size": size, style: teamBannerStyle(team.abbreviation), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: SocialShare_module_default.teamBannerLogo, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TeamLogo, { team, logo, size: size === "sm" ? 40 : 52 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: SocialShare_module_default.teamBannerText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: title }),
        subtitle && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: subtitle })
      ] }),
      right && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: SocialShare_module_default.teamBannerRight, children: right })
    ] });
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/snapshot/web/components/SocialShare/SocialShare.tsx
  var import_jsx_runtime5 = __toESM(require_jsx_runtime());
  var labels = {
    "game-grid": "Weekly schedule",
    "remaining-week": "Remaining week",
    "tuesday-trends": "Tuesday trends",
    "player-spotlight": "Player spotlight",
    "category-rescue": "Category rescue"
  };
  var dateLabel = (date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${date}T12:00:00Z`));
  var yearDateLabel = (date) => `${dateLabel(date)}, ${date.slice(0, 4)}`;
  var timeLabel = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value)) : "Not available";
  var scoreLabel = (row) => row.remainingGames ? row.score.toFixed(1) : "No games";
  var titleDay = (label) => label.charAt(0) + label.slice(1, 3).toLowerCase();
  var cx = (...names) => names.filter(Boolean).join(" ");
  var defaultGraphic = (format) => format === "game-grid" || format === "remaining-week" ? "grid" : format === "tuesday-trends" ? "hot" : "leaders";
  var editionDays = { "game-grid": "Monday", "tuesday-trends": "Tuesday", "remaining-week": "Wednesday" };
  var editionDay = (snapshot) => editionLabel(snapshot);
  function coveredDays(snapshot) {
    const indexes = snapshot.days.map((day, index) => day.selected ? index : -1).filter((index) => index >= 0);
    const label = (index) => titleDay(snapshot.days[index].label);
    const contiguous = indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
    return !indexes.length ? "No days" : indexes.length === 1 ? label(indexes[0]) : contiguous ? `${label(indexes[0])}\u2013${label(indexes[indexes.length - 1])}` : indexes.map(label).join(", ");
  }
  var matchupTitles = { easiest: "EASIEST SCHEDULES", stream: "STREAMING MATCHUPS" };
  var softness = (def) => def === null ? null : def <= SOFT_DEFENSE_MAX ? "soft" : def >= 100 - SOFT_DEFENSE_MAX ? "strong" : "average";
  function futureItinerary(snapshot, row) {
    return row.games.filter((game) => snapshot.selectedDates.includes(game.date) && game.gameType === 2 && game.status === "scheduled" && game.startTimeUtc !== null && Date.parse(game.startTimeUtc) > Date.parse(snapshot.generatedAt)).sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc));
  }
  function altText(snapshot, rows, trusted, teamFocus) {
    const itinerary = teamFocus && rows[0] ? ` Selected future regular-season itinerary: ${futureItinerary(snapshot, rows[0]).map((game) => {
      const home = game.homeTeam.id === rows[0].team.id;
      const day = snapshot.days.find((item) => item.date === game.date);
      return `${yearDateLabel(game.date)}, ${home ? "home vs" : "away at"} ${home ? game.awayTeam.name : game.homeTeam.name}, ${timeLabel(game.startTimeUtc)}, ${day.offNight ? "off-night" : "busy night"} (${day.leagueGames} games on the full NHL slate)`;
    }).join("; ")}.` : "";
    return `FHFH ${labels[snapshot.format]}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. ${trusted ? "Schedule only" : "Unranked preview only; source or edition is not ready"}, remaining games after ${timeLabel(snapshot.generatedAt)}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}. ${rows.map((row) => `${row.team.name}: ${row.remainingGames} ${trusted ? "remaining" : "known remaining"} games, ${row.offNightGames} ${trusted ? "" : "known "}off-night games${trusted ? `, Schedule Score ${scoreLabel(row)}` : "; ranking unavailable"}`).join("; ")}.${itinerary} NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. Off-night density uses the full daily slate. Observed schedule only. No odds or player projections.`;
  }
  function gridAltText(snapshot, trusted) {
    const dayLabel = (date) => titleDay(snapshot.days.find((day) => day.date === date).label);
    const offNights = snapshot.days.filter((day) => day.offNight).map((day) => titleDay(day.label)).join(", ") || "none";
    const rows = mondayGridRows(snapshot, trusted).map((row) => `${row.rank ? `${row.rank}. ` : ""}${row.team.name}: ${row.remainingGames} ${trusted ? "" : "known "}games left, ${row.offNightGames} off-night; ${row.cells.flatMap((cell) => cell.games.map((game) => `${dayLabel(cell.date)} ${game.home ? "vs" : "@"} ${game.opponent.abbreviation}${game.counted ? "" : " (not counted)"}`)).join(", ") || "no games"}`);
    return `FHFH Best schedules, ${editionDay(snapshot)} streamer grid, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}${snapshot.selectedDates.length === 7 ? "" : `, covering ${coveredDays(snapshot)}`}. ${trusted ? "Teams ranked by FHFH Game Grid Week Score, schedule only" : "Unranked preview in alphabetical order; ranking unavailable because the source or edition is not ready"}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}. Off-nights (8 or fewer NHL games): ${offNights}. ${rows.join("; ")}. NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. No odds or player projections.`;
  }
  function TeamMark({ team, logo, size }) {
    return logo ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: logo, alt: "", width: size, height: size }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { className: SocialShare_module_default.logoFallback, children: team.abbreviation });
  }
  function CardHeader({ snapshot, brandLogo, eyebrow, title, compact }) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: cx(SocialShare_module_default.gridHeader, compact && SocialShare_module_default.compactHeader), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.gridBrand, children: [
        brandLogo ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: brandLogo, alt: "FHFH", width: "135", height: "40" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "FHFH" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "FHFHOCKEY.COM" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.gridTitle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: eyebrow }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: title })
      ] }),
      snapshot.selectedDates.length === 7 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.gridWeek, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "WEEK OF" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("strong", { children: [
          dateLabel(snapshot.weekStart),
          " \u2013 ",
          dateLabel(snapshot.weekEnd)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: snapshot.weekEnd.slice(0, 4) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.gridWeek, "data-covered": snapshot.selectedDates.join(","), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          "COVERS ",
          coveredDays(snapshot).toUpperCase()
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: snapshot.selectedDates.length ? `${dateLabel(snapshot.selectedDates[0])} \u2013 ${dateLabel(snapshot.selectedDates[snapshot.selectedDates.length - 1])}` : "No days" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: snapshot.weekEnd.slice(0, 4) })
      ] })
    ] });
  }
  var countClasses = { high: "countHigh", second: "countSecond", between: "countBetween", low: "countLow", neutral: "countNeutral" };
  function Count({ value, tier }) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { className: SocialShare_module_default[countClasses[tier ?? "neutral"]], "data-count-tier": tier ?? "neutral", children: value });
  }
  var countsFor = (snapshot, trusted) => {
    const tiers = editionCountTiers(snapshot);
    return { gp: (value) => trusted ? tiers.gp.get(value) : "neutral", off: (value) => trusted ? tiers.off.get(value) : "neutral" };
  };
  var CountLegend = () => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.countLegend, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "GP \xB7 OFF" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.countHigh }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.countSecond }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.countBetween }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.countLow }),
    "most \u2192 least"
  ] });
  var SCORE_TIERS = ["tierBest", "tierGood", "tierAverage", "tierBelow", "tierWorst"];
  var tierOf = (rank, ranked) => SCORE_TIERS[Math.min(4, Math.floor((rank - 1) * 5 / Math.max(1, ranked)))];
  function MondayGrid({ snapshot, trusted, logos, brandLogo }) {
    const rows = mondayGridRows(snapshot, trusted), ranked = rows.filter((row) => row.rank !== null);
    const scoreTier = (rank) => tierOf(1 + ranked.findIndex((row) => row.score === ranked.find((item) => item.rank === rank).score), ranked.length);
    const cherryPicks = new Set(streamingNights(snapshot, trusted).map((night) => `${night.team.id}:${night.id}`));
    const counts = countsFor(snapshot, trusted);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardHeader, { snapshot, brandLogo, eyebrow: trusted ? `${editionDay(snapshot)} \xB7 ${snapshot.format === "remaining-week" ? "Rest of week" : "Streamer grid"}` : "Unranked preview", title: trusted ? "BEST SCHEDULES" : "KNOWN SCHEDULES" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.grid, children: [rows.slice(0, 16), rows.slice(16)].map((half, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.gridPanel, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: cx(SocialShare_module_default.gridRow, SocialShare_module_default.gridDays), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: trusted ? "RK" : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "TEAM" }),
          snapshot.days.map((day) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: cx(day.offNight && SocialShare_module_default.offNightDay, !day.selected && SocialShare_module_default.dimmed), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: titleDay(day.label) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: day.leagueGames })
          ] }, day.date)),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: trusted ? "SCORE" : "GP" })
        ] }),
        half.map((row) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-team": row.team.abbreviation, "data-gp-tier": counts.gp(row.remainingGames), "data-off-tier": counts.off(row.offNightGames), "data-tier": row.rank !== null ? scoreTier(row.rank) : void 0, className: cx(SocialShare_module_default.gridRow, row.rank !== null && SocialShare_module_default.tierRail, row.rank !== null && SocialShare_module_default[scoreTier(row.rank)]), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.gridRank, children: row.rank ?? "" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.gridTeam, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team: row.team, logo: logos[row.team.abbreviation], size: 40 }) }),
          row.cells.map((cell) => {
            const game = cell.games[0];
            const cherry = !!game && cherryPicks.has(`${row.team.id}:${game.id}`);
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "data-date": cell.date, "data-cherry": cherry || void 0, className: cx(SocialShare_module_default.cell, cell.offNight && SocialShare_module_default.offNightColumn, game && (game.home ? SocialShare_module_default.homeCell : SocialShare_module_default.awayCell), cherry && SocialShare_module_default.cherryPick, game && !game.counted && SocialShare_module_default.dimmed), children: game && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team: game.opponent, logo: logos[game.opponent.abbreviation], size: 32 }),
              !game.home && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.awayMark, children: "@" }),
              cell.games.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("i", { className: SocialShare_module_default.doubleMark, children: [
                "\xD7",
                cell.games.length
              ] })
            ] }) }, cell.date);
          }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.gridGames, children: [
            row.rank !== null && row.remainingGames > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridScore, children: row.score.toFixed(1) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: row.remainingGames }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.remainingGames, tier: counts.gp(row.remainingGames) }),
              " GP \xB7 ",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.offNightGames, tier: counts.off(row.offNightGames) }),
              " OFF"
            ] })
          ] })
        ] }, row.team.id))
      ] }, index)) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { className: SocialShare_module_default.gridFooter, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.legend, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendAway, children: "@" }),
            "Away"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendHome }),
            "Home"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendOffColumn }),
            "Off-night (\u22648 games)"
          ] }),
          cherryPicks.size > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendCherry }),
            "Streaming pick"
          ] }),
          trusted && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CountLegend, {}),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.tierLegend, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "SCORE" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.tierBest }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.tierGood }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.tierAverage }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.tierBelow }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.tierWorst }),
            "best \u2192 worst"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            trusted ? "Ranked by Game Grid Week Score (games, off-nights, slate density)" : "Ranking unavailable \xB7 alphabetical order",
            " \xB7 No odds or projections \xB7 NHL schedule checked ",
            timeLabel(snapshot.source.fetchedAt)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridWatermark, children: trusted ? "SCHEDULE ONLY" : "PREVIEW ONLY \xB7 REFRESH / CHECK SOURCE" })
        ] })
      ] })
    ] });
  }
  function scheduleReason(snapshot) {
    const reason = [...snapshot.reasons, ...snapshot.source.reasons][0]?.replace(/\.$/, "");
    if (snapshot.state !== "ready" || snapshot.source.state !== "ready") return `the schedule edition is not ready (${snapshot.state}${reason ? `: ${reason}` : ""})`;
    if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= Date.now()) return `the schedule edition expired at ${timeLabel(snapshot.expiresAt)}; refresh the schedule`;
    return "the schedule edition is not ready (the last refresh failed or a different week is loaded; refresh the schedule)";
  }
  function unreadyReason(snapshot, trusted) {
    if (!trusted) return scheduleReason(snapshot);
    const opponents = snapshot.opponents;
    return !opponents ? "opponent team ratings are unavailable" : `opponent team ratings are ${opponents.state}${opponents.reasons.length ? ` (${opponents.reasons[0].replace(/\.$/, "")})` : ""}`;
  }
  function matchupAltText(kind, snapshot, trusted) {
    const dayLabel = (date) => titleDay(snapshot.days.find((day) => day.date === date).label);
    const head = `FHFH ${kind === "easiest" ? "Easiest schedules" : "Streaming matchups"}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}.`;
    const tail = `NST team stats updated ${timeLabel(snapshot.opponents?.updatedAt ?? null)}. NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. Schedule and team rates only; no odds or player projections.`;
    const ready = trusted && opponentsReady(snapshot);
    if (!ready) return `${head} Unranked preview; ranking unavailable because ${unreadyReason(snapshot, trusted)}. ${tail}`;
    if (kind === "easiest") {
      const { floor, rows } = easiestSchedules(snapshot, true);
      return `${head} Ranked by Game Grid opponent defense rating, 0 to 100, lower is easier, among teams with ${floor} or more games left. ${rows.map((row) => `${row.rank}. ${row.team.name}: opponent defense ${Math.round(row.def)}, ${row.remainingGames} games (${row.games.map((game) => `${dayLabel(game.date)} ${game.home ? "vs" : "@"} ${game.opponent.abbreviation}`).join(", ")}), number ${row.weekRank} Week Score`).join("; ") || "No qualifying teams"}. ${tail}`;
    }
    const nights = streamingNights(snapshot, true);
    return `${head} Top-${STREAM_TEAM_RANK_MAX} Week Score teams against a soft defense (opponent defense ${SOFT_DEFENSE_MAX} or lower) or a perfect-storm pairing, most signals first, one night per team. ${nights.map((night) => `${dayLabel(night.date)} ${dateLabel(night.date)}: ${night.team.name} ${night.home ? "vs" : "@"} ${night.opponent.name}, tilted toward ${night.team.abbreviation}${night.evidence.flags.length ? ` (${night.evidence.flags.map((flag) => flagLabels[flag].toLowerCase()).join(", ")})` : ""}, opponent defense ${night.oppDef === null ? "unknown" : Math.round(night.oppDef)}, ${night.offNight ? "off-night" : "busy night"} (${night.leagueGames} games), number ${night.weekRank} Week Score`).join("; ") || "No soft-defense nights on the selected dates"}. ${tail}`;
  }
  function OpponentChip({ game, logos, snapshot }) {
    const tone = softness(game.oppDef);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { "data-date": game.date, className: cx(SocialShare_module_default.oppChip, tone && SocialShare_module_default[`opp_${tone}`]), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team: game.opponent, logo: logos[game.opponent.abbreviation], size: 38 }),
      !game.home && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.awayMark, children: "@" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: titleDay(snapshot.days.find((day) => day.date === game.date).label) })
    ] });
  }
  var ordinal = (value) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
  var rateText = (rate, digits, ranking) => rate ? `${rate.perGame.toFixed(digits)} (${ordinal(rate.rank)} ${ranking})` : "\u2014";
  var flagLabels = { goals: "GOAL STORM", shots: "SHOT STORM", tired: "TIRED OPPONENT" };
  function StreamTile({ night, snapshot, logos }) {
    const { goals, shots, rest, flags } = night.evidence, day = snapshot.days.find((item) => item.date === night.date);
    const restText = rest.opponentSecondNight === null ? "Back-to-back unknown (week's first day)" : rest.opponentSecondNight && !rest.teamSecondNight ? `${night.opponent.abbreviation} on the 2nd night of a back-to-back; ${night.team.abbreviation} rested` : rest.opponentSecondNight && rest.teamSecondNight ? "Both teams on a back-to-back" : rest.teamSecondNight ? `${night.team.abbreviation} on a back-to-back` : "Both teams rested";
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-team": night.team.abbreviation, "data-player": `${night.team.abbreviation}-${night.id}`, className: cx(SocialShare_module_default.streamTile, SocialShare_module_default.cherryTile), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        TeamBanner,
        {
          team: night.team,
          logo: logos[night.team.abbreviation],
          title: night.team.name,
          subtitle: `${night.home ? "vs" : "@"} ${night.opponent.name} \xB7 ${titleDay(day.label)} ${dateLabel(night.date)}`,
          right: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.streamOpponent, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team: night.opponent, logo: logos[night.opponent.abbreviation], size: 40 }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { children: [
              night.home ? "VS" : "@",
              " ",
              night.opponent.abbreviation
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.streamBody, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.streamFlags, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { children: [
            "TILT \u2192 ",
            night.team.abbreviation
          ] }),
          flags.map((flag) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { children: flagLabels[flag] }, flag)),
          night.oppDef !== null && night.oppDef <= SOFT_DEFENSE_MAX && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { children: "SOFT DEFENSE" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("i", { className: cx(!night.offNight && SocialShare_module_default.streamBusy), children: [
            night.offNight ? "OFF-NIGHT" : "BUSY NIGHT",
            " \xB7 ",
            night.leagueGames,
            " GMS"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dl", { className: SocialShare_module_default.streamEvidence, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "Goals" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dd", { className: cx(goals.storm && SocialShare_module_default.storm), children: [
            night.team.abbreviation,
            " GF/GP ",
            rateText(goals.team, 2, "most"),
            " vs ",
            night.opponent.abbreviation,
            " GA/GP ",
            rateText(goals.opponent, 2, "most")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "Shots" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dd", { className: cx(shots.storm && SocialShare_module_default.storm), children: [
            night.team.abbreviation,
            " SF/GP ",
            rateText(shots.team, 1, "most"),
            " vs ",
            night.opponent.abbreviation,
            " SA/GP ",
            rateText(shots.opponent, 1, "most")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "Rest" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { className: cx(flags.includes("tired") && SocialShare_module_default.storm), children: restText }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "Defense" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dd", { children: [
            night.opponent.abbreviation,
            " OPP DEF ",
            night.oppDef === null ? "\u2014" : Math.round(night.oppDef),
            " (lower = softer) \xB7 #",
            night.weekRank,
            " Week Score, ",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: night.remainingGames, tier: countsFor(snapshot, true).gp(night.remainingGames) }),
            " GP"
          ] })
        ] })
      ] })
    ] });
  }
  function MatchupCard({ kind, snapshot, trusted, logos, brandLogo }) {
    const ready = trusted && opponentsReady(snapshot);
    const easiest = kind === "easiest" ? easiestSchedules(snapshot, ready) : null;
    const nights = kind === "stream" ? streamingNights(snapshot, ready) : [];
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardHeader, { snapshot, brandLogo, eyebrow: ready ? `${editionDay(snapshot)} \xB7 ${kind === "easiest" ? "Softest opponents" : "Cherry-picked games"}` : "Unranked preview", title: matchupTitles[kind], compact: true }),
      !ready ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.matchupEmpty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "Ranking unavailable" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          "Opponent ratings need a ready schedule and complete, current NST team stats; ",
          unreadyReason(snapshot, trusted),
          "."
        ] })
      ] }) : easiest ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.easyList, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: cx(SocialShare_module_default.easyRow, SocialShare_module_default.easyHead), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "RK" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "TEAM" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "OPPONENTS" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "GP" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "OPP DEF" })
        ] }),
        easiest.rows.length ? easiest.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-team": row.team.abbreviation, className: cx(SocialShare_module_default.easyRow, row.rank <= 3 && SocialShare_module_default.topRow), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.easyRank, children: row.rank }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.easyTeam, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamBanner, { team: row.team, logo: logos[row.team.abbreviation], size: "sm", title: row.team.name, subtitle: `#${row.weekRank} Week Score \xB7 ${row.offNightGames} off-night` }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.easyOpps, children: row.games.map((game) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(OpponentChip, { game, logos, snapshot }, game.id)) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.easyGp, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.remainingGames, tier: countsFor(snapshot, true).gp(row.remainingGames) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.defMeter, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: Math.round(row.def) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { style: { width: `${Math.max(4, Math.round(row.def))}%` } }) })
          ] })
        ] }, row.team.id)) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: SocialShare_module_default.matchupNone, children: [
          "No teams with ",
          easiest.floor,
          "+ games on the selected dates"
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.streamGrid, children: nights.length ? nights.map((night) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(StreamTile, { night, snapshot, logos }, night.id)) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.matchupNone, children: "No soft-defense or perfect-storm nights on the selected dates" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { className: SocialShare_module_default.gridFooter, children: [
        kind === "easiest" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.legend, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendSoft }),
            "Soft defense (\u2264",
            SOFT_DEFENSE_MAX,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendAverage }),
            "Average"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendStrong }),
            "Strong (\u2265",
            100 - SOFT_DEFENSE_MAX,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendAway, children: "@" }),
            "Away"
          ] }),
          ready && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CountLegend, {})
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.legend, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("b", { children: [
              "Top-",
              STREAM_TEAM_RANK_MAX
            ] }),
            " Week Score teams"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "Storm" }),
            " = both sides in the league's top third"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "Tired" }),
            " = opponent's 2nd night of a back-to-back"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Most signals first \xB7 one night per team" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "OPP DEF = Game Grid opponent defense: 100 \u2212 percentile of opponents\u2019 xGA/GP (NST, all situations), lower = easier",
            easiest ? ` \xB7 ${easiest.floor}+ games left` : "",
            " \xB7 NST updated ",
            timeLabel(snapshot.opponents?.updatedAt ?? null),
            " \xB7 Schedule checked ",
            timeLabel(snapshot.source.fetchedAt)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridWatermark, children: ready ? "SCHEDULE + TEAM RATES" : "PREVIEW ONLY \xB7 REFRESH / CHECK SOURCE" })
        ] })
      ] })
    ] });
  }
  var parsePlayerCard = (graphic) => graphic === "specialists" ? { kind: "specialists" } : /^pickups-(50|30|20)$/.test(graphic) ? { kind: "pickups", max: Number(graphic.slice(8)) } : null;
  var groupTitles = { F: "FORWARDS", D: "DEFENSE", G: "GOALIES" };
  var bandLabel = (max) => PICKUP_BANDS.find((band) => band.max === max).label;
  var rosteredLabel = (ownership) => `${Math.floor(ownership)}%`;
  var specialistTitles = { hits: ["HITS", "HIT/GP"], shots: ["SHOTS ON GOAL", "SOG/GP"], blocks: ["BLOCKS", "BLK/GP"] };
  var dayDate = (iso) => iso ? dateLabel(iso.slice(0, 10)) : "not available";
  var pickupStat = (player) => player.group === "G" ? [player.qualityStartPct === null ? "\u2014" : `${Math.round(player.qualityStartPct * 100)}%`, `QUALITY STARTS${player.savePct === null ? "" : ` \xB7 ${player.savePct.toFixed(3).replace(/^0/, "")} SV%`}`] : [player.pointsPerGame.toFixed(2), "PTS/GP"];
  function playerUnreadyReason(snapshot, trusted) {
    if (!trusted) return scheduleReason(snapshot);
    const players = snapshot.players;
    if (players?.state === "ready" && !playersMatchSelection(snapshot)) return "player rows were prepared for different days; refresh the schedule for this selection";
    return !players ? "player ownership and season totals are not connected" : `player sources are ${players.state}${players.reasons.length ? ` (${players.reasons[0].replace(/\.$/, "")})` : ""}`;
  }
  function playerAltText(card, snapshot, trusted) {
    const head = `FHFH ${card.kind === "pickups" ? `Pickups ${bandLabel(card.max).toLowerCase()} rostered` : "Hits, shots and blocks specialists"}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}.`;
    const tail = `Yahoo rostered percent as of ${dayDate(snapshot.players?.ownershipAsOf ?? null)}. NHL.com season totals updated ${timeLabel(snapshot.players?.statsUpdatedAt ?? null)}. Season rates, not projections.`;
    if (!trusted || !playersReady(snapshot)) return `${head} Unranked preview; ranking unavailable because ${playerUnreadyReason(snapshot, trusted)}. ${tail}`;
    const describe = (player, stat) => `${player.name} (${player.team}, ${player.positions}), ${stat}, ${rosteredLabel(player.ownership)} rostered, number ${player.weekRank} Week Score team with ${player.remainingGames} games${player.widened ? ", wider pool" : ""}`;
    const pool = `Top-${PLAYER_TEAM_RANK_MAX} Week Score teams first; a list short of three fills from teams ranked ${PLAYER_TEAM_RANK_MAX + 1} and lower, marked wider pool`;
    if (card.kind === "pickups") {
      const tier = pickupTiers(snapshot, true).find((item) => item.max === card.max);
      return `${head} ${pool}. Players ranked by points per game for skaters and quality-start percent for goalies, then team schedule rank; separate bands of 30 to 49, 20 to 29 and under 20 percent rostered, each player in one band. ${["F", "D", "G"].map((group) => `${groupTitles[group]}: ${tier.groups[group].map((player) => describe(player, `${pickupStat(player)[0]} ${pickupStat(player)[1]}`)).join("; ") || "none qualify"}`).join(". ")}. ${tail}`;
    }
    const board = specialists(snapshot, true);
    return `${head} ${pool}. Skaters under 50% rostered, minimum ${MIN_SKATER_GAMES} games, by season total per game played. ${Object.keys(specialistTitles).map((category) => `${specialistTitles[category][0]}: ${board[category].map((player) => describe(player, `${player.perGame.toFixed(1)} ${specialistTitles[category][1]}`)).join("; ") || "none qualify"}`).join(". ")}. ${tail}`;
  }
  function recentLine(player, focus, recentState) {
    const recent = player.recent;
    if (!recent) return recentState === "ready" ? "No game in the last two weeks" : "Recent form unavailable";
    if (recent.kind === "goalie") {
      const pct = recent.shotsAgainst > 0 ? (recent.saves / recent.shotsAgainst).toFixed(3).replace(/^0/, "") : "\u2014";
      return `${recent.wins}-${recent.games - recent.wins} \xB7 ${pct} SV% \xB7 ${recent.goalsAgainst} GA \xB7 ${recent.qualityStarts} QS`;
    }
    const n = (value, digits = 0) => value === null ? "\u2014" : value.toFixed(digits);
    const toi = recent.toiSeconds === null ? "\u2014" : clock(recent.toiSeconds);
    if (focus === "hits") return `${n(recent.hitsPerGame, 1)} HIT/GP \xB7 ${n(recent.points)} P \xB7 ${toi} TOI`;
    if (focus === "blocks") return `${n(recent.blocksPerGame, 1)} BLK/GP \xB7 ${n(recent.points)} P \xB7 ${toi} TOI`;
    if (focus === "shots") return `${n(recent.shots)} SOG \xB7 ${n(recent.goals)} G \xB7 ${toi} TOI`;
    return `${n(recent.goals)}G ${n(recent.assists)}A ${n(recent.points)}P \xB7 ${n(recent.shots)} SOG \xB7 ${n(recent.ppPoints)} PPP \xB7 ${toi}`;
  }
  function PlayerTile({ player, stat, label, focus, snapshot, logos }) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-player": player.nhlId, "data-team": player.team, "data-widened": player.widened || void 0, className: SocialShare_module_default.playerTile, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        TeamBanner,
        {
          team: { abbreviation: player.team },
          logo: logos[player.team],
          title: player.name,
          subtitle: `${player.team} \xB7 ${player.positions}`,
          right: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.playerOwn, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: rosteredLabel(player.ownership) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "ROSTERED" })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.playerBody, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.playerStat, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: stat }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: label })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: SocialShare_module_default.playerRecent, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "L5 GP" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: recentLine(player, focus, snapshot.players?.recentState) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { className: SocialShare_module_default.playerSchedule, children: [
          "#",
          player.weekRank,
          " Week Score \xB7 ",
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: player.remainingGames, tier: countsFor(snapshot, true).gp(player.remainingGames) }),
          " GP \xB7 ",
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: player.offNightGames, tier: countsFor(snapshot, true).off(player.offNightGames) }),
          " off-night",
          player.widened && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.widened, children: "WIDER POOL" })
        ] })
      ] })
    ] });
  }
  function PlayerCard({ card, snapshot, trusted, logos, brandLogo }) {
    const ready = trusted && playersReady(snapshot);
    const columns = !ready ? [] : card.kind === "pickups" ? ["F", "D", "G"].map((group) => ({ key: group, title: groupTitles[group], players: pickupTiers(snapshot, true).find((tier) => tier.max === card.max).groups[group].map((player) => {
      const [stat, label] = pickupStat(player);
      return { player, stat, label, focus: "pickup" };
    }) })) : Object.entries(specialists(snapshot, true)).map(([category, list]) => ({ key: category, title: specialistTitles[category][0], players: list.map((player) => ({ player, stat: player.perGame.toFixed(1), label: specialistTitles[category][1], focus: category })) }));
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardHeader, { snapshot, brandLogo, eyebrow: ready ? `${editionDay(snapshot)} \xB7 ${card.kind === "pickups" ? `Pickups \xB7 top-${PLAYER_TEAM_RANK_MAX} schedules first` : "Under 50% rostered"}` : "Unranked preview", title: card.kind === "pickups" ? `${bandLabel(card.max).toUpperCase()} ROSTERED` : "CATEGORY SPECIALISTS", compact: true }),
      !ready ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.matchupEmpty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "Ranking unavailable" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          "Player cards need a ready schedule and current Yahoo ownership plus NHL.com season totals; ",
          playerUnreadyReason(snapshot, trusted),
          "."
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.playerColumns, children: columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.playerColumn, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: column.title }),
        column.players.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PlayerTile, { ...item, snapshot, logos }, item.player.nhlId)),
        column.players.length < 3 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.playerShort, children: column.players.length ? `Only ${column.players.length} qualif${column.players.length === 1 ? "ies" : "y"}` : "None qualify" })
      ] }, column.key)) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { className: SocialShare_module_default.gridFooter, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.legend, children: card.kind === "pickups" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "PTS/GP" }),
            " season points per game (min ",
            MIN_SKATER_GAMES,
            " GP)"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "QS%" }),
            " goalie quality starts (min ",
            MIN_GOALIE_STARTS,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "L5 GP" }),
            " last 5 games played"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "Wider pool" }),
            " = team ranked 11+ filling a short list"
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "Per GP" }),
            " = season total \xF7 games played"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "L5 GP" }),
            " last 5 games played"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "Skaters under 50% rostered \xB7 min ",
            MIN_SKATER_GAMES,
            " GP"
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "Top-",
            PLAYER_TEAM_RANK_MAX,
            " Week Score teams first, wider pool fills to three \xB7 ",
            card.kind === "pickups" ? "bands 30\u201349% \xB7 20\u201329% \xB7 under 20%, ranked by that rate" : "ranked by per-game rate",
            " \xB7 Season rates, not projections \xB7 Yahoo rostered % as of ",
            dayDate(snapshot.players?.ownershipAsOf ?? null),
            " \xB7 NHL.com season totals updated ",
            timeLabel(snapshot.players?.statsUpdatedAt ?? null)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridWatermark, children: ready ? "SCHEDULE + PLAYER RATES" : "PREVIEW ONLY \xB7 REFRESH / CHECK SOURCE" })
        ] })
      ] })
    ] });
  }
  var TREND_KINDS = ["hot", "deployment", "rates", "movers"];
  var trendTitles = { hot: "HOT & COLD", deployment: "DEPLOYMENT CHANGES", rates: "RATE STANDOUTS", movers: "OWNERSHIP MOVERS" };
  var rateTitles = { sogPer60: "SOG/60", icfPer60: "iCF/60", ixgPer60: "ixG/60" };
  var signed = (value, digits) => `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${Math.abs(value).toFixed(digits)}`;
  var clock = (seconds) => `${Math.floor(Math.abs(seconds) / 60)}:${String(Math.round(Math.abs(seconds) % 60)).padStart(2, "0")}`;
  var signedClock = (seconds) => `${seconds > 0 ? "+" : seconds < 0 ? "\u2212" : ""}${clock(seconds)}`;
  var lineName = (slot, group) => slot === null ? null : `${group === "defense" ? "D" : "L"}${slot}`;
  var unitName = (unit) => unit === null ? "no PP" : `PP${unit}`;
  function trendUnreadyReason(kind, snapshot, trusted) {
    const trends = snapshot.trends;
    if (!trends) return "rolling game metrics and ownership are not connected";
    if (!trusted) return scheduleReason(snapshot);
    const [state, reasons] = kind === "movers" ? [trends.moversState, trends.moversReasons] : [trends.state, trends.reasons];
    return `${kind === "movers" ? "ownership" : "rolling metrics"} are ${state}${reasons.length ? ` (${reasons[0].replace(/\.$/, "")})` : ""}`;
  }
  var trendReady = (kind, snapshot, trusted) => trusted && (kind === "movers" ? moversReady(snapshot) : trendsReady(snapshot));
  function trendColumns(kind, snapshot) {
    const meta = (pick) => `${pick.team} \xB7 ${pick.position}`;
    if (kind === "hot") {
      const { hot, cold } = hotCold(snapshot, true);
      const row2 = (pick) => ({ key: String(pick.nhlId), team: pick.team, name: pick.name, meta: meta(pick), weekGames: pick.weekGames, detail: `L${TREND_WINDOW_GAMES} ${pick.last5.toFixed(2)} \xB7 season ${pick.season.toFixed(2)} P/GP`, value: signed(pick.delta, 2), label: "P/GP", tone: pick.delta > 0 ? "up" : "down", badges: [] });
      return [{ key: "hot", title: "HOT", rows: hot.map(row2) }, { key: "cold", title: "COLD", rows: cold.map(row2) }];
    }
    if (kind === "deployment") {
      const { up, down } = deploymentChanges(snapshot, true);
      const row2 = (pick) => {
        const lineNow = lineName(pick.line.now, pick.line.group), lineBefore = lineName(pick.line.before, pick.line.group);
        const badges = [
          ...lineNow && lineBefore && lineNow !== lineBefore ? [`${pick.line.now < pick.line.before ? "\u25B2" : "\u25BC"} ${lineBefore} \u2192 ${lineNow}`] : lineNow ? [lineNow] : [],
          ...pick.ppUnit.now !== pick.ppUnit.before && pick.ppUnit.before !== void 0 ? [`${unitName(pick.ppUnit.before)} \u2192 ${unitName(pick.ppUnit.now)}`] : [unitName(pick.ppUnit.now)],
          ...pick.ppSharePct.last5 !== null && pick.ppSharePct.season !== null ? [`PP share ${Math.round(pick.ppSharePct.season)}% \u2192 ${Math.round(pick.ppSharePct.last5)}%`] : []
        ];
        return { key: String(pick.nhlId), team: pick.team, name: pick.name, meta: meta(pick), weekGames: pick.weekGames, detail: `L${TREND_WINDOW_GAMES} ${clock(pick.last5)} \xB7 season ${clock(pick.season)} TOI/GP`, value: signedClock(pick.delta), label: "TOI/GP", tone: pick.delta > 0 ? "up" : "down", badges };
      };
      return [{ key: "up", title: "ICE TIME UP", rows: up.map(row2) }, { key: "down", title: "ICE TIME DOWN", rows: down.map(row2) }];
    }
    if (kind === "rates") {
      const board = rateStandouts(snapshot, true);
      return Object.keys(rateTitles).map((metric) => ({ key: metric, title: rateTitles[metric], rows: board[metric].map((pick) => ({
        key: String(pick.nhlId),
        team: pick.team,
        name: pick.name,
        meta: meta(pick),
        weekGames: pick.weekGames,
        detail: `L${TREND_WINDOW_GAMES} ${pick.last5.toFixed(metric === "ixgPer60" ? 2 : 1)} \xB7 season ${pick.season.toFixed(metric === "ixgPer60" ? 2 : 1)} \xB7 ${Math.round((pick.toiSecondsLast5 ?? 0) / 60)} L${TREND_WINDOW_GAMES} min`,
        value: signed(pick.delta, metric === "ixgPer60" ? 2 : 1),
        label: rateTitles[metric],
        tone: "up",
        badges: []
      })) }));
    }
    const { risers, fallers } = ownershipMovers(snapshot, true);
    const row = (mover) => ({
      key: mover.key,
      team: mover.team,
      name: mover.name,
      meta: `${mover.team ?? "\u2014"} \xB7 ${mover.positions}`,
      detail: `${Math.floor(mover.previous)}% \u2192 ${Math.floor(mover.latest)}% since ${dateLabel(mover.previousDate)}`,
      value: signed(mover.delta, 0),
      label: "ROSTERED %",
      tone: mover.delta > 0 ? "up" : "down",
      badges: []
    });
    return [{ key: "risers", title: "RISING", rows: risers.map(row) }, { key: "fallers", title: "FALLING", rows: fallers.map(row) }];
  }
  function trendAltText(kind, snapshot, trusted) {
    const trends = snapshot.trends;
    const head = `FHFH Tuesday trends, ${trendTitles[kind].toLowerCase()}, week of ${yearDateLabel(snapshot.weekStart)}.`;
    const tail = kind === "movers" ? `Yahoo ownership as of ${dayDate(trends?.ownershipAsOf ?? null)}; add and drop counts are not in FHFH's sources.` : `FHFH rolling game metrics, all situations, through ${dayDate(trends?.metricsThrough ?? null)}, updated ${timeLabel(trends?.metricsUpdatedAt ?? null)}. Observed rates, not projections.`;
    if (!trendReady(kind, snapshot, trusted)) return `${head} Unranked preview; ranking unavailable because ${trendUnreadyReason(kind, snapshot, trusted)}. ${tail}`;
    return `${head} ${trendColumns(kind, snapshot).map((column) => `${column.title}: ${column.rows.map((row) => `${row.name} (${row.meta}${row.weekGames != null ? ` \xB7 ${row.weekGames} GP this week` : ""}), ${row.value} ${row.label}, ${row.detail}${row.badges.length ? `, ${row.badges.join(", ")}` : ""}`).join("; ") || "none"}`).join(". ")}. ${tail}`;
  }
  var trendLegends = {
    hot: [`Window: last ${TREND_WINDOW_GAMES} games played vs season to date`, "Points per game", `Skaters with ${MIN_TREND_SEASON_GAMES}+ season games`],
    deployment: [`TOI/GP: last ${TREND_WINDOW_GAMES} vs season`, `Line and PP unit: latest game vs ${TREND_WINDOW_GAMES} games earlier`, "PP share: season \u2192 last 5"],
    rates: [`Per-60 rates: last ${TREND_WINDOW_GAMES} vs season`, `Min ${MIN_RATE_TOI_SECONDS_LAST5 / 60} last-${TREND_WINDOW_GAMES} minutes`, "iCF = all individual shot attempts"],
    movers: ["Yahoo rostered %: latest vs on or before 5 days earlier", "Add/drop counts are not in FHFH's sources"]
  };
  function TrendCard({ kind, snapshot, trusted, logos, brandLogo }) {
    const ready = trendReady(kind, snapshot, trusted), trends = snapshot.trends;
    const columns = ready ? trendColumns(kind, snapshot) : [];
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardHeader, { snapshot, brandLogo, eyebrow: ready ? `${editionDay(snapshot)} \xB7 ${kind === "movers" ? "Rostered % movers" : "Last 5 games vs season"}` : "Unranked preview", title: trendTitles[kind], compact: true }),
      !ready ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.matchupEmpty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "Ranking unavailable" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          "Trend cards need a ready schedule and current ",
          kind === "movers" ? "Yahoo ownership" : "rolling game metrics",
          "; ",
          trendUnreadyReason(kind, snapshot, trusted),
          "."
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.trendColumns, style: { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }, children: columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.trendColumn, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: column.title }),
        column.rows.map((row) => {
          const team = snapshot.teams.find((item) => item.abbreviation === row.team) ?? { id: 0, abbreviation: row.team ?? "\u2014", name: row.team ?? "Unknown team" };
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-player": row.key, "data-team": row.team ?? "", className: cx(SocialShare_module_default.trendRow, columns.length > 2 && SocialShare_module_default.trendRowStacked), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team, logo: row.team ? logos[row.team] : null, size: 44 }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.trendWho, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: row.name }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { children: [
                row.meta,
                row.weekGames != null && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                  " \xB7 ",
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.weekGames, tier: countsFor(snapshot, true).gp(row.weekGames) }),
                  " GP this week"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: row.detail }),
              row.badges.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.trendBadges, children: row.badges.map((badge) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { children: badge }, badge)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: cx(SocialShare_module_default.trendValue, row.tone === "down" && SocialShare_module_default.trendDown), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: row.value }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: row.label })
            ] })
          ] }, row.key);
        }),
        !column.rows.length && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.playerShort, children: "None qualify" })
      ] }, column.key)) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { className: SocialShare_module_default.gridFooter, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.legend, children: trendLegends[kind].map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: item }, item)) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: kind === "movers" ? `Source: Yahoo ownership timelines \xB7 as of ${dayDate(trends?.ownershipAsOf ?? null)} \xB7 this card shows rostered-% movers, not adds or drops` : `Source: FHFH rolling game metrics (all situations) through ${dayDate(trends?.metricsThrough ?? null)} \xB7 updated ${timeLabel(trends?.metricsUpdatedAt ?? null)} \xB7 Observed rates, not projections` }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridWatermark, children: ready ? kind === "movers" ? "YAHOO OWNERSHIP" : "LAST 5 VS SEASON" : "PREVIEW ONLY \xB7 REFRESH / CHECK SOURCE" })
        ] })
      ] })
    ] });
  }
  function SocialShare({ format, asOf: asOf2 }) {
    const supported = SCHEDULE_FORMATS.includes(format);
    const [weekStart, setWeekStart] = (0, import_react3.useState)(() => calendarWeekStart(asOf2));
    const [snapshot, setSnapshot] = (0, import_react3.useState)(null);
    const [loading, setLoading] = (0, import_react3.useState)(supported);
    const [error, setError] = (0, import_react3.useState)("");
    const [assetError, setAssetError] = (0, import_react3.useState)("");
    const [assetsReady, setAssetsReady] = (0, import_react3.useState)(false);
    const [logo, setLogo] = (0, import_react3.useState)(null);
    const [graphic, setGraphic] = (0, import_react3.useState)(() => defaultGraphic(format));
    const [teamLogos, setTeamLogos] = (0, import_react3.useState)({});
    const [exporting, setExporting] = (0, import_react3.useState)(false);
    const [expired, setExpired] = (0, import_react3.useState)(false);
    const [feedback, setFeedback] = (0, import_react3.useState)("");
    const [scale, setScale] = (0, import_react3.useState)(0);
    const preview = (0, import_react3.useRef)(null);
    const frame = (0, import_react3.useRef)(null);
    const requestId = (0, import_react3.useRef)(0);
    const selectedRef = (0, import_react3.useRef)(void 0);
    const requestedLogos = (0, import_react3.useRef)(/* @__PURE__ */ new Set());
    const focusTeam = /^\d+$/.test(graphic) ? graphic : "";
    const gridCard = graphic === "grid";
    const matchupKind = graphic === "easiest" || graphic === "stream" ? graphic : null;
    const playerCard = parsePlayerCard(graphic);
    const trendKind = TREND_KINDS.includes(graphic) ? graphic : null;
    const prepareAssets = (0, import_react3.useCallback)(async () => {
      setAssetsReady(false);
      setAssetError("");
      try {
        await readyShareFonts();
        const image = new Image();
        image.src = "/pictures/logo-fhfh.svg";
        try {
          await bounded(image.decode(), "Logo unavailable", 5e3);
          setLogo(image.naturalWidth ? image.src : null);
        } catch {
          setLogo(null);
        }
        setAssetsReady(true);
      } catch (cause) {
        setAssetError(cause instanceof Error ? cause.message : "Preview assets unavailable.");
      }
    }, []);
    const load = (0, import_react3.useCallback)(async (week, dates) => {
      const id = ++requestId.current;
      setLoading(true);
      setError("");
      setFeedback("");
      const query = new URLSearchParams({ weekStart: week });
      if (dates !== void 0) query.set("selectedDates", dates.join(","));
      try {
        const response = await bounded(fetchEdition(`/api/v1/social-share/${format}?${query}`), "Schedule request timed out. Retry this edition.", 2e4);
        const next = response.body;
        if (!response.ok) throw new Error(next.error || "Schedule could not be loaded.");
        if (id !== requestId.current) return;
        setSnapshot(next);
        selectedRef.current = next.selectedDates;
        setGraphic((current2) => /^\d+$/.test(current2) ? defaultGraphic(format) : current2);
      } catch (cause) {
        if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Schedule unavailable.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, [format]);
    (0, import_react3.useEffect)(() => {
      const requests = requestId;
      if (supported) {
        void prepareAssets();
        void load(calendarWeekStart(asOf2));
      }
      return () => {
        requests.current++;
      };
    }, [asOf2, supported, load, prepareAssets]);
    (0, import_react3.useEffect)(() => {
      if (!snapshot?.expiresAt) {
        setExpired(true);
        return;
      }
      const remaining = Date.parse(snapshot.expiresAt) - Date.now();
      setExpired(remaining <= 0);
      const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
      return () => clearTimeout(timer);
    }, [snapshot]);
    (0, import_react3.useEffect)(() => {
      const missing = snapshot?.teams.map((team) => team.abbreviation).filter((abbreviation) => !requestedLogos.current.has(abbreviation)) ?? [];
      if (!missing.length) return;
      for (const abbreviation of missing) requestedLogos.current.add(abbreviation);
      void Promise.all(missing.map(async (abbreviation) => [abbreviation, await teamLogoDataUrl(abbreviation).catch(() => null)])).then((entries) => setTeamLogos((current2) => ({ ...current2, ...Object.fromEntries(entries) })));
    }, [snapshot]);
    (0, import_react3.useEffect)(() => {
      if (!frame.current) return;
      const observer = new ResizeObserver((entries) => setScale(Math.min(1, entries[0].contentRect.width / SHARE_SIZE)));
      observer.observe(frame.current);
      return () => observer.disconnect();
    }, [supported]);
    function select(dates) {
      if (!snapshot || snapshot.weekStart !== weekStart) return;
      selectedRef.current = dates;
      setSnapshot(selectScheduleDates(snapshot, dates));
      setFeedback("");
    }
    const snapshotMatchesWeek = snapshot?.weekStart === weekStart;
    const trusted = !!snapshot && snapshotMatchesWeek && snapshot.state === "ready" && snapshot.source.state === "ready" && !expired && !error;
    const displayRows = snapshot ? trusted ? snapshot.rows : [...snapshot.rows].sort((a, b) => a.team.abbreviation.localeCompare(b.team.abbreviation)) : [];
    const rows = focusTeam ? displayRows.filter((row) => String(row.team.id) === focusTeam && row.remainingGames > 0) : displayRows.filter((row) => row.remainingGames > 0).slice(0, 3);
    const itinerary = snapshot && focusTeam && rows[0] ? futureItinerary(snapshot, rows[0]) : [];
    const logosReady = !!snapshot && snapshot.teams.every((team) => team.abbreviation in teamLogos);
    const squareReady = assetsReady && logosReady;
    const squareAlt = (current2) => gridCard ? gridAltText(current2, trusted) : matchupKind ? matchupAltText(matchupKind, current2, trusted) : playerCard ? playerAltText(playerCard, current2, trusted) : trendKind ? trendAltText(trendKind, current2, trusted) : altText(current2, rows, trusted, !!focusTeam);
    const trendHasRows = !trendKind || !snapshot ? true : trendReady(trendKind, snapshot, trusted) && trendColumns(trendKind, snapshot).some((column) => column.rows.length > 0);
    const playerHasRows = !playerCard || !snapshot ? true : playerCard.kind === "pickups" ? Object.values(pickupTiers(snapshot, trusted).find((tier) => tier.max === playerCard.max)?.groups ?? {}).some((list) => list.length > 0) : Object.values(specialists(snapshot, trusted)).some((list) => list.length > 0);
    const matchupHasRows = !matchupKind || !snapshot ? true : matchupKind === "easiest" ? easiestSchedules(snapshot, trusted).rows.length > 0 : streamingNights(snapshot, trusted).length > 0;
    const canExport = trusted && squareReady && !loading && !!snapshot?.selectedDates.length && rows.some((row) => row.remainingGames > 0) && (!matchupKind || opponentsReady(snapshot) && matchupHasRows) && (!playerCard || playersReady(snapshot) && playerHasRows) && (!trendKind || trendHasRows);
    const changeWeek = (value) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      const monday = calendarWeekStart(`${value}T16:00:00Z`);
      setWeekStart(monday);
      selectedRef.current = void 0;
      void load(monday);
    };
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.page, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: SocialShare_module_default.heading, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.eyebrow, children: "FHFH / Share studio" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { children: labels[format] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: SocialShare_module_default.scope, children: !supported ? "Source qualification pending" : format === "tuesday-trends" ? "Rolling game metrics \xB7 Yahoo ownership \xB7 NHL schedule" : "Schedule only \xB7 NHL schedule source" })
      ] }),
      !supported ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: SocialShare_module_default.panel, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "Source qualification required" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "This format is blocked until current-season player data, dated ownership evidence, participation and provider rights qualify. No player rankings are available." }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { href: "/social-share/game-grid", children: "Open the schedule studio" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: SocialShare_module_default.panel, "aria-label": "Schedule settings", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.controls, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
              "Week of (Monday)",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "date", value: weekStart, onChange: (event) => changeWeek(event.target.value), disabled: loading || exporting })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: loading || exporting, onClick: () => void load(weekStart, selectedRef.current), children: "Refresh schedule" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
              "Graphic",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { value: graphic, onChange: (event) => {
                setGraphic(event.target.value);
                setFeedback("");
              }, disabled: !snapshot || loading || exporting, children: format === "tuesday-trends" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "hot", children: "Hot & cold (Tuesday default)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "deployment", children: "Deployment changes (TOI, line, PP)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "rates", children: "Rate standouts (SOG/60, iCF/60, ixG/60)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "movers", children: "Ownership movers (rostered %)" })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "grid", children: trusted ? `Best schedules grid (${editionDays[format] ?? "weekly"} default)` : "Known schedules grid (unranked)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "easiest", children: "Easiest schedules (opponent defense)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "stream", children: "Streaming matchups (soft defenses)" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "pickups-50", children: "Pickups \xB7 30\u201349% rostered" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "pickups-30", children: "Pickups \xB7 20\u201329% rostered" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "pickups-20", children: "Pickups \xB7 under 20% rostered" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "specialists", children: "Specialists \xB7 hits, shots, blocks" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "leaders", children: trusted ? "Top three schedule leaders" : "Known schedule context (unranked)" }),
                snapshot?.teams.map((team) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: team.id, children: team.name }, team.id))
              ] }) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("fieldset", { className: SocialShare_module_default.days, disabled: !snapshot || !snapshotMatchesWeek || loading || exporting, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("legend", { children: "Selected days \xB7 America/New_York" }),
            (snapshot?.days || weekDates(weekStart).map((date, index) => ({ date, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index], selected: false, leagueGames: 0, offNight: false }))).map((day) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", "aria-pressed": day.selected, onClick: () => select(snapshot.selectedDates.includes(day.date) ? snapshot.selectedDates.filter((date) => date !== day.date) : [...snapshot.selectedDates, day.date]), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: day.label.slice(0, 3) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: dateLabel(day.date) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { children: [
                day.selected ? "ON" : "OFF",
                snapshot ? ` \xB7 ${day.leagueGames} games` : ""
              ] })
            ] }, day.date)),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => select(snapshot.days.map((day) => day.date)), children: "All days" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => select([]), children: "None" })
          ] }),
          format === "remaining-week" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "Default: Monday, Tuesday and Wednesday OFF; Thursday\u2013Sunday ON. Remaining games use the edition\u2019s frozen time." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.status, "aria-live": "polite", children: [
          loading && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "Loading a new schedule edition\u2026" }),
          error && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { role: "alert", children: [
            error,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: loading || exporting, onClick: () => void load(weekStart, selectedRef.current), children: "Retry schedule" })
          ] }),
          snapshot && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
              "NHL schedule checked ",
              timeLabel(snapshot.source.fetchedAt),
              " \xB7 Provider update ",
              timeLabel(snapshot.source.updatedAt),
              " \xB7 Remaining after ",
              timeLabel(snapshot.generatedAt)
            ] }),
            !snapshotMatchesWeek && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
              "Showing the previous week, ",
              yearDateLabel(snapshot.weekStart),
              " \u2013 ",
              yearDateLabel(snapshot.weekEnd),
              ", as context. Load the requested week to select its days."
            ] }),
            snapshot.state !== "ready" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
              "Schedule ",
              snapshot.state,
              ": ",
              [...snapshot.reasons, ...snapshot.source.reasons].join(" ")
            ] }),
            expired && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "This edition has expired. Refresh the schedule to download." }),
            !snapshot.selectedDates.length ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "No days selected. Choose days to compare schedule opportunities." }) : !snapshot.rows.some((row) => row.remainingGames > 0) && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "No remaining eligible games on the selected dates." })
          ] }),
          assetError && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { role: "alert", children: [
            assetError,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: exporting, onClick: () => void prepareAssets(), children: "Retry preview preparation" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.workspace, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: SocialShare_module_default.panel, "aria-label": "Graphic preview", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.panelHeader, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "1080 \xD7 1080 preview" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: !trusted ? "Unranked context" : gridCard ? "Best schedules grid" : matchupKind === "easiest" ? "Easiest schedules" : matchupKind === "stream" ? "Streaming matchups" : playerCard ? playerCard.kind === "pickups" ? `Pickups ${bandLabel(playerCard.max).toLowerCase()}` : "Category specialists" : trendKind ? trendTitles[trendKind].toLowerCase() : focusTeam ? "Team focus" : "Schedule leaders" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.previewFrame, ref: frame, style: { height: scale * SHARE_SIZE }, children: [
              snapshot && squareReady && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { ref: preview, className: cx(SocialShare_module_default.square, SocialShare_module_default.gridSquare), style: { transform: `scale(${scale})` }, "data-testid": "share-square", role: "img", "aria-label": squareAlt(snapshot), children: gridCard ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MondayGrid, { snapshot, trusted, logos: teamLogos, brandLogo: logo }) : matchupKind ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MatchupCard, { kind: matchupKind, snapshot, trusted, logos: teamLogos, brandLogo: logo }) : playerCard ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PlayerCard, { card: playerCard, snapshot, trusted, logos: teamLogos, brandLogo: logo }) : trendKind ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TrendCard, { kind: trendKind, snapshot, trusted, logos: teamLogos, brandLogo: logo }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardHeader, { snapshot, brandLogo: logo, compact: true, eyebrow: trusted ? `${editionDay(snapshot)} \xB7 ${focusTeam ? "Team schedule" : "Schedule leaders"}` : "Unranked preview \xB7 Ranking unavailable", title: !trusted ? "KNOWN SCHEDULES" : focusTeam ? "YOUR TEAM\u2019S WEEK" : "TOP 3 SCHEDULES" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.leaders, children: [
                  rows.length ? rows.map((row) => {
                    const week = mondayGridRows(snapshot, trusted).find((item) => item.team.id === row.team.id);
                    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "data-team": row.team.abbreviation, className: SocialShare_module_default.leader, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        TeamBanner,
                        {
                          team: row.team,
                          logo: teamLogos[row.team.abbreviation],
                          title: row.team.name,
                          subtitle: `${trusted ? `#${row.rank} / ` : "UNRANKED / "}${row.team.abbreviation}`,
                          right: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: SocialShare_module_default.playerOwn, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: trusted ? scoreLabel(row) : "\u2014" }),
                            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: trusted ? "SCHEDULE SCORE" : "SCORE UNAVAILABLE" })
                          ] })
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.leaderWeek, children: week.cells.map((cell) => {
                        const game = cell.games[0], day = snapshot.days.find((item) => item.date === cell.date);
                        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { "data-date": cell.date, className: cx(SocialShare_module_default.leaderDay, cell.offNight && SocialShare_module_default.offNightColumn, !cell.selected && SocialShare_module_default.dimmed), children: [
                          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: titleDay(day.label) }),
                          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: cx(SocialShare_module_default.cell, game && (game.home ? SocialShare_module_default.homeCell : SocialShare_module_default.awayCell), game && !game.counted && SocialShare_module_default.dimmed), children: game && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamMark, { team: game.opponent, logo: teamLogos[game.opponent.abbreviation], size: 40 }),
                            !game.home && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.awayMark, children: "@" })
                          ] }) })
                        ] }, cell.date);
                      }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: SocialShare_module_default.leaderMeta, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.remainingGames, tier: countsFor(snapshot, trusted).gp(row.remainingGames) }),
                        " ",
                        trusted ? "GAMES LEFT" : "KNOWN LEFT",
                        " \xB7 ",
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Count, { value: row.offNightGames, tier: countsFor(snapshot, trusted).off(row.offNightGames) }),
                        " ",
                        trusted ? "OFF-NIGHTS" : "KNOWN OFF-NIGHTS",
                        " \xB7 ",
                        trusted ? `#${row.rank} by Week Score` : "unranked"
                      ] })
                    ] }, row.team.id);
                  }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.noGames, children: snapshot.selectedDates.length ? "No remaining games" : "No days selected" }),
                  !!itinerary.length && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.itinerary, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: "SELECTED FUTURE GAMES" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: SocialShare_module_default.itineraryGames, children: itinerary.slice(0, 8).map((game) => {
                      const home = game.homeTeam.id === rows[0].team.id;
                      const day = snapshot.days.find((item) => item.date === game.date);
                      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("strong", { children: [
                          dateLabel(game.date),
                          " \xB7 ",
                          home ? "HOME vs" : "AWAY @",
                          " ",
                          home ? game.awayTeam.abbreviation : game.homeTeam.abbreviation
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                          day.offNight ? "Off-night" : "Busy night",
                          " \xB7 ",
                          day.leagueGames,
                          " NHL games"
                        ] })
                      ] }, game.id);
                    }) }),
                    itinerary.length > 8 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
                      "+",
                      itinerary.length - 8,
                      " more selected games \xB7 Full itinerary on this page"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { className: SocialShare_module_default.gridFooter, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.legend, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendAway, children: "@" }),
                      "Away"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendHome }),
                      "Home"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: SocialShare_module_default.legendOffColumn }),
                      "Off-night (\u22648 games)"
                    ] }),
                    trusted && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CountLegend, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "SELECTED" }),
                      " ",
                      coveredDays(snapshot)
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                      "Remaining after ",
                      timeLabel(snapshot.generatedAt),
                      " \xB7 NHL schedule checked ",
                      timeLabel(snapshot.source.fetchedAt),
                      " \xB7 Score uses games, off-nights and slate density. No odds or player projections."
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: SocialShare_module_default.gridWatermark, children: !trusted ? "PREVIEW ONLY \xB7 REFRESH / CHECK SOURCE" : "SCHEDULE ONLY" })
                  ] })
                ] })
              ] }) }),
              !assetsReady ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "Preparing local fonts and branding\u2026" }) : !squareReady && snapshot && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "Preparing team logos\u2026" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.actions, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: !canExport || exporting, onClick: async () => {
                if (!preview.current || !snapshot) return;
                setExporting(true);
                setFeedback("");
                try {
                  await downloadSharePng(preview.current, snapshot, matchupKind ? { opponents: true, card: matchupKind } : playerCard ? { players: true, card: graphic } : trendKind ? { [trendKind === "movers" ? "movers" : "trends"]: true, card: trendKind } : {});
                  setFeedback("PNG downloaded: 1080 \xD7 1080.");
                } catch (cause) {
                  setFeedback(cause instanceof Error ? cause.message : "Download failed. Retry the same edition.");
                } finally {
                  setExporting(false);
                }
              }, children: exporting ? "Creating PNG\u2026" : "Download PNG" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: !snapshot || exporting, onClick: async () => {
                try {
                  await navigator.clipboard.writeText(squareAlt(snapshot));
                  setFeedback("Alt text copied.");
                } catch {
                  setFeedback("Alt text could not be copied. Select and copy the text below.");
                }
              }, children: "Copy alt text" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "status", children: feedback }),
            snapshot && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("details", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("summary", { children: "Suggested alt text" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: squareAlt(snapshot) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: SocialShare_module_default.panel, "aria-label": "Complete ranked schedule", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: SocialShare_module_default.panelHeader, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "All teams" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                snapshot?.rows.length || 0,
                " teams"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: SocialShare_module_default.explanation, children: "Schedule Score compares remaining selected games, off-night games and full-slate density. Odds and player projections are excluded. Zero-game teams have no score to publish. Matchups below include context; elapsed, live, postponed and nonregular games do not count as opportunities." }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ol", { className: SocialShare_module_default.teamList, children: displayRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("strong", { children: [
                  trusted ? `#${row.rank} ` : "",
                  row.team.name
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                  row.remainingGames,
                  " ",
                  trusted ? "left" : "known left",
                  " \xB7 ",
                  row.offNightGames,
                  " ",
                  trusted ? "off-night" : "known off-night",
                  " \xB7 ",
                  trusted ? `Score ${scoreLabel(row)}` : "Unranked; score unavailable"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: row.games.filter((game) => snapshot.selectedDates.includes(game.date)).map((game) => `${dateLabel(game.date)} ${game.homeTeam.id === row.team.id ? "vs" : "@"} ${game.homeTeam.id === row.team.id ? game.awayTeam.abbreviation : game.homeTeam.abbreviation} (${game.status}${game.gameType !== 2 ? ", nonregular" : ""}; ${timeLabel(game.startTimeUtc)})`).join(" \xB7 ") || "No games on selected dates" })
            ] }, row.team.id)) })
          ] })
        ] })
      ] })
    ] });
  }

  // tasks/artifacts/production-release-coordination-2026-10-24/social-editor-access-independent-review/browser-r1/entry.tsx
  var import_jsx_runtime6 = __toESM(require_jsx_runtime());
  var asOf = "2026-10-26T12:00:00.000Z";
  window.fixture = { ...fixture, fetchEdition, makeSnapshot(url) {
    const input = new URL(url);
    const weekStart = input.searchParams.get("weekStart") ?? "2026-10-26";
    const dates = weekDates(weekStart);
    return buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: asOf, schedule: { data: {}, games: [{ id: 2026020001, season: 20262027, gameType: 2, gameDate: dates[0], startTimeUTC: dates[0] + "T23:00:00Z", gameState: "FUT", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 10, abbrev: "TOR" } }], fetchedAt: asOf, coveredDates: dates, numGamesPerDay: dates.map((_, i) => i === 0 ? 1 : 0) } });
  } };
  function App() {
    const auth = useAuth();
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("output", { id: "fixture-auth", children: [
        auth.user?.id ?? "none",
        ":",
        auth.user?.role ?? "none"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { id: "fixture-signout", onClick: () => void auth.signOut(), children: "Fixture sign out" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SocialShareAccessGate, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SocialShare, { format: "game-grid", asOf }) })
    ] });
  }
  (0, import_client3.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(App, {}) }));
})();
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.min.js:
  (**
   * @license React
   * scheduler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.min.js:
  (**
   * @license React
   * react-dom.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.min.js:
  (**
   * @license React
   * react-jsx-runtime.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
