//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	db, err := sql.Open("mysql", "root:Thiru+2007@tcp(127.0.0.1:3306)/transport_bit")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, user_id, is_incharge FROM drivers")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Drivers Table Dump:")
	fmt.Println("ID | UserID | IsIncharge")
	for rows.Next() {
		var id, userID int
		var isIncharge bool
		if err := rows.Scan(&id, &userID, &isIncharge); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%d | %d | %v\n", id, userID, isIncharge)
	}
    
    fmt.Println("\nUsers Table Dump (Role=INCHARGE or DRIVER):")
    rows2, err := db.Query("SELECT id, username, role FROM users WHERE role IN ('INCHARGE', 'DRIVER')")
    if err != nil {
        log.Fatal(err)
    }
    defer rows2.Close()
    
    fmt.Println("ID | Username | Role")
    for rows2.Next() {
        var id int
        var username, role string
        rows2.Scan(&id, &username, &role)
        fmt.Printf("%d | %s | %s\n", id, username, role)
    }
}
