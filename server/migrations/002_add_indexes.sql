DELIMITER //
DROP PROCEDURE IF EXISTS add_idx//
CREATE PROCEDURE add_idx(IN t VARCHAR(64), IN i VARCHAR(64), IN cols VARCHAR(255))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=t AND INDEX_NAME=i) THEN
    SET @s = CONCAT('CREATE INDEX `', i, '` ON `', t, '` (', cols, ')');
    PREPARE st FROM @s;
    EXECUTE st;
    DEALLOCATE PREPARE st;
  END IF;
END//
DELIMITER ;

CALL add_idx('assignments','idx_asgn_date_status','start_date, end_date, status');
CALL add_idx('assignments','idx_asgn_driver_date','driver_id, start_date, end_date');
CALL add_idx('assignments','idx_asgn_vehicle_date','vehicle_id, start_date, end_date');
CALL add_idx('attendance','idx_att_user_date','user_id, date');
CALL add_idx('leave_requests','idx_lr_driver_status','driver_id, status');
CALL add_idx('leave_requests','idx_lr_dates','start_date, end_date');
CALL add_idx('km_logs','idx_km_driver_date','driver_id, date');
CALL add_idx('km_logs','idx_km_vehicle_date','vehicle_id, date');
CALL add_idx('temporary_assignments','idx_ta_dates','start_date, end_date, status');
CALL add_idx('ev_assignments','idx_eva_dates','start_date, end_date, status');
CALL add_idx('fc_replacement_requests','idx_fcr_status','status');
CALL add_idx('vehiclerequests','idx_vr_status','status');
CALL add_idx('vehiclerequests','idx_vr_faculty','faculty_id');
CALL add_idx('student_transport','idx_st_user','user_id');
CALL add_idx('transport_requests','idx_tr_user','user_id, status');

DROP PROCEDURE IF EXISTS add_idx;
