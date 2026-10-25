function nullStr(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function formatDateForDB(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  // Check if DD-MM-YYYY
  const parts = str.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return str;
}

function cloneArgs(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

module.exports = {
  nullStr,
  formatDateForDB,
  cloneArgs
};
