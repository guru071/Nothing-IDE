package tech.goatech.nothingide.razorpay;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

import org.json.JSONObject;

public class RazorpayCheckoutActivity extends Activity implements PaymentResultWithDataListener {

    public static final String EXTRA_KEY_ID = "keyId";
    public static final String EXTRA_OPTIONS = "options";

    public static final String EXTRA_PAYMENT_ID = "paymentId";
    public static final String EXTRA_ORDER_ID = "orderId";
    public static final String EXTRA_SIGNATURE = "signature";
    public static final String EXTRA_ERROR_CODE = "errorCode";
    public static final String EXTRA_ERROR_DESCRIPTION = "errorDescription";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String keyId = getIntent().getStringExtra(EXTRA_KEY_ID);
        String optionsJson = getIntent().getStringExtra(EXTRA_OPTIONS);

        try {
            JSONObject options = new JSONObject(optionsJson);
            Checkout checkout = new Checkout();
            checkout.setKeyID(keyId);
            checkout.open(this, options);
        } catch (Exception e) {
            Intent result = new Intent();
            result.putExtra(EXTRA_ERROR_CODE, -1);
            result.putExtra(EXTRA_ERROR_DESCRIPTION, "Invalid checkout options: " + e.getMessage());
            setResult(RESULT_CANCELED, result);
            finish();
        }
    }

    @Override
    public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        Intent result = new Intent();
        result.putExtra(EXTRA_PAYMENT_ID, razorpayPaymentId);
        result.putExtra(EXTRA_ORDER_ID, paymentData.getOrderId());
        result.putExtra(EXTRA_SIGNATURE, paymentData.getSignature());
        setResult(RESULT_OK, result);
        finish();
    }

    @Override
    public void onPaymentError(int code, String description, PaymentData paymentData) {
        Intent result = new Intent();
        result.putExtra(EXTRA_ERROR_CODE, code);
        result.putExtra(EXTRA_ERROR_DESCRIPTION, description);
        setResult(RESULT_CANCELED, result);
        finish();
    }
}
