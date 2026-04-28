const { sequelize } = require('./src/models');

async function listUsers() {
  try {
    console.log('=== 用户及所属群组列表 ===\n');
    const [rows] = await sequelize.query(`
      SELECT 
        u.id, u.username, u.nickname, u.status, u.created_at,
        g.id AS group_id, g.name AS group_name,
        ug.joined_at
      FROM users u
      LEFT JOIN user_groups ug ON ug.user_id = u.id
      LEFT JOIN \`groups\` g ON g.id = ug.group_id
      ORDER BY u.id ASC, g.id ASC
    `);

    let currentUser = null;
    let count = 0;
    for (const row of rows) {
      if (row.id !== currentUser) {
        count++;
        console.log('用户 #' + row.id + ': ' + row.username + (row.nickname ? ' (' + row.nickname + ')' : ''));
        currentUser = row.id;
      }
      if (row.group_name) {
        console.log('  └─ 群组: ' + row.group_name + ' (ID:' + row.group_id + '), 加入时间: ' + row.joined_at);
      } else if (!row.group_name && currentUser === row.id) {
        console.log('  └─ 未加入任何群组');
      }
    }
    console.log('\n共 ' + count + ' 个用户');
    await sequelize.close();
  } catch (err) {
    console.error('查询失败:', err.message);
  }
}
listUsers();
