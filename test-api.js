const http = require('http');

const BASE_URL = 'http://localhost:3001/api/v1';
let authToken = '';
let adminToken = '';

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function post(path, data) {
  return httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, data);
}

function get(path, token = '') {
  return httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('虚拟炒股平台 API 测试');
  console.log('='.repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;
  let results = [];

  // 测试1: 用户注册
  console.log('[测试 U001] 用户注册-正常');
  let res = await post(`${BASE_URL}/users/register`, {
    username: 'test001',
    password: '123456',
    nickname: '测试用户',
    invite_code: 'DEFAULT2024'
  });
  if (res.code === 0) {
    console.log('  ✅ 通过 - code=0, userId=' + res.data.userId);
    passed++;
    results.push({ id: 'U001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U001', result: '失败', message: res.message });
  }
  console.log();

  // 测试2: 邀请码无效
  console.log('[测试 U002] 用户注册-邀请码无效');
  res = await post(`${BASE_URL}/users/register`, {
    username: 'test002',
    password: '123456',
    invite_code: 'WRONG'
  });
  if (res.code === -1 && res.message.includes('邀请码')) {
    console.log('  ✅ 通过 - 返回邀请码错误提示');
    passed++;
    results.push({ id: 'U002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U002', result: '失败', message: res.message });
  }
  console.log();

  // 测试3: 用户名已存在
  console.log('[测试 U003] 用户注册-用户名已存在');
  res = await post(`${BASE_URL}/users/register`, {
    username: 'testuser',
    password: '123456',
    invite_code: 'DEFAULT2024'
  });
  if (res.code === -1 && res.message.includes('已存在')) {
    console.log('  ✅ 通过 - 返回用户名已存在提示');
    passed++;
    results.push({ id: 'U003', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U003', result: '失败', message: res.message });
  }
  console.log();

  // 测试4: 正常登录
  console.log('[测试 U004] 用户登录-正常');
  res = await post(`${BASE_URL}/users/login`, {
    username: 'testuser',
    password: '123456'
  });
  if (res.code === 0 && res.data.token) {
    authToken = res.data.token;
    console.log('  ✅ 通过 - 获取token成功');
    passed++;
    results.push({ id: 'U004', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U004', result: '失败', message: res.message });
  }
  console.log();

  // 先获取用户群组信息
  console.log('[准备] 获取我的群组');
  let myGroups = await get(`${BASE_URL}/groups/my`, authToken);
  if (myGroups.code === 0 && myGroups.data && myGroups.data.length > 0) {
    console.log('  ✅ 已有群组: ' + myGroups.data.map(g => g.groupName).join(', '));
  } else {
    console.log('  ⚠️  没有群组，需要加入');
    // 尝试加入群组1
    let joinRes = await post(`${BASE_URL}/groups/join`, { group_id: 1 }, authToken);
    if (joinRes.code === 0) {
      console.log('  ✅ 已加入群组1');
    } else {
      console.log('  ⚠️  加入失败: ' + joinRes.message);
    }
  }
  console.log();

  // 测试5: 密码错误
  console.log('[测试 U005] 用户登录-密码错误');
  res = await post(`${BASE_URL}/users/login`, {
    username: 'testuser',
    password: 'wrongpass'
  });
  if (res.code === -1 && res.message.includes('密码')) {
    console.log('  ✅ 通过 - 返回密码错误提示');
    passed++;
    results.push({ id: 'U005', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U005', result: '失败', message: res.message });
  }
  console.log();

  // 测试6: 用户不存在
  console.log('[测试 U006] 用户登录-用户不存在');
  res = await post(`${BASE_URL}/users/login`, {
    username: 'nonexist',
    password: '123456'
  });
  if (res.code === -1 && res.message.includes('不存在')) {
    console.log('  ✅ 通过 - 返回用户不存在提示');
    passed++;
    results.push({ id: 'U006', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U006', result: '失败', message: res.message });
  }
  console.log();

  // 测试7: 获取用户信息
  console.log('[测试 U007] 获取用户信息');
  res = await get(`${BASE_URL}/users/info`, authToken);
  if (res.code === 0 && res.data.username) {
    console.log('  ✅ 通过 - username=' + res.data.username);
    passed++;
    results.push({ id: 'U007', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'U007', result: '失败', message: res.message });
  }
  console.log();

  // 测试8: 获取我的群组
  console.log('[测试 G001] 获取我的群组列表');
  res = await get(`${BASE_URL}/groups/my`, authToken);
  if (res.code === 0 && Array.isArray(res.data)) {
    console.log('  ✅ 通过 - 返回' + res.data.length + '个群组');
    passed++;
    results.push({ id: 'G001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'G001', result: '失败', message: res.message });
  }
  console.log();

  // 测试9: 获取资金状况
  console.log('[测试 B001] 获取资金状况');
  res = await get(`${BASE_URL}/balance?group_id=1`, authToken);
  if (res.code === 0 && res.data.cash !== undefined) {
    console.log('  ✅ 通过 - cash=' + res.data.cash);
    passed++;
    results.push({ id: 'B001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'B001', result: '失败', message: res.message });
  }
  console.log();

  // 测试10: 获取股票池
  console.log('[测试 S001] 获取股票池列表');
  res = await get(`${BASE_URL}/stocks?market_type=1`, authToken);
  if (res.code === 0 && res.data) {
    console.log('  ✅ 通过 - 返回股票池数据');
    passed++;
    results.push({ id: 'S001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'S001', result: '失败', message: res.message });
  }
  console.log();

  // 测试11: 获取A股行情
  console.log('[测试 S002] 获取A股行情 (600519)');
  res = await get(`${BASE_URL}/stocks/600519/quote?market_type=1`, authToken);
  if (res.code === 0 && res.data.price) {
    console.log('  ✅ 通过 - 当前价=' + res.data.price);
    passed++;
    results.push({ id: 'S002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'S002', result: '失败', message: res.message });
  }
  console.log();

  // 测试12: 获取港股行情
  console.log('[测试 S003] 获取港股行情 (00700)');
  res = await get(`${BASE_URL}/stocks/00700/quote?market_type=2`, authToken);
  if (res.code === 0 && res.data.price) {
    console.log('  ✅ 通过 - 当前价=' + res.data.price);
    passed++;
    results.push({ id: 'S003', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'S003', result: '失败', message: res.message });
  }
  console.log();

  // 测试13: 获取美股行情
  console.log('[测试 S004] 获取美股行情 (AAPL)');
  res = await get(`${BASE_URL}/stocks/AAPL/quote?market_type=3`, authToken);
  if (res.code === 0 && res.data.price) {
    console.log('  ✅ 通过 - 当前价=' + res.data.price);
    passed++;
    results.push({ id: 'S004', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'S004', result: '失败', message: res.message });
  }
  console.log();

  // 测试14: 买入股票
  console.log('[测试 T001] 买入股票');
  res = await post(`${BASE_URL}/trade/buy`, {
    group_id: 1,
    stock_code: '600519',
    market_type: 1,
    shares: 100
  }, authToken);
  if (res.code === 0 && res.data.tradeId) {
    console.log('  ✅ 通过 - 交易ID=' + res.data.tradeId);
    passed++;
    results.push({ id: 'T001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'T001', result: '失败', message: res.message });
  }
  console.log();

  // 测试15: 重复交易限制
  console.log('[测试 T002] 重复交易限制');
  res = await post(`${BASE_URL}/trade/buy`, {
    group_id: 1,
    stock_code: '600519',
    market_type: 1,
    shares: 100
  }, authToken);
  if (res.code === -1 && res.message.includes('今日已交易')) {
    console.log('  ✅ 通过 - 返回今日已交易提示');
    passed++;
    results.push({ id: 'T002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'T002', result: '失败', message: res.message });
  }
  console.log();

  // 测试16: 获取持仓
  console.log('[测试 P001] 获取持仓列表');
  res = await get(`${BASE_URL}/positions?group_id=1`, authToken);
  if (res.code === 0) {
    console.log('  ✅ 通过 - 返回持仓数据');
    passed++;
    results.push({ id: 'P001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'P001', result: '失败', message: res.message });
  }
  console.log();

  // 测试17: 获取交易记录
  console.log('[测试 TR001] 获取交易记录');
  res = await get(`${BASE_URL}/transactions?group_id=1`, authToken);
  if (res.code === 0) {
    console.log('  ✅ 通过 - 返回交易记录');
    passed++;
    results.push({ id: 'TR001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'TR001', result: '失败', message: res.message });
  }
  console.log();

  // 测试18: 获取收益统计
  console.log('[测试 ST001] 获取收益统计');
  res = await get(`${BASE_URL}/statistics/profit?group_id=1`, authToken);
  if (res.code === 0 && res.data.profit !== undefined) {
    console.log('  ✅ 通过 - profit=' + res.data.profit);
    passed++;
    results.push({ id: 'ST001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'ST001', result: '失败', message: res.message });
  }
  console.log();

  // 测试19: 管理员登录
  console.log('[测试 A001] 管理员登录');
  res = await post(`${BASE_URL}/admin/login`, {
    username: 'admin',
    password: 'admin123'
  });
  if (res.code === 0 && res.data.token) {
    adminToken = res.data.token;
    console.log('  ✅ 通过 - 获取管理员token');
    passed++;
    results.push({ id: 'A001', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'A001', result: '失败', message: res.message });
  }
  console.log();

  // 测试20: 获取统计数据
  console.log('[测试 A002] 获取统计数据');
  res = await get(`${BASE_URL}/admin/stats`, adminToken);
  if (res.code === 0 && res.data.userCount !== undefined) {
    console.log('  ✅ 通过 - userCount=' + res.data.userCount);
    passed++;
    results.push({ id: 'A002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'A002', result: '失败', message: res.message });
  }
  console.log();

  // 测试21: 生成邀请码
  console.log('[测试 A003] 生成邀请码');
  res = await post(`${BASE_URL}/admin/invite-codes`, {
    group_id: 1,
    use_limit: 10
  }, adminToken);
  if (res.code === 0 && res.data.code) {
    console.log('  ✅ 通过 - 邀请码=' + res.data.code);
    passed++;
    results.push({ id: 'A003', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'A003', result: '失败', message: res.message });
  }
  console.log();

  // 测试22: 群组排名
  console.log('[测试 G002] 群组排名');
  res = await get(`${BASE_URL}/groups/1/ranking`, authToken);
  if (res.code === 0 && Array.isArray(res.data)) {
    console.log('  ✅ 通过 - 返回排名数据');
    passed++;
    results.push({ id: 'G002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'G002', result: '失败', message: res.message });
  }
  console.log();

  // 测试23: 持仓统计
  console.log('[测试 ST002] 持仓统计');
  res = await get(`${BASE_URL}/statistics/positions?group_id=1`, authToken);
  if (res.code === 0) {
    console.log('  ✅ 通过 - 返回持仓统计');
    passed++;
    results.push({ id: 'ST002', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'ST002', result: '失败', message: res.message });
  }
  console.log();

  // 测试24: 交易统计
  console.log('[测试 ST003] 交易统计');
  res = await get(`${BASE_URL}/statistics/trades?group_id=1`, authToken);
  if (res.code === 0) {
    console.log('  ✅ 通过 - 返回交易统计');
    passed++;
    results.push({ id: 'ST003', result: '通过' });
  } else {
    console.log('  ❌ 失败 - code=' + res.code + ', message=' + res.message);
    failed++;
    results.push({ id: 'ST003', result: '失败', message: res.message });
  }
  console.log();

  // 输出结果汇总
  console.log('='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  console.log(`总用例数: ${passed + failed}`);
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log();
  console.log('详细结果:');
  results.forEach(r => {
    console.log(`  ${r.id}: ${r.result}${r.message ? ' (' + r.message + ')' : ''}`);
  });

  return results;
}

// 修复post函数支持token
const originalPost = post;
post = async (path, data, token = '') => {
  return httpRequest({
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }, data);
};

runTests().catch(console.error);