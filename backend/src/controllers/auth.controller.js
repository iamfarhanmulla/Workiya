async function login(req, res) {
  const { email } = req.body || {};

  return res.status(501).json({
    success: false,
    message: "Authentication is not connected yet.",
    user: email || null
  });
}

module.exports = {
  login
};
