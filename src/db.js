const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'paid_users.json');

function loadPaidUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const list = JSON.parse(data);
      return new Set(list);
    }
  } catch (error) {
    console.error('❌ Failed to load paid users database:', error.message);
  }
  return new Set();
}

function savePaidUsers(paidUsersSet) {
  try {
    const list = Array.from(paidUsersSet);
    fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.log(`💾 Saved ${list.length} paid users to database.`);
  } catch (error) {
    console.error('❌ Failed to save paid users database:', error.message);
  }
}

module.exports = {
  loadPaidUsers,
  savePaidUsers
};
