const scriptName = 'PingMe';
const ckKey = 'pingme_capture_v3';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;

// ===== Surge 适配 =====
function getData(key) {
  return $persistentStore.read(key);
}
function setData(val, key) {
  return $persistentStore.write(val, key);
}
function notify(title, sub, body) {
  $notification.post(title, sub, body);
}
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers }, (err, resp, data) => {
      if (err) reject(err);
      else resolve({ body: data });
    });
  });
}

// ===== MD5（完整保留）=====
function md5(string) {
  function md5_RotateLeft(lValue, iShiftBits) { return (lValue<<iShiftBits)|(lValue>>>(32-iShiftBits)); }
  function md5_AddUnsigned(lX,lY){
    let lX4,lY4,lX8,lY8,lResult;
    lX8=(lX&0x80000000);lY8=(lY&0x80000000);
    lX4=(lX&0x40000000);lY4=(lY&0x40000000);
    lResult=(lX&0x3FFFFFFF)+(lY&0x3FFFFFFF);
    if(lX4&lY4)return(lResult^0x80000000^lX8^lY8);
    if(lX4|lY4){
      if(lResult&0x40000000)return(lResult^0xC0000000^lX8^lY8);
      else return(lResult^0x40000000^lX8^lY8);
    } else return(lResult^lX8^lY8);
  }
  function md5_F(x,y,z){return(x&y)|((~x)&z);}
  function md5_G(x,y,z){return(x&z)|(y&(~z));}
  function md5_H(x,y,z){return(x^y^z);}
  function md5_I(x,y,z){return(y^(x|(~z)));}
  function md5_ConvertToWordArray(str){
    let lWordCount;
    const lMessageLength=str.length;
    const lNumberOfWords_temp1=lMessageLength+8;
    const lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1%64))/64;
    const lNumberOfWords=(lNumberOfWords_temp2+1)*16;
    const lWordArray=new Array(lNumberOfWords-1);
    let lBytePosition=0,lByteCount=0;
    while(lByteCount<lMessageLength){
      lWordCount=(lByteCount-(lByteCount%4))/4;
      lBytePosition=(lByteCount%4)*8;
      lWordArray[lWordCount]=(lWordArray[lWordCount]|(str.charCodeAt(lByteCount)<<lBytePosition));
      lByteCount++;
    }
    lWordCount=(lByteCount-(lByteCount%4))/4;
    lBytePosition=(lByteCount%4)*8;
    lWordArray[lWordCount]=lWordArray[lWordCount]|(0x80<<lBytePosition);
    lWordArray[lNumberOfWords-2]=lMessageLength<<3;
    lWordArray[lNumberOfWords-1]=lMessageLength>>>29;
    return lWordArray;
  }
  function md5_WordToHex(lValue){
    let WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
    for(lCount=0;lCount<=3;lCount++){
      lByte=(lValue>>>(lCount*8))&255;
      WordToHexValue_temp="0"+lByte.toString(16);
      WordToHexValue+=WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
    }
    return WordToHexValue;
  }
  let x=md5_ConvertToWordArray(string);
  let a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;
  for(let k=0;k<x.length;k+=16){
    a=md5_AddUnsigned(a,x[k]);
    b=md5_AddUnsigned(b,x[k+1]);
    c=md5_AddUnsigned(c,x[k+2]);
    d=md5_AddUnsigned(d,x[k+3]);
  }
  return (md5_WordToHex(a)+md5_WordToHex(b)+md5_WordToHex(c)+md5_WordToHex(d)).toLowerCase();
}

// ===== 时间 =====
function getUTCSignDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

// ===== 参数解析 =====
function parseRawQuery(url) {
  const query = (url.split('?')[1] || '').split('#')[0];
  const rawMap = {};
  query.split('&').forEach(pair => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    rawMap[pair.slice(0, idx)] = pair.slice(idx + 1);
  });
  return rawMap;
}

// ===== 构建签名 =====
function buildSignedParamsRaw(capture) {
  const params = {};
  Object.keys(capture.paramsRaw || {}).forEach(k => {
    if (k !== 'sign' && k !== 'signDate') params[k] = capture.paramsRaw[k];
  });
  params.signDate = getUTCSignDate();
  const signBase = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  params.sign = md5(signBase + SECRET);
  return params;
}

function buildUrl(path, capture) {
  const params = buildSignedParamsRaw(capture);
  const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return `https://api.pingmeapp.net/app/${path}?${qs}`;
}

function buildHeaders(capture) {
  const headers = capture.headers || {};
  headers['Host'] = 'api.pingmeapp.net';
  return headers;
}

// ===== 抓包 =====
if (typeof $request !== 'undefined') {
  const capture = {
    url: $request.url,
    paramsRaw: parseRawQuery($request.url),
    headers: $request.headers
  };
  setData(JSON.stringify(capture), ckKey);
  notify(scriptName, '抓参成功', '已保存');
  $done({});
}

// ===== 定时任务 =====
else {
  const raw = getData(ckKey);
  if (!raw) {
    notify(scriptName, '未抓到参数', '先打开 App');
    $done();
    return;
  }

  const capture = JSON.parse(raw);
  const headers = buildHeaders(capture);
  const msgs = [];

  function fetchApi(path) {
    return httpGet(buildUrl(path, capture), headers);
  }

  function doVideoLoop(count) {
    let i = 0;
    function next() {
      if (i >= count) return Promise.resolve();
      return new Promise(resolve => {
        setTimeout(() => {
          i++;
          fetchApi('videoBonus').then(res => {
            msgs.push(`🎬 视频${i}`);
            resolve(next());
          }).catch(() => resolve());
        }, VIDEO_DELAY);
      });
    }
    return next();
  }

  fetchApi('queryBalanceAndBonus')
    .then(() => fetchApi('checkIn'))
    .then(() => doVideoLoop(MAX_VIDEO))
    .then(() => fetchApi('queryBalanceAndBonus'))
    .then(() => {
      notify(scriptName, '🎉 任务完成', msgs.join('\n') || '完成');
      $done();
    })
    .catch(err => {
      notify(scriptName, '❌ 失败', String(err));
      $done();
    });
}