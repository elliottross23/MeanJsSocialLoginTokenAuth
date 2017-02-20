package elliottross.com.meanjssocialloginapitestapp;

import android.content.Intent;
import android.support.annotation.NonNull;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import com.android.volley.Request;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.VolleyLog;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;
import com.facebook.AccessToken;
import com.facebook.CallbackManager;
import com.facebook.FacebookCallback;
import com.facebook.FacebookException;
import com.facebook.FacebookSdk;
import com.facebook.GraphRequest;
import com.facebook.GraphResponse;
import com.facebook.Profile;
import com.facebook.ProfileTracker;
import com.facebook.login.LoginManager;
import com.facebook.login.LoginResult;
import com.facebook.login.widget.LoginButton;
import com.google.android.gms.auth.api.Auth;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInResult;
import com.google.android.gms.common.SignInButton;
import com.google.android.gms.common.api.GoogleApiClient;
import com.google.android.gms.common.api.ResultCallback;
import com.google.android.gms.common.api.Status;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import org.json.JSONException;
import org.json.JSONObject;

import java.lang.reflect.Type;

import elliottross.com.meanjssocialloginapitestapp.user.User;

public class SocialLoginActivity extends AppCompatActivity {
    private CallbackManager facebookCallbackManager;
    private GoogleApiClient googleApiClient;
    private ProfileTracker facebookProfileTracker;
    private static final int GOOGLE_REQUEST_CODE = 13579;
    private static final int FACEBOOK_REQUEST_CODE = 2468;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize the FacebookSDK and a facebookCallbackManager
        FacebookSdk.sdkInitialize(SocialLoginActivity.this, FACEBOOK_REQUEST_CODE);
        facebookCallbackManager = CallbackManager.Factory.create();

        // This must be placed AFTER the above two lines
        setContentView(R.layout.activity_social_login);

        setUpFacebookButtonAndCallback();
        setUpGoogleButtonAndCallback();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == GOOGLE_REQUEST_CODE) {
            GoogleSignInResult result = Auth.GoogleSignInApi.getSignInResultFromIntent(data);
            handleGoogleSigninResult(result);
        } else if(FacebookSdk.isFacebookRequestCode(FACEBOOK_REQUEST_CODE)) {
            facebookCallbackManager.onActivityResult(requestCode, resultCode, data);
        }
    }



    private void setUpFacebookButtonAndCallback() {
        LoginButton facebookLoginButton = (LoginButton) findViewById(R.id.facebook_sign_in_button);
        facebookLoginButton.setReadPermissions("public_profile", "email");
        facebookLoginButton.registerCallback(facebookCallbackManager, new FacebookCallback<LoginResult>() {
            @Override
            public void onSuccess(LoginResult loginResult) {
                final AccessToken accessToken = AccessToken.getCurrentAccessToken();
                accessToken.getExpires(); // save local

                facebookProfileTracker = new ProfileTracker() {
                    @Override
                    protected void onCurrentProfileChanged(Profile oldProfile, final Profile currentProfile) {
                        GraphRequest request = GraphRequest.newMeRequest(accessToken, new GraphRequest.GraphJSONObjectCallback() {
                            @Override
                            public void onCompleted(JSONObject object, GraphResponse response) {
                                if(object.has("email")) {
                                    try {
                                        saveUserAndGetApiToken("facebook", currentProfile.getId(), currentProfile.getName(), object.getString("email"), accessToken.getToken());
                                    } catch (JSONException e) {
                                        e.printStackTrace();
                                    }
                                }
                            }
                        });
                        Bundle parameters = new Bundle();
                        parameters.putString("fields", "email");
                        request.setParameters(parameters);
                        request.executeAsync();
                    }
                };
                facebookProfileTracker.startTracking();
            }

            @Override
            public void onCancel() {

            }

            @Override
            public void onError(FacebookException error) {
                Log.e("FacebookSignInError: ", "ERROR LOGGING INTO FACEBOOK");
            }
        });
    }


    private void setUpGoogleButtonAndCallback() {
        SignInButton googleSigninButton = (SignInButton) findViewById(R.id.google_sign_in_button);
        googleSigninButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(googleApiClient != null) {
                    googleApiClient.disconnect();
                }

                GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestEmail()
                        .requestIdToken(getString(R.string.default_web_client_id))
                        .build();
                googleApiClient = new GoogleApiClient.Builder(SocialLoginActivity.this)
                        .addApi(Auth.GOOGLE_SIGN_IN_API, gso)
                        .build();

                final Intent signInIntent = Auth.GoogleSignInApi.getSignInIntent(googleApiClient);
                startActivityForResult(signInIntent, GOOGLE_REQUEST_CODE);
            }
        });
    }

    private void handleGoogleSigninResult(GoogleSignInResult result) {
        if(result.isSuccess()) {
            GoogleSignInAccount account = result.getSignInAccount();
            // TODO Now we can save the user to our server and get an API token!
            saveUserAndGetApiToken("google", account.getId(), account.getDisplayName(), account.getEmail(), account.getIdToken());
        } else {
            Log.e("GoogleSignInError: ", "ERROR LOGGING INTO GOOGLE");
        }
    }

    private void saveUserAndGetApiToken(final String provider, String providerId, String name, String email, String providerToken) {
        if((facebookProfileTracker != null) && facebookProfileTracker.isTracking()) {
            facebookProfileTracker.stopTracking();
        }
        User user = new User();
        user.setProvider(provider);
        user.setProviderId(providerId);
        user.setDisplayName(name);
        user.setEmail(email);
        user.setToken(providerToken);

        JSONObject params = null;
        try {
            params = new JSONObject(new Gson().toJson(user));
        } catch (JSONException e) {
            e.printStackTrace();
        }

        JsonObjectRequest request = new JsonObjectRequest(Request.Method.POST, "http://10.0.1.199:3001/api/auth", params, new Response.Listener<JSONObject>() {
            @Override
            public void onResponse(JSONObject response) {
                try {
                    String userId = response.getString("_id");
                    String authToken = response.getString("authToken");
                } catch (JSONException e) {
                    e.printStackTrace();
                }

                Log.d("USER_LOG", response.toString());
            }
        }, new Response.ErrorListener() {
            @Override
            public void onErrorResponse(VolleyError error) {
                VolleyLog.d("TAG", "Error: " + error.getMessage());
                if(provider == "facebook") {
                    LoginManager.getInstance().logOut();
                } else {
                    Auth.GoogleSignInApi.signOut(googleApiClient);
                }
            }
        });
        request.setTag("SAVE_USER_AND_GET_API_TOKEN_REQUEST");
        Volley.newRequestQueue(SocialLoginActivity.this).add(request);
    }

}
