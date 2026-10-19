class AppError extends Error {
  constructor(status, errorCode, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

module.exports = AppError;
