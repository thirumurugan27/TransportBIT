package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"transport-server/config"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOauthConfig *oauth2.Config

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
		redirectURL = "http://localhost:8000/auth/google"
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

// 🔐 GOOGLE LOGIN - Redirect to Google
func GoogleLogin(c *gin.Context) {
	config := getGoogleConfig()
	url := config.AuthCodeURL("state_random_string") // In prod, use random state and verify callback
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// 🔐 GOOGLE CALLBACK
func GoogleCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code not found"})
		return
	}

	cfg := getGoogleConfig()
	token, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token"})
		return
	}

	client := cfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}
	defer resp.Body.Close()

	var googleUser struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode user info"})
		return
	}

	// Check if user exists by email OR username
	var userID int
	var username, role, fullName, dbEmail string
	err = config.DB.QueryRow(
		"SELECT id, username, role, full_name, COALESCE(email, '') FROM users WHERE email=? OR username=?",
		googleUser.Email, googleUser.Email,
	).Scan(&userID, &username, &role, &fullName, &dbEmail)

	if err == sql.ErrNoRows {
		feFallback := os.Getenv("FRONTEND_URL")
		if feFallback == "" {
			feFallback = "http://localhost:5173"
		}
		c.Redirect(http.StatusTemporaryRedirect, feFallback+"/login?error=User%20not%20found")
		return
	}
	if err != nil {
		log.Printf("Database error: %v", err)
		feFallback := os.Getenv("FRONTEND_URL")
		if feFallback == "" {
			feFallback = "http://localhost:5173"
		}
		c.Redirect(http.StatusTemporaryRedirect, feFallback+"/login?error=Server%20error")
		return
	}

	// Generate JWT
	jwtToken, err := utils.GenerateToken(userID, username, role)
	if err != nil {
		feFallback := os.Getenv("FRONTEND_URL")
		if feFallback == "" {
			feFallback = "http://localhost:5173"
		}
		c.Redirect(http.StatusTemporaryRedirect, feFallback+"/login?error=Token%20generation%20failed")
		return
	}

	// Set same secure HttpOnly cookie as the regular login
	secure := os.Getenv("ENV") == "production"
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("TRANSPORT_AUTH", jwtToken, 3600*24, "/", "", secure, true)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(`
		<!DOCTYPE html>
		<html>
		<head><title>Logged In</title></head>
		<body>
			<script>
				window.opener.postMessage("login-success", "`+frontendURL+`");
				window.close();
			</script>
		</body>
		</html>
	`))
}
