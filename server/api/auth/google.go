package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"transport-server/config"
	"transport-server/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)
var googleOauthConfig *oauth2.Config
const googleOAuthStateCookie = "GOOGLE_OAUTH_STATE"
func init() {
	// Initialize in a function to ensure env vars are loaded,
	// but init() runs before main().
	// Ideally should be initialized in main or lazily.
	// We'll init lazily in the handler or check here.
}
func getGoogleConfig() *oauth2.Config {
	if googleOauthConfig != nil {
		return googleOauthConfig
	}
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://localhost:8080/auth/google/callback"
	}
	googleOauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}
	return googleOauthConfig
}
func frontendURL() string {
	url := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if url == "" {
		return "http://localhost:5173"
	}
	return url
}
func oauthErrorPage(c *gin.Context, errorMsg string) {
	feURL := frontendURL()
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body>
	<script>
		(function () {
			var payload = { source: "google-oauth", success: false, error: %q };
			if (window.opener && !window.opener.closed) {
				window.opener.postMessage(payload, %q);
				window.close();
				return;
			}
			window.location.replace(%q + "/login?error=" + encodeURIComponent(payload.error));
		})();
	</script>
</body>
</html>`, errorMsg, feURL, feURL)))
}
func oauthSuccessPage(c *gin.Context) {
	feURL := frontendURL()
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><title>Logged In</title></head>
<body>
	<script>
		(function () {
			var payload = { source: "google-oauth", success: true };
			if (window.opener && !window.opener.closed) {
				window.opener.postMessage(payload, %q);
				window.close();
				return;
			}
			window.location.replace(%q);
		})();
	</script>
</body>
</html>`, feURL, feURL)))
}
func createOAuthState() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}
// 🔐 GOOGLE LOGIN - Redirect to Google
func GoogleLogin(c *gin.Context) {
	state, err := createOAuthState()
	if err != nil {
		log.Printf("google oauth state generation failed: %v", err)
		oauthErrorPage(c, "Unable to start Google login")
		return
	}
	secure := os.Getenv("ENV") == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(googleOAuthStateCookie, state, 600, "/", "", secure, true)
	config := getGoogleConfig()
	url := config.AuthCodeURL(state)
	c.Redirect(http.StatusTemporaryRedirect, url)
}
// 🔐 GOOGLE CALLBACK
func GoogleCallback(c *gin.Context) {
	state := c.Query("state")
	storedState, err := c.Cookie(googleOAuthStateCookie)
	if state == "" || err != nil || state != storedState {
		oauthErrorPage(c, "Google sign-in verification failed")
		return
	}
	secure := os.Getenv("ENV") == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(googleOAuthStateCookie, "", -1, "/", "", secure, true)
	code := c.Query("code")
	if code == "" {
		oauthErrorPage(c, "Google authorization code not found")
		return
	}
	cfg := getGoogleConfig()
	token, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("google token exchange failed: %v", err)
		oauthErrorPage(c, "Failed to verify Google account")
		return
	}
	client := cfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		log.Printf("google userinfo request failed: %v", err)
		oauthErrorPage(c, "Failed to fetch Google profile")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("google userinfo returned status %d", resp.StatusCode)
		oauthErrorPage(c, "Google profile lookup failed")
		return
	}
	var googleUser struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		log.Printf("google userinfo decode failed: %v", err)
		oauthErrorPage(c, "Unable to process Google profile")
		return
	}
	if strings.TrimSpace(googleUser.Email) == "" {
		oauthErrorPage(c, "Google account email is required")
		return
	}
	// Check if user exists by email OR username
	var userID int
	var username, role string
	var fullName, dbEmail sql.NullString
	err = config.DB.QueryRow(
		"SELECT id, COALESCE(username, ''), COALESCE(role, ''), full_name, COALESCE(email, '') FROM users WHERE email=? OR username=?",
		googleUser.Email, googleUser.Email,
	).Scan(&userID, &username, &role, &fullName, &dbEmail)
	if err == sql.ErrNoRows {
		oauthErrorPage(c, "No account is linked to this Google email")
		return
	}
	if err != nil {
		log.Printf("google auth database error: %v", err)
		oauthErrorPage(c, "Server error during sign-in")
		return
	}
	if strings.TrimSpace(role) == "" {
		log.Printf("google auth account misconfigured: missing role for user_id=%d email=%s", userID, googleUser.Email)
		oauthErrorPage(c, "Your account is not configured for sign-in")
		return
	}
	if strings.TrimSpace(username) == "" {
		// Some seeded/imported users may not have username; use email for JWT subject consistency.
		username = googleUser.Email
	}
	// Generate JWT
	jwtToken, err := utils.GenerateToken(userID, username, role)
	if err != nil {
		log.Printf("google auth token generation failed: %v", err)
		oauthErrorPage(c, "Could not create sign-in session")
		return
	}
	// Set same secure HttpOnly cookie as the regular login
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("TRANSPORT_AUTH", jwtToken, 3600*24, "/", "", secure, true)
	oauthSuccessPage(c)
}
