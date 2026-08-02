var exec = require("cordova/exec");

function open(keyId, options) {
  return new Promise(function (resolve, reject) {
    exec(resolve, reject, "Razorpay", "open", [keyId, JSON.stringify(options || {})]);
  });
}

module.exports = {
  open: open,
};
