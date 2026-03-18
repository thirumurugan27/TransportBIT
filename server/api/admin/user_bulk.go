package admin

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

type bulkCreateResult struct {
	CreatedCount int      `json:"created_count"`
	FailedCount  int      `json:"failed_count"`
	Errors       []string `json:"errors"`
}

func openUploadedCSV(c *gin.Context) ([][]string, error) {
	file, err := c.FormFile("file")
	if err != nil {
		return nil, fmt.Errorf("csv file is required")
	}

	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file")
	}
	defer src.Close()

	reader := csv.NewReader(src)
	reader.TrimLeadingSpace = true

	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("invalid csv format")
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("csv must include a header and at least one data row")
	}
	return rows, nil
}

func headerMap(header []string) map[string]int {
	m := make(map[string]int, len(header))
	for i, h := range header {
		m[strings.ToLower(strings.TrimSpace(h))] = i
	}
	return m
}

func rowCell(row []string, hm map[string]int, key string) string {
	idx, ok := hm[key]
	if !ok || idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

// POST /api/admin/users/students/bulk-create-file
func BulkCreateStudentsFile(c *gin.Context) {
	rows, err := openUploadedCSV(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hm := headerMap(rows[0])
	result := bulkCreateResult{Errors: make([]string, 0)}

	for i := 1; i < len(rows); i++ {
		line := i + 1
		row := rows[i]

		fullName := rowCell(row, hm, "full_name")
		email := strings.ToLower(rowCell(row, hm, "email"))
		phone := rowCell(row, hm, "phone")
		department := rowCell(row, hm, "department")
		year := rowCell(row, hm, "year")
		rollNumber := rowCell(row, hm, "roll_number")
		username := rowCell(row, hm, "username")
		password := rowCell(row, hm, "password")

		if fullName == "" || email == "" {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: full_name and email are required", line))
			continue
		}
		if username == "" {
			username = strings.Split(email, "@")[0]
		}
		if password == "" {
			password = "password"
		}

		var existingID int
		queryErr := config.DB.QueryRow(`SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`, email).Scan(&existingID)
		if queryErr == nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: email already exists", line))
			continue
		}
		if queryErr != sql.ErrNoRows {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to validate email", line))
			continue
		}

		_, execErr := config.DB.Exec(`
			INSERT INTO users (username, password, full_name, phone, email, department, year, roll_number, role, status)
			VALUES (?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, 'STUDENT', 'active')
		`, username, password, fullName, phone, email, department, year, rollNumber)
		if execErr != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to create student", line))
			continue
		}

		result.CreatedCount++
	}

	if len(result.Errors) > 20 {
		result.Errors = result.Errors[:20]
	}
	c.JSON(http.StatusOK, gin.H{"message": "Student bulk upload processed", "result": result})
}

// POST /api/admin/users/faculty/bulk-create-file
func BulkCreateFacultyFile(c *gin.Context) {
	rows, err := openUploadedCSV(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hm := headerMap(rows[0])
	result := bulkCreateResult{Errors: make([]string, 0)}

	for i := 1; i < len(rows); i++ {
		line := i + 1
		row := rows[i]

		fullName := rowCell(row, hm, "full_name")
		email := strings.ToLower(rowCell(row, hm, "email"))
		phone := rowCell(row, hm, "phone")
		department := rowCell(row, hm, "department")
		designation := rowCell(row, hm, "designation")
		username := rowCell(row, hm, "username")
		password := rowCell(row, hm, "password")

		if fullName == "" || email == "" {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: full_name and email are required", line))
			continue
		}
		if username == "" {
			username = strings.Split(email, "@")[0]
		}
		if password == "" {
			password = "password"
		}

		var existingID int
		queryErr := config.DB.QueryRow(`SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`, email).Scan(&existingID)
		if queryErr == nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: email already exists", line))
			continue
		}
		if queryErr != sql.ErrNoRows {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to validate email", line))
			continue
		}

		tx, txErr := config.DB.Begin()
		if txErr != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to open transaction", line))
			continue
		}

		res, userErr := tx.Exec(`
			INSERT INTO users (username, password, full_name, phone, email, role, status)
			VALUES (?, ?, ?, ?, ?, 'FACULTY', 'active')
		`, username, password, fullName, phone, email)
		if userErr != nil {
			_ = tx.Rollback()
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to create faculty user", line))
			continue
		}

		userID, idErr := res.LastInsertId()
		if idErr != nil {
			_ = tx.Rollback()
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to resolve user id", line))
			continue
		}

		_, profileErr := tx.Exec(`
			INSERT INTO faculty (user_id, department, designation)
			VALUES (?, ?, ?)
		`, userID, department, designation)
		if profileErr != nil {
			_ = tx.Rollback()
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to create faculty profile", line))
			continue
		}

		if commitErr := tx.Commit(); commitErr != nil {
			_ = tx.Rollback()
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to commit faculty row", line))
			continue
		}

		result.CreatedCount++
	}

	if len(result.Errors) > 20 {
		result.Errors = result.Errors[:20]
	}
	c.JSON(http.StatusOK, gin.H{"message": "Faculty bulk upload processed", "result": result})
}
