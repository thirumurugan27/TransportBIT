package utils

import (
	"database/sql"
	"time"
)

// NullStr extracts the string from a sql.NullString, returning "" if null.
func NullStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

// CloneArgs creates a shallow copy of a slice of interface{} values.
// Useful when building dynamic SQL queries with shared filter args.
func CloneArgs(args []interface{}) []interface{} {
	dup := make([]interface{}, len(args))
	copy(dup, args)
	return dup
}

// FormatDateForDB ensures a date string is in YYYY-MM-DD format.
// Accepts DD-MM-YYYY input and converts it; returns original if already valid.
func FormatDateForDB(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	// Try parsing DD-MM-YYYY
	t, err := time.Parse("02-01-2006", dateStr)
	if err == nil {
		return t.Format("2006-01-02")
	}
	// Return original if parsing fails (assume valid or let DB error)
	return dateStr
}
