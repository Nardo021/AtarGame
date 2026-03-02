'use strict';

const { AppError } = require('./errors');

function assertString(val, name, opts = {}) {
  if (val == null || typeof val !== 'string') {
    throw new AppError('INVALID_PARAM', `${name} 必须是字符串`, 400);
  }
  const s = opts.trim !== false ? val.trim() : val;
  if (opts.min != null && s.length < opts.min) {
    throw new AppError('INVALID_PARAM', `${name} 至少 ${opts.min} 个字符`, 400);
  }
  if (opts.max != null && s.length > opts.max) {
    throw new AppError('INVALID_PARAM', `${name} 最多 ${opts.max} 个字符`, 400);
  }
  return s;
}

function assertInt(val, name, opts = {}) {
  const n = typeof val === 'string' ? parseInt(val, 10) : val;
  if (val == null || isNaN(n) || !Number.isInteger(n)) {
    throw new AppError('INVALID_PARAM', `${name} 必须是整数`, 400);
  }
  if (opts.min != null && n < opts.min) {
    throw new AppError('INVALID_PARAM', `${name} 不能小于 ${opts.min}`, 400);
  }
  if (opts.max != null && n > opts.max) {
    throw new AppError('INVALID_PARAM', `${name} 不能大于 ${opts.max}`, 400);
  }
  return n;
}

function assertDateISO(val, name) {
  const s = assertString(val, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new AppError('INVALID_PARAM', `${name} 格式应为 YYYY-MM-DD`, 400);
  }
  return s;
}

function assertMonthKey(val, name) {
  const s = assertString(val, name);
  if (!/^\d{4}-\d{2}$/.test(s)) {
    throw new AppError('INVALID_PARAM', `${name} 格式应为 YYYY-MM`, 400);
  }
  return s;
}

function assertJSON(val, name) {
  if (val == null) return null;
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  try {
    JSON.parse(str);
  } catch (_) {
    throw new AppError('INVALID_PARAM', `${name} 不是合法 JSON`, 400);
  }
  return str;
}

function assertEnum(val, name, allowed) {
  if (!allowed.includes(val)) {
    throw new AppError('INVALID_PARAM', `${name} 必须是 ${allowed.join('/')} 之一`, 400);
  }
  return val;
}

module.exports = { assertString, assertInt, assertDateISO, assertMonthKey, assertJSON, assertEnum };
