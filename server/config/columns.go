package config

import (
	"fmt"
	"strings"
)

// HasColumns returns a map indicating whether each requested column exists in the given table.
// It queries INFORMATION_SCHEMA for the current database (TABLE_SCHEMA = DATABASE()).
func HasColumns(tableName string, columnNames ...string) (map[string]bool, error) {
	exists := make(map[string]bool, len(columnNames))
	for _, c := range columnNames {
		exists[c] = false
	}
	if len(columnNames) == 0 {
		return exists, nil
	}
	if DB == nil {
		return exists, fmt.Errorf("database is not initialized")
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(columnNames)), ",")
	query := fmt.Sprintf(`
		SELECT COLUMN_NAME
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = ?
		  AND COLUMN_NAME IN (%s)
	`, placeholders)

	args := make([]interface{}, 0, len(columnNames)+1)
	args = append(args, tableName)
	for _, c := range columnNames {
		args = append(args, c)
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return exists, err
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return exists, err
		}
		exists[name] = true
	}
	if err := rows.Err(); err != nil {
		return exists, err
	}
	return exists, nil
}
