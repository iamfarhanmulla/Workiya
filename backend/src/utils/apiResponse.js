function ok(res, data, message = "", status = 200) {
  return res.status(status).json({
    success: true,
    data: data === undefined ? null : data,
    message,
    errorCode: null,
    timestamp: new Date().toISOString(),
  });
}

function fail(res, status, errorCode, message) {
  return res.status(status).json({
    success: false,
    data: null,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { ok, fail };
