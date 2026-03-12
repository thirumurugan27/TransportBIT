package admin

import (
	"log"
	"transport-server/config"
)

/* =========================
   VEHICLE STATUS SYNC
   ========================
   Single source of truth for keeping vehicles.status in sync with
   their assignment / vehicle-request lifecycle.

   Status rules
   ─────────────────────────────────────────────────────────────────
   "active"    → vehicle is currently engaged in at least one of:
                   • a regular assignment whose [start_date, end_date]
                     covers today with status 'assigned' or 'active'
                   • an active temporary assignment covering today
                   • a vehicle request with status 'assigned' or
                     'trip_started' (i.e. trip not yet completed)

   "available" → previously "active", but no live work found.

   Any other status ("maintenance", "inactive", …) is left untouched.
========================= */

// SyncVehicleStatus recalculates and persists a single vehicle's status.
// Call this (ideally via `go SyncVehicleStatus(id)`) wherever the assignment
// state of a vehicle may change.
func SyncVehicleStatus(vehicleID int) {
	var currentStatus string
	if err := config.DB.QueryRow(
		`SELECT status FROM vehicles WHERE id = ?`, vehicleID,
	).Scan(&currentStatus); err != nil {
		log.Printf("[VehicleStatus] cannot read vehicle %d: %v", vehicleID, err)
		return
	}

	// Only touch the two lifecycle statuses; leave maintenance / inactive alone.
	if currentStatus != "active" && currentStatus != "available" {
		return
	}

	if vehicleHasActiveWork(vehicleID) {
		if currentStatus != "active" {
			if _, err := config.DB.Exec(
				`UPDATE vehicles SET status = 'active' WHERE id = ?`, vehicleID,
			); err != nil {
				log.Printf("[VehicleStatus] set active failed for vehicle %d: %v", vehicleID, err)
			} else {
				log.Printf("[VehicleStatus] vehicle %d → active", vehicleID)
			}
		}
		return
	}

	if currentStatus == "active" {
		if _, err := config.DB.Exec(
			`UPDATE vehicles SET status = 'available' WHERE id = ?`, vehicleID,
		); err != nil {
			log.Printf("[VehicleStatus] set available failed for vehicle %d: %v", vehicleID, err)
		} else {
			log.Printf("[VehicleStatus] vehicle %d → available", vehicleID)
		}
	}
}

// vehicleHasActiveWork checks all three assignment sources.
func vehicleHasActiveWork(vehicleID int) bool {
	var count int

	// 1. Regular assignments covering today
	_ = config.DB.QueryRow(`
		SELECT COUNT(*) FROM assignments
		WHERE vehicle_id = ?
		  AND status IN ('assigned', 'active')
		  AND CURDATE() BETWEEN start_date AND end_date
	`, vehicleID).Scan(&count)
	if count > 0 {
		return true
	}

	// 2. Temporary assignments covering today
	_ = config.DB.QueryRow(`
		SELECT COUNT(*) FROM temporary_assignments
		WHERE vehicle_id = ?
		  AND status = 'active'
		  AND CURDATE() BETWEEN start_date AND end_date
	`, vehicleID).Scan(&count)
	if count > 0 {
		return true
	}

	// 3. Vehicle requests still in progress (assigned or trip started)
	_ = config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehiclerequests
		WHERE vehicle_id = ?
		  AND status IN ('assigned', 'trip_started')
	`, vehicleID).Scan(&count)
	return count > 0
}

// SyncAllVehicleStatuses performs a bulk reconciliation for every vehicle
// that is in the "active" or "available" lifecycle slot.
// Safe and efficient to call from a nightly cron job.
func SyncAllVehicleStatuses() {
	log.Println("[VehicleStatus] starting bulk status sync …")

	// ── Activate vehicles that have new active work ──────────────────────────
	if _, err := config.DB.Exec(`
		UPDATE vehicles v
		SET v.status = 'active'
		WHERE v.status = 'available'
		  AND (
		    EXISTS (
		      SELECT 1 FROM assignments a
		      WHERE a.vehicle_id = v.id
		        AND a.status IN ('assigned', 'active')
		        AND CURDATE() BETWEEN a.start_date AND a.end_date
		    )
		    OR EXISTS (
		      SELECT 1 FROM temporary_assignments ta
		      WHERE ta.vehicle_id = v.id
		        AND ta.status = 'active'
		        AND CURDATE() BETWEEN ta.start_date AND ta.end_date
		    )
		    OR EXISTS (
		      SELECT 1 FROM vehiclerequests vr
		      WHERE vr.vehicle_id = v.id
		        AND vr.status IN ('assigned', 'trip_started')
		    )
		  )
	`); err != nil {
		log.Printf("[VehicleStatus] bulk activate error: %v", err)
	}

	// ── Release vehicles whose work has all expired ───────────────────────────
	if _, err := config.DB.Exec(`
		UPDATE vehicles v
		SET v.status = 'available'
		WHERE v.status = 'active'
		  AND NOT EXISTS (
		    SELECT 1 FROM assignments a
		    WHERE a.vehicle_id = v.id
		      AND a.status IN ('assigned', 'active')
		      AND CURDATE() BETWEEN a.start_date AND a.end_date
		  )
		  AND NOT EXISTS (
		    SELECT 1 FROM temporary_assignments ta
		    WHERE ta.vehicle_id = v.id
		      AND ta.status = 'active'
		      AND CURDATE() BETWEEN ta.start_date AND ta.end_date
		  )
		  AND NOT EXISTS (
		    SELECT 1 FROM vehiclerequests vr
		    WHERE vr.vehicle_id = v.id
		      AND vr.status IN ('assigned', 'trip_started')
		  )
	`); err != nil {
		log.Printf("[VehicleStatus] bulk release error: %v", err)
	}

	log.Println("[VehicleStatus] bulk status sync complete")
}
