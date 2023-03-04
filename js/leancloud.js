"use strict";

/* global CONFIG */
// eslint-disable-next-line no-console

(function (window, document) {
  // 查询存储的记录
  function getRecord(Counter, target) {
    return new Promise(function (resolve, reject) {
      Counter('get', '/classes/Counter?where=' + encodeURIComponent(JSON.stringify({
        target: target
      }))).then(function (resp) {
        return resp.json();
      }).then(function (_ref) {
        var results = _ref.results,
          code = _ref.code,
          error = _ref.error;
        if (code === 401) {
          throw error;
        }
        if (results && results.length > 0) {
          var record = results[0];
          resolve(record);
        } else {
          Counter('post', '/classes/Counter', {
            target: target,
            time: 0
          }).then(function (resp) {
            return resp.json();
          }).then(function (record, error) {
            if (error) {
              throw error;
            }
            resolve(record);
          })["catch"](function (error) {
            console.error('Failed to create: ', error);
            reject(error);
          });
        }
      })["catch"](function (error) {
        console.error('LeanCloud Counter Error: ', error);
        reject(error);
      });
    });
  }

  // 发起自增请求
  function increment(Counter, incrArr) {
    return new Promise(function (resolve, reject) {
      Counter('post', '/batch', {
        'requests': incrArr
      }).then(function (res) {
        res = res.json();
        if (res.error) {
          throw res.error;
        }
        resolve(res);
      })["catch"](function (error) {
        console.error('Failed to save visitor count: ', error);
        reject(error);
      });
    });
  }

  // 构建自增请求体
  function buildIncrement(objectId) {
    return {
      'method': 'PUT',
      'path': "/1.1/classes/Counter/".concat(objectId),
      'body': {
        'time': {
          '__op': 'Increment',
          'amount': 1
        }
      }
    };
  }

  // 校验是否为有效的 Host
  function validHost() {
    if (CONFIG.web_analytics.leancloud.ignore_local) {
      var hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return false;
      }
    }
    return true;
  }

  // 校验是否为有效的 UV
  function validUV() {
    var key = 'LeanCloud_UV_Flag';
    var flag = localStorage.getItem(key);
    if (flag) {
      // 距离标记小于 24 小时则不计为 UV
      if (new Date().getTime() - parseInt(flag, 10) <= 86400000) {
        return false;
      }
    }
    localStorage.setItem(key, new Date().getTime().toString());
    return true;
  }
  function addCount(Counter) {
    var enableIncr = CONFIG.web_analytics.enable && !Fluid.ctx.dnt && validHost();
    var getterArr = [];
    var incrArr = [];

    // 请求 PV 并自增
    var pvCtn = document.querySelector('#leancloud-site-pv-container');
    if (pvCtn) {
      var pvGetter = getRecord(Counter, 'site-pv').then(function (record) {
        enableIncr && incrArr.push(buildIncrement(record.objectId));
        var ele = document.querySelector('#leancloud-site-pv');
        if (ele) {
          ele.innerText = (record.time || 0) + (enableIncr ? 1 : 0);
          pvCtn.style.display = 'inline';
        }
      });
      getterArr.push(pvGetter);
    }

    // 请求 UV 并自增
    var uvCtn = document.querySelector('#leancloud-site-uv-container');
    if (uvCtn) {
      var uvGetter = getRecord(Counter, 'site-uv').then(function (record) {
        var incrUV = validUV() && enableIncr;
        incrUV && incrArr.push(buildIncrement(record.objectId));
        var ele = document.querySelector('#leancloud-site-uv');
        if (ele) {
          ele.innerText = (record.time || 0) + (incrUV ? 1 : 0);
          uvCtn.style.display = 'inline';
        }
      });
      getterArr.push(uvGetter);
    }

    // 如果有页面浏览数节点，则请求浏览数并自增
    var viewCtn = document.querySelector('#leancloud-page-views-container');
    if (viewCtn) {
      var path = eval(CONFIG.web_analytics.leancloud.path || 'window.location.pathname');
      var target = decodeURI(path.replace(/\/*(index.html)?$/, '/'));
      var viewGetter = getRecord(Counter, target).then(function (record) {
        enableIncr && incrArr.push(buildIncrement(record.objectId));
        var ele = document.querySelector('#leancloud-page-views');
        if (ele) {
          ele.innerText = (record.time || 0) + (enableIncr ? 1 : 0);
          viewCtn.style.display = 'inline';
        }
      });
      getterArr.push(viewGetter);
    }

    // 如果启动计数自增，批量发起自增请求
    if (enableIncr) {
      Promise.all(getterArr).then(function () {
        incrArr.length > 0 && increment(Counter, incrArr);
      });
    }
  }
  var appId = CONFIG.web_analytics.leancloud.app_id;
  var appKey = CONFIG.web_analytics.leancloud.app_key;
  var serverUrl = CONFIG.web_analytics.leancloud.server_url;
  if (!appId) {
    throw new Error('LeanCloud appId is empty');
  }
  if (!appKey) {
    throw new Error('LeanCloud appKey is empty');
  }
  function fetchData(api_server) {
    var Counter = function Counter(method, url, data) {
      return fetch("".concat(api_server, "/1.1").concat(url), {
        method: method,
        headers: {
          'X-LC-Id': appId,
          'X-LC-Key': appKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    };
    addCount(Counter);
  }
  var apiServer = serverUrl || "https://".concat(appId.slice(0, 8).toLowerCase(), ".api.lncldglobal.com");
  if (apiServer) {
    fetchData(apiServer);
  } else {
    fetch('https://app-router.leancloud.cn/2/route?appId=' + appId).then(function (resp) {
      return resp.json();
    }).then(function (data) {
      if (data.api_server) {
        fetchData('https://' + data.api_server);
      }
    });
  }
})(window, document);