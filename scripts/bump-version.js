const fs = require('fs')
const path = require('path')

const VERSION_FILE = path.join(__dirname, '..', 'version.json')
const today = new Date().toISOString().split('T')[0]

const DESC = {
  major: '重大版本更新',
  minor: '功能更新',
  patch: '问题修复'
}

function bumpVersion(type) {
  const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'))
  const [major, minor, patch] = data.version.split('.').map(Number)

  let newVersion
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`
      break
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`
      break
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`
  }

  data.version = newVersion
  data.changelog.unshift({
    ver: newVersion,
    date: today,
    desc: DESC[type] || DESC.patch
  })

  fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2) + '\n')
  console.log(`Version bumped: ${data.version} <- ${type}`)
}

const type = process.argv[2] || 'patch'
bumpVersion(type)