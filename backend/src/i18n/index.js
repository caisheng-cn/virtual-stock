const fs = require('fs');
const path = require('path');

// Cache for loaded language objects
const locales = {};

// Supported languages
const supportedLocals = ['zh-CN', 'zh-TW', 'en'];

/**
 * Load a locale file synchronously
 * @param {string} lang - language code
 * @returns {Object} - locale object
 */
function loadLocale(lang) {
  if (!locales[lang]) {
    const filePath = path.join(__dirname, 'locales', `${lang}.json`);
    try {
      locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Failed to load locale file for ${lang}:`, e);
      // Fallback to English if loading fails
      locales[lang] = {};
    }
  }
  return locales[lang];
}

/**
 * Get translation for a key in the specified language
 * @param {string} key - dot-separated key, e.g., 'auth.login'
 * @param {string} lang - language code
 * @returns {string} - translated string or the key itself if not found
 */
function t(key, lang) {
  // Validate language
  if (!supportedLocals.includes(lang)) {
    lang = 'en'; // fallback to English
  }
  const dict = loadLocale(lang);
  // Traverse the object using dot notation
  const keys = key.split('.');
  let result = dict;
  for (const k of keys) {
    if (result === undefined || result === null) {
      return key; // return the key if not found
    }
    result = result[k];
  }
  // If result is not a string, return the key
  return typeof result === 'string' ? result : key;
}

/**
 * Middleware to attach translation function to request
 * Also determines the language from user (if logged in) or Accept-Language header
 */
function i18nMiddleware(req, res, next) {
  // Determine language
  let lang = req.header('Accept-Language');
  if (lang) {
    // Extract first language from list (e.g., "zh-CN,zh;q=0.9,en;q=0.8" -> "zh-CN")
    lang = lang.split(',')[0].split('-')[0]; // simpler: just take first part before comma
    // Normalize to our supported format
    if (lang.startsWith('zh')) {
      // Check if we have region info
      const parts = lang.split('-');
      if (parts.length === 2 && (parts[1] === 'CN' || parts[1] === 'TW')) {
        lang = parts[0] + '-' + parts[1];
      } else {
        // Default to zh-CN if only zh is provided
        lang = 'zh-CN';
      }
    } else if (lang.startsWith('en')) {
      lang = 'en';
    } else {
      lang = 'en'; // default
    }
  } else {
    lang = 'en';
  }

  // If user is logged in (via auth middleware), override with user's language preference
  // Assuming auth middleware attaches user to req.user
  if (req.user && req.user.language) {
    const userLang = req.user.language;
    if (supportedLocals.includes(userLang)) {
      lang = userLang;
    }
  }

  // Attach translation function to request
  res.t = (key) => t(key, lang);
  // Also attach language for potential use
  res.locals.lang = lang;
  next();
}

module.exports = {
  t,
  i18nMiddleware,
  loadLocale
};