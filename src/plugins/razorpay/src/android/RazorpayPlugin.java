package tech.goatech.nothingide.razorpay;

import android.app.Activity;
import android.content.Intent;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class RazorpayPlugin extends CordovaPlugin {

    private static final int CHECKOUT_REQUEST_CODE = 1219;

    private CallbackContext checkoutCallback;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("open".equals(action)) {
            open(args.getString(0), args.getString(1), callbackContext);
            return true;
        }
        return false;
    }

    private void open(String keyId, String optionsJson, CallbackContext callbackContext) {
        checkoutCallback = callbackContext;

        Intent intent = new Intent(cordova.getActivity(), RazorpayCheckoutActivity.class);
        intent.putExtra(RazorpayCheckoutActivity.EXTRA_KEY_ID, keyId);
        intent.putExtra(RazorpayCheckoutActivity.EXTRA_OPTIONS, optionsJson);

        cordova.startActivityForResult(this, intent, CHECKOUT_REQUEST_CODE);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != CHECKOUT_REQUEST_CODE || checkoutCallback == null) {
            return;
        }

        if (data == null) {
            checkoutCallback.error(buildError(-1, "Payment cancelled"));
            checkoutCallback = null;
            return;
        }

        if (resultCode == Activity.RESULT_OK) {
            try {
                JSONObject result = new JSONObject();
                result.put("paymentId", data.getStringExtra(RazorpayCheckoutActivity.EXTRA_PAYMENT_ID));
                result.put("orderId", data.getStringExtra(RazorpayCheckoutActivity.EXTRA_ORDER_ID));
                result.put("signature", data.getStringExtra(RazorpayCheckoutActivity.EXTRA_SIGNATURE));
                checkoutCallback.success(result);
            } catch (JSONException e) {
                checkoutCallback.error(buildError(-1, e.getMessage()));
            }
        } else {
            int errorCode = data.getIntExtra(RazorpayCheckoutActivity.EXTRA_ERROR_CODE, -1);
            String description = data.getStringExtra(RazorpayCheckoutActivity.EXTRA_ERROR_DESCRIPTION);
            checkoutCallback.error(buildError(errorCode, description));
        }

        checkoutCallback = null;
    }

    private JSONObject buildError(int code, String description) {
        JSONObject error = new JSONObject();
        try {
            error.put("code", code);
            error.put("description", description);
        } catch (JSONException ignored) {
        }
        return error;
    }
}
