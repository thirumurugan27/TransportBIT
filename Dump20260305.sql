-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: transport_new
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assignments`
--

DROP TABLE IF EXISTS `assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `shift_id` int NOT NULL,
  `vehicle_id` int NOT NULL,
  `driver_id` int NOT NULL,
  `assigned_date` date NOT NULL,
  `status` enum('assigned','cancelled','completed') DEFAULT 'assigned',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `original_driver_id` int DEFAULT NULL,
  `is_temporary_replacement` tinyint(1) DEFAULT '0',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assignment` (`shift_id`,`vehicle_id`,`assigned_date`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `driver_id` (`driver_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_assignment_dates` (`driver_id`,`start_date`,`end_date`),
  KEY `idx_asgn_date_status` (`start_date`,`end_date`,`status`),
  KEY `idx_asgn_driver_date` (`driver_id`,`start_date`,`end_date`),
  KEY `idx_asgn_vehicle_date` (`vehicle_id`,`start_date`,`end_date`),
  CONSTRAINT `assignments_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assignments_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assignments_ibfk_3` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assignments_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assignments`
--

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` VALUES (85,42,1,2,'2026-03-01','assigned','2026-03-05 05:28:55',1,NULL,0,'2026-03-01','2026-03-07',''),(90,41,1,2,'2026-03-01','assigned','2026-03-05 05:47:05',1,NULL,0,'2026-03-01','2026-03-07','');
/*!40000 ALTER TABLE `assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `status` enum('present','absent') NOT NULL,
  `checkin_time` datetime DEFAULT NULL,
  `checkout_time` datetime DEFAULT NULL,
  `marked_by_incharge_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `marked_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_user_date` (`user_id`,`date`),
  KEY `idx_att_user_date` (`user_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (94,95,'2026-03-05','present','2026-03-05 04:15:41',NULL,NULL,'2026-03-05 04:15:41',1),(95,67,'2026-03-05','present','2026-03-05 04:15:45',NULL,NULL,'2026-03-05 04:15:45',1),(96,69,'2026-03-05','present','2026-03-05 04:15:47',NULL,NULL,'2026-03-05 04:15:47',1),(97,96,'2026-03-05','present','2026-03-05 04:15:48',NULL,NULL,'2026-03-05 04:15:48',1),(98,71,'2026-03-05','present','2026-03-05 04:15:50',NULL,NULL,'2026-03-05 04:15:50',1),(99,72,'2026-03-05','present','2026-03-05 04:15:52',NULL,NULL,'2026-03-05 04:15:52',1),(100,74,'2026-03-05','present','2026-03-05 04:15:53',NULL,NULL,'2026-03-05 04:15:53',1),(101,75,'2026-03-05','present','2026-03-05 04:15:54',NULL,NULL,'2026-03-05 04:15:54',1),(102,76,'2026-03-05','present','2026-03-05 04:15:56',NULL,NULL,'2026-03-05 04:15:56',1);
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bus_stops`
--

DROP TABLE IF EXISTS `bus_stops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bus_stops` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `stop_name` varchar(100) NOT NULL,
  `stop_order` int NOT NULL DEFAULT '1',
  `fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `distance_km` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `arrival_time` time DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stop` (`vehicle_id`,`stop_order`),
  CONSTRAINT `bus_stops_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bus_stops`
--

LOCK TABLES `bus_stops` WRITE;
/*!40000 ALTER TABLE `bus_stops` DISABLE KEYS */;
INSERT INTO `bus_stops` VALUES (23,1,'Coimbatore Bus Stand',1,12000.00,60.00,'2026-03-05 04:09:07','06:00:00'),(24,1,'Stop A',2,11500.00,45.00,'2026-03-05 04:10:10','06:30:00'),(25,1,'Stop B',3,11000.00,30.00,'2026-03-05 04:10:48','07:30:00'),(26,2,'Bus Stand',1,12000.00,60.00,'2026-03-05 04:11:48','06:00:00'),(27,2,'Stop A',2,11000.00,40.00,'2026-03-05 04:12:15','06:30:00');
/*!40000 ALTER TABLE `bus_stops` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buses`
--

DROP TABLE IF EXISTS `buses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `start_point` varchar(100) DEFAULT NULL,
  `end_point` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `buses_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=638 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buses`
--

LOCK TABLES `buses` WRITE;
/*!40000 ALTER TABLE `buses` DISABLE KEYS */;
INSERT INTO `buses` VALUES (633,1,'Campus','Coimbatore','2026-03-05 04:06:09',NULL),(634,2,'Campus','Erode','2026-03-05 04:07:27',NULL),(636,6,'Campus','Tiruppur','2026-03-05 06:01:59',NULL),(637,7,'Campus','Gobi','2026-03-05 06:03:18',NULL);
/*!40000 ALTER TABLE `buses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_cluster_members`
--

DROP TABLE IF EXISTS `driver_cluster_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_cluster_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cluster_id` int NOT NULL,
  `driver_id` int NOT NULL,
  `valid_from` date NOT NULL,
  `valid_to` date NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cluster_id` (`cluster_id`),
  KEY `driver_id` (`driver_id`),
  CONSTRAINT `driver_cluster_members_ibfk_1` FOREIGN KEY (`cluster_id`) REFERENCES `driver_clusters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driver_cluster_members_ibfk_2` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driver_cluster_members_chk_1` CHECK ((`valid_from` <= `valid_to`))
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_cluster_members`
--

LOCK TABLES `driver_cluster_members` WRITE;
/*!40000 ALTER TABLE `driver_cluster_members` DISABLE KEYS */;
INSERT INTO `driver_cluster_members` VALUES (62,32,4,'2026-03-01','2026-03-07','2026-03-05 05:14:22'),(63,32,6,'2026-03-01','2026-03-07','2026-03-05 05:14:22'),(64,32,2,'2026-03-01','2026-03-07','2026-03-05 05:14:22');
/*!40000 ALTER TABLE `driver_cluster_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_clusters`
--

DROP TABLE IF EXISTS `driver_clusters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_clusters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `start_time` time DEFAULT '08:00:00',
  `end_time` time DEFAULT '17:00:00',
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_clusters`
--

LOCK TABLES `driver_clusters` WRITE;
/*!40000 ALTER TABLE `driver_clusters` DISABLE KEYS */;
INSERT INTO `driver_clusters` VALUES (32,'Group A','','2026-03-05 04:13:12','08:00:00','17:00:00','2026-03-01','2026-03-07');
/*!40000 ALTER TABLE `driver_clusters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drivers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `license_number` varchar(128) DEFAULT NULL,
  `license_type` varchar(50) NOT NULL DEFAULT 'LMV',
  `license_expiry` date DEFAULT NULL,
  `experience_years` int DEFAULT '0',
  `allowed_vehicle_type` enum('BUS','CAR','VAN','BOTH','OTHER') DEFAULT 'BUS',
  `home_vehicle_id` int DEFAULT NULL,
  `home_stop_id` int DEFAULT NULL,
  `is_incharge` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_of_joining` date DEFAULT NULL,
  `date_of_relieving` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `home_vehicle_id` (`home_vehicle_id`),
  KEY `home_stop_id` (`home_stop_id`),
  CONSTRAINT `drivers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `drivers_ibfk_2` FOREIGN KEY (`home_vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drivers_ibfk_3` FOREIGN KEY (`home_stop_id`) REFERENCES `stops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (2,67,'TN-DL-2019-002345','HMV','2027-12-31',8,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01','2030-01-31'),(4,69,'TN-DL-2017-004567','HEAVY','2027-12-31',12,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL),(6,71,'TN-DL-2019-006789','HEAVY','2027-12-31',7,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL),(7,72,'TN-DL-2020-007890','LIGHT','2027-12-31',5,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL),(9,74,'TN-DL-2022-009012','LIGHT','2027-12-31',3,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL),(10,75,'TN-DL-2021-010123','LIGHT','2027-12-31',4,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL),(11,76,'TN-DL-2021-010125','BOTH','2030-12-29',4,'BUS',NULL,NULL,0,'2026-01-06 11:18:48','2026-01-01',NULL),(14,95,'TN-DL-2021-202612','HMV','2030-12-31',10,'BUS',NULL,NULL,0,'2026-01-31 08:28:32','2026-01-01',NULL),(15,96,'TN-DL-2021-010126','HMV','2030-12-31',10,'CAR',NULL,NULL,0,'2026-01-31 08:29:47','2026-01-01',NULL);
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `duties`
--

DROP TABLE IF EXISTS `duties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `duties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assignment_id` int NOT NULL,
  `route_from` varchar(255) DEFAULT NULL,
  `route_to` varchar(255) DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `status` enum('planned','ongoing','completed','cancelled') DEFAULT 'planned',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `assignment_id` (`assignment_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `duties_ibfk_1` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `duties_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `duties`
--

LOCK TABLES `duties` WRITE;
/*!40000 ALTER TABLE `duties` DISABLE KEYS */;
/*!40000 ALTER TABLE `duties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dz_replacement_requests`
--

DROP TABLE IF EXISTS `dz_replacement_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dz_replacement_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `replacement_vehicle_id` int DEFAULT NULL,
  `driver_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` enum('service_due','overdue_service','danger_zone','critical_maintenance') NOT NULL,
  `status` enum('pending','approved','rejected','completed','cancelled') DEFAULT 'pending',
  `requested_by_role` enum('admin','incharge') NOT NULL,
  `requested_by_id` int NOT NULL,
  `approved_by_id` int DEFAULT NULL,
  `notes` text,
  `driver_notified` tinyint(1) DEFAULT '0',
  `remaining_km` int DEFAULT NULL,
  `current_km` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `replacement_vehicle_id` (`replacement_vehicle_id`),
  KEY `driver_id` (`driver_id`),
  KEY `idx_dzr_status` (`status`),
  CONSTRAINT `dz_replacement_requests_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `dz_replacement_requests_ibfk_2` FOREIGN KEY (`replacement_vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `dz_replacement_requests_ibfk_3` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dz_replacement_requests`
--

LOCK TABLES `dz_replacement_requests` WRITE;
/*!40000 ALTER TABLE `dz_replacement_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `dz_replacement_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ev_assignment_shifts`
--

DROP TABLE IF EXISTS `ev_assignment_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ev_assignment_shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ev_assignment_id` int NOT NULL,
  `shift_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ev_ass_shift` (`ev_assignment_id`),
  KEY `idx_ev_shift_id` (`shift_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ev_assignment_shifts`
--

LOCK TABLES `ev_assignment_shifts` WRITE;
/*!40000 ALTER TABLE `ev_assignment_shifts` DISABLE KEYS */;
INSERT INTO `ev_assignment_shifts` VALUES (1,57,44),(2,58,44),(3,58,45),(4,59,44),(5,60,44);
/*!40000 ALTER TABLE `ev_assignment_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ev_assignments`
--

DROP TABLE IF EXISTS `ev_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ev_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cluster_id` int NOT NULL,
  `shift_id` int DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('active','completed','cancelled') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `vehicle_group_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cluster_id` (`cluster_id`),
  KEY `fk_ev_assignments_vehicle_group` (`vehicle_group_id`),
  KEY `idx_eva_dates` (`start_date`,`end_date`,`status`),
  CONSTRAINT `ev_assignments_ibfk_2` FOREIGN KEY (`cluster_id`) REFERENCES `driver_clusters` (`id`),
  CONSTRAINT `fk_ev_assignments_vehicle_group` FOREIGN KEY (`vehicle_group_id`) REFERENCES `vehicle_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ev_assignments`
--

LOCK TABLES `ev_assignments` WRITE;
/*!40000 ALTER TABLE `ev_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `ev_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faculty`
--

DROP TABLE IF EXISTS `faculty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculty` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `faculty_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faculty`
--

LOCK TABLES `faculty` WRITE;
/*!40000 ALTER TABLE `faculty` DISABLE KEYS */;
INSERT INTO `faculty` VALUES (1,97,'Computer Science','Professor','2026-02-03 04:15:12','2026-02-03 04:15:12'),(2,98,'Electronics','Associate Professor','2026-02-03 04:15:12','2026-02-03 04:15:12'),(3,99,'Mechanical','Professor','2026-02-03 04:15:12','2026-02-03 04:15:12'),(4,100,'Civil','Assistant Professor','2026-02-03 04:15:12','2026-02-03 04:15:12');
/*!40000 ALTER TABLE `faculty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fc_replacement_requests`
--

DROP TABLE IF EXISTS `fc_replacement_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fc_replacement_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `replacement_vehicle_id` int DEFAULT NULL,
  `driver_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` enum('fc_renewal','insurance_renewal','permit_renewal','maintenance') NOT NULL,
  `status` enum('pending','approved','rejected','completed','cancelled') DEFAULT 'pending',
  `requested_by_role` enum('admin','incharge') NOT NULL,
  `requested_by_id` int NOT NULL,
  `approved_by_id` int DEFAULT NULL,
  `notes` text,
  `driver_notified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `replacement_vehicle_id` (`replacement_vehicle_id`),
  KEY `driver_id` (`driver_id`),
  KEY `idx_fcr_status` (`status`),
  CONSTRAINT `fc_replacement_requests_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `fc_replacement_requests_ibfk_2` FOREIGN KEY (`replacement_vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `fc_replacement_requests_ibfk_3` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fc_replacement_requests`
--

LOCK TABLES `fc_replacement_requests` WRITE;
/*!40000 ALTER TABLE `fc_replacement_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `fc_replacement_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fuel_indents`
--

DROP TABLE IF EXISTS `fuel_indents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuel_indents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `driver_id` int NOT NULL,
  `fuel_requested` decimal(10,2) NOT NULL DEFAULT '0.00',
  `fuel_filled` decimal(10,2) DEFAULT NULL,
  `odometer_reading` int NOT NULL DEFAULT '0',
  `status` enum('pending','completed','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fuel_vehicle` (`vehicle_id`),
  KEY `idx_fuel_driver` (`driver_id`),
  KEY `idx_fuel_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fuel_indents`
--

LOCK TABLES `fuel_indents` WRITE;
/*!40000 ALTER TABLE `fuel_indents` DISABLE KEYS */;
/*!40000 ALTER TABLE `fuel_indents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `km_logs`
--

DROP TABLE IF EXISTS `km_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `km_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driver_id` int NOT NULL,
  `date` date NOT NULL,
  `start_km` decimal(10,2) DEFAULT '0.00',
  `end_km` decimal(10,2) DEFAULT '0.00',
  `total_km` decimal(10,2) DEFAULT '0.00',
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `vehicle_id` int DEFAULT NULL,
  `assignment_id` int DEFAULT NULL,
  `recorded_by_user_id` int DEFAULT NULL,
  `fuel_consumed` float DEFAULT NULL,
  `status` varchar(20) DEFAULT 'approved',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `shift_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_driver_date` (`driver_id`,`date`),
  KEY `idx_km_logs_driver_date` (`driver_id`,`date`),
  KEY `idx_km_logs_vehicle_date` (`vehicle_id`,`date`),
  KEY `idx_km_logs_assignment` (`assignment_id`),
  KEY `fk_km_logs_recorded_by_user` (`recorded_by_user_id`),
  KEY `idx_km_driver_date` (`driver_id`,`date`),
  KEY `idx_km_vehicle_date` (`vehicle_id`,`date`),
  KEY `idx_km_status` (`status`),
  CONSTRAINT `fk_km_logs_recorded_by_user` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `km_logs_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `km_logs`
--

LOCK TABLES `km_logs` WRITE;
/*!40000 ALTER TABLE `km_logs` DISABLE KEYS */;
INSERT INTO `km_logs` VALUES (1,2,'2026-02-17',100.00,180.00,80.00,'','2026-02-17 04:20:07',1,57,67,NULL,'approved',NULL,NULL,NULL),(2,4,'2026-02-26',10.00,53.00,43.00,'','2026-02-26 06:07:52',4,NULL,1,3,'approved',1,'2026-02-26 11:37:52',NULL),(3,2,'2026-02-27',0.00,30.00,30.00,'','2026-02-27 04:05:09',1,61,1,2.4,'approved',1,'2026-02-27 09:35:09',NULL);
/*!40000 ALTER TABLE `km_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driver_id` int NOT NULL,
  `leave_type` varchar(50) NOT NULL DEFAULT 'Leave',
  `start_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_date` date NOT NULL,
  `end_time` time DEFAULT NULL,
  `reason` text,
  `status` varchar(50) DEFAULT 'pending',
  `incharge_id` int DEFAULT NULL,
  `incharge_approved_at` timestamp NULL DEFAULT NULL,
  `incharge_remarks` text,
  `admin_id` int DEFAULT NULL,
  `admin_approved_at` timestamp NULL DEFAULT NULL,
  `admin_remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `driver_id` (`driver_id`),
  KEY `idx_lr_driver_status` (`driver_id`,`status`),
  KEY `idx_lr_dates` (`start_date`,`end_date`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_role` enum('ADMIN','DRIVER','STUDENT','FACULTY','INCHARGE') NOT NULL,
  `recipient_id` int NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `title` varchar(255) NOT NULL,
  `message` text,
  `reference_id` int DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_recipient` (`recipient_role`,`recipient_id`),
  KEY `idx_notif_read` (`is_read`),
  KEY `idx_notif_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'ADMIN',0,'fc_completion','FC Replacement Auto-Completed','Temporary assignment for driver Senthil Velan has ended. Vehicle EV-01 is back from fc_renewal and is now available. Driver has been reassigned to their original vehicle.',NULL,0,'2026-01-31 03:24:31'),(2,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #4 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-09 09:41:05'),(3,'ADMIN',0,'trip_started','Trip Started','Trip for request #4 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-09 09:42:07'),(4,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #4 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-09 09:43:16'),(5,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #5 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-09 10:40:02'),(6,'ADMIN',0,'trip_started','Trip Started','Trip for request #5 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-09 10:54:55'),(7,'ADMIN',0,'trip_completed','Trip Completed','Vehicle request #5 has been manually marked as completed by admin.',NULL,0,'2026-02-09 11:01:44'),(8,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #9 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-10 06:07:31'),(9,'ADMIN',0,'trip_started','Trip Started','Trip for request #9 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-10 06:08:52'),(10,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #9 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-10 06:10:49'),(11,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #10 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-10 10:39:58'),(12,'ADMIN',0,'trip_started','Trip Started','Trip for request #10 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-10 10:42:08'),(13,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #10 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-10 10:42:27'),(14,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #12 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-11 03:39:12'),(15,'ADMIN',0,'trip_started','Trip Started','Trip for request #12 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-11 05:16:41'),(16,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #12 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-11 05:17:08'),(17,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #15 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-12 06:39:24'),(18,'ADMIN',0,'trip_started','Trip Started','Trip for request #15 by faculty1 has started.',NULL,0,'2026-02-12 06:41:00'),(19,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #16 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-12 08:32:07'),(32,'DRIVER',6,'vehicle_change','Vehicle Change Notification','Your vehicle EV-VAN-01 is going for fc_renewal from 2026-01-13 to 2026-01-31. You have been assigned EV-VAN-02 for 19 days during this period. Your original vehicle will be automatically reassigned after this period.',1,0,'2026-01-12 06:15:39'),(33,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:32'),(34,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:33'),(35,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:33'),(36,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:35'),(37,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,1,'2026-01-30 08:40:37'),(38,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:38'),(39,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,1,'2026-01-30 08:40:40'),(40,'DRIVER',6,'vehicle_change','Vehicle Reassignment - Back to Original','Your original vehicle EV-01 is back from fc_renewal. The temporary assignment has ended and you are now reassigned to your original vehicle.',1,0,'2026-01-31 03:24:31'),(41,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,1,'2026-01-31 04:53:52'),(42,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:53:55'),(43,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-01-31.',NULL,1,'2026-01-31 04:53:57'),(44,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-01-31.',NULL,0,'2026-01-31 04:54:02'),(45,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:04'),(46,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:05'),(47,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:07'),(48,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 to 2026-01-31. Status: Pending approval.',5,1,'2026-01-31 04:55:56'),(49,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-02-01 to 2026-01-01. Status: Pending approval.',6,1,'2026-01-31 04:57:25'),(50,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a SICK leave request on your behalf from 2026-02-01 to 2026-02-01. Status: Pending approval.',7,1,'2026-01-31 04:58:27'),(51,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 16:20 to 2026-02-02 20:45. Status: Pending approval.',8,1,'2026-01-31 05:39:25'),(52,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ok',8,1,'2026-01-31 05:39:57'),(53,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ok',9,1,'2026-01-31 06:12:09'),(54,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 16:40 to 2026-02-02 08:45. Status: Pending approval.',10,1,'2026-01-31 06:21:40'),(55,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ',10,1,'2026-01-31 06:21:52'),(56,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 2026-01-31 to 2026-02-02 has been approved by incharge Head Incharge. Waiting for admin approval.',11,1,'2026-01-31 06:33:06'),(57,'DRIVER',2,'leave','Leave Request Rejected by Admin','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by admin. Reason: ',11,1,'2026-01-31 06:39:14'),(58,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',12,1,'2026-01-31 09:10:41'),(59,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 2026-02-04 to 2026-02-04 has been fully approved. Attendance will be automatically marked as absent.',12,1,'2026-01-31 09:39:41'),(60,'DRIVER',10,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',13,0,'2026-02-02 03:12:04'),(61,'DRIVER',10,'leave','Leave Request Rejected by Admin','Your leave request from 2026-02-04 to 2026-02-04 has been rejected by admin. Reason: ',13,0,'2026-02-02 03:20:16'),(62,'DRIVER',14,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',14,0,'2026-02-02 03:22:15'),(63,'DRIVER',14,'leave','Leave Request Approved','Your leave request from 2026-02-04 to 2026-02-04 has been fully approved. Attendance will be automatically marked as absent.',14,0,'2026-02-02 03:29:22'),(64,'DRIVER',14,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,0,'2026-02-02 06:19:25'),(65,'DRIVER',15,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,0,'2026-02-02 06:19:27'),(66,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,1,'2026-02-02 06:19:28'),(67,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 07-02-2026 to 07-02-2026 has been approved by incharge Head Incharge. Waiting for admin approval.',15,1,'2026-02-04 05:31:00'),(68,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 07-02-2026 to 07-02-2026 has been fully approved. Attendance will be automatically marked as absent.',15,1,'2026-02-04 05:31:11'),(69,'DRIVER',15,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:04'),(70,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,1,'2026-02-04 09:42:05'),(71,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:07'),(72,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:09'),(73,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:10'),(74,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:12'),(75,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:13'),(95,'STUDENT',99,'car_booking_cancelled','Your Car Booking Has Been Cancelled','Your car booking for 2026-02-03T00:00:00Z (Vehicle: CAR-5S-01) has been cancelled by the transport admin. Reason: Cancelled by admin',3,0,'2026-02-03 06:49:06'),(96,'STUDENT',97,'warning','Vehicle Request Cancelled','Your vehicle request #16 for \"Faculty visit to industry\" has been cancelled by admin. Reason: Cancelled by admin',16,0,'2026-02-12 08:38:30'),(97,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #17 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-14 09:38:57'),(98,'ADMIN',0,'trip_started','Trip Started','Trip for request #17 by faculty1 has started.',NULL,0,'2026-02-14 09:40:19'),(99,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #17 by faculty1 has been completed.',NULL,0,'2026-02-14 09:40:51'),(100,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Window Glass Broken (Severity: medium)',1,0,'2026-02-16 09:05:19'),(101,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Window Glass Broken (Severity: medium)',2,0,'2026-02-16 09:11:13'),(102,'DRIVER',2,'vehicle_change','Vehicle Change - Danger Zone Service','Your vehicle EV-01 is going for service (Danger Zone - service_due) from 2026-02-19 to 2026-02-25. You have been assigned CAR-5S-02 for 7 days during this period. Your original vehicle will be automatically reassigned after this period.',1,1,'2026-02-17 08:57:17'),(103,'DRIVER',2,'leave','Leave Request - Admin Approved','Your leave request from 11-02-2026 to 11-02-2026 has been approved by admin. Waiting for incharge approval.',16,1,'2026-02-18 10:28:04'),(104,'DRIVER',4,'leave','Leave Applied by Admin','Admin has applied Permission leave on your behalf from 2026-02-18 to 2026-02-19. Reason: ',17,1,'2026-02-18 10:28:28'),(105,'DRIVER',4,'leave','Leave Request Approved','Your leave request from 18-02-2026 to 19-02-2026 has been fully approved by both incharge Head Incharge and admin.',17,1,'2026-02-18 10:29:00'),(106,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 11-02-2026 to 11-02-2026 has been fully approved by both incharge Head Incharge and admin.',16,1,'2026-02-18 10:29:02'),(107,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle CAR-5S-02: Front Wheel Dent (Severity: low)',11,0,'2026-02-24 05:27:37'),(108,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #18 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-24 08:25:16'),(109,'ADMIN',0,'trip_started','Trip Started','Trip for request #18 by faculty1 has started.',NULL,0,'2026-02-24 08:26:09'),(110,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #18 by faculty1 has been completed.',NULL,0,'2026-02-24 08:26:25'),(111,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Brake Noise (Severity: medium)',14,0,'2026-02-25 04:11:17'),(112,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for service_repair from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',2,1,'2026-02-25 06:00:06'),(113,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for service_repair from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',3,1,'2026-02-25 06:21:35'),(114,'DRIVER',0,'vehicle_change','Vehicle Replacement','Your vehicle TN36JC2026 is going for service_repair from 2026-02-26 to 2026-02-28. You have been assigned TRUCK for 3 days. Your original vehicle will be reassigned after this period.',4,0,'2026-02-25 08:37:28'),(115,'DRIVER',0,'info','Replacement Cancelled','The replacement for TN36JC2026 has been cancelled by admin.',NULL,0,'2026-02-25 09:46:03'),(116,'DRIVER',4,'info','Replacement Cancelled','The replacement for TN-36-GN-7894 has been cancelled by admin.',NULL,1,'2026-02-25 09:46:10'),(117,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for insurance_renewal from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',5,1,'2026-02-25 09:47:25'),(118,'DRIVER',4,'vehicle_change','Vehicle Back - Replacement Ended','Your original vehicle TN-36-GN-7894 is back from insurance_renewal. The temporary replacement has ended.',5,0,'2026-02-26 03:30:56'),(119,'ADMIN',0,'replacement_completed','Replacement Auto-Completed','Vehicle TN-36-GN-7894 auto-completed from insurance_renewal. Driver Driver2 reassigned.',NULL,0,'2026-02-26 03:30:56'),(120,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 28-02-2026 to 28-02-2026 has been approved. Attendance will be automatically marked as absent.',18,1,'2026-02-26 06:24:56'),(121,'DRIVER',0,'info','Replacement Cancelled','The replacement for TN 36 G 1589 has been cancelled by admin.',NULL,0,'2026-03-05 05:42:36'),(122,'DRIVER',0,'vehicle_change','Vehicle Replacement','Your vehicle TN 36 G 1589 is going for insurance_renewal from 2026-03-01 to 2026-03-07. You have been assigned TN 36 G 1234 for 7 days. Your original vehicle will be reassigned after this period.',8,0,'2026-03-05 05:51:10'),(123,'DRIVER',0,'info','Replacement Cancelled','The replacement for TN 36 G 1589 has been cancelled by admin.',NULL,0,'2026-03-05 05:51:14'),(124,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #20 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-05 08:31:31');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `odometer_readings`
--

DROP TABLE IF EXISTS `odometer_readings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `odometer_readings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `driver_id` int NOT NULL,
  `from_reading` int NOT NULL DEFAULT '0',
  `to_reading` int NOT NULL DEFAULT '0',
  `fuel_used` decimal(10,2) DEFAULT '0.00',
  `recorded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_odo_vehicle` (`vehicle_id`),
  KEY `idx_odo_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `odometer_readings`
--

LOCK TABLES `odometer_readings` WRITE;
/*!40000 ALTER TABLE `odometer_readings` DISABLE KEYS */;
/*!40000 ALTER TABLE `odometer_readings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parts_purchased`
--

DROP TABLE IF EXISTS `parts_purchased`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parts_purchased` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int DEFAULT NULL,
  `service_record_id` int DEFAULT NULL,
  `part_name` varchar(255) NOT NULL,
  `vendor_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `warranty_months` int DEFAULT '0',
  `invoice_number` varchar(100) DEFAULT NULL,
  `purchased_date` date DEFAULT NULL,
  `status` enum('pending','received','returned','cancelled') NOT NULL DEFAULT 'pending',
  `ordered_date` date DEFAULT NULL,
  `received_date` date DEFAULT NULL,
  `returned_date` date DEFAULT NULL,
  `cancelled_date` date DEFAULT NULL,
  `added_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `category` varchar(30) NOT NULL DEFAULT 'repair_service',
  `vehicle_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `added_by` (`added_by`),
  KEY `idx_parts_purchased_service` (`service_record_id`),
  KEY `idx_parts_vendor` (`vendor_id`),
  KEY `idx_parts_order` (`purchase_order_id`),
  CONSTRAINT `fk_parts_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_parts_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `parts_purchased_ibfk_1` FOREIGN KEY (`service_record_id`) REFERENCES `service_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `parts_purchased_ibfk_2` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parts_purchased`
--

LOCK TABLES `parts_purchased` WRITE;
/*!40000 ALTER TABLE `parts_purchased` DISABLE KEYS */;
/*!40000 ALTER TABLE `parts_purchased` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_invoices`
--

DROP TABLE IF EXISTS `purchase_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_type` enum('pdf','image') NOT NULL DEFAULT 'pdf',
  `file_size` bigint NOT NULL DEFAULT '0',
  `file_path` varchar(500) NOT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_order_invoice` (`purchase_order_id`),
  KEY `fk_pi_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_pi_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pi_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_invoices`
--

LOCK TABLES `purchase_invoices` WRITE;
/*!40000 ALTER TABLE `purchase_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_record_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT '',
  `purchased_date` date DEFAULT NULL,
  `status` enum('pending','received','returned','cancelled') DEFAULT 'pending',
  `ordered_date` date DEFAULT NULL,
  `received_date` date DEFAULT NULL,
  `returned_date` date DEFAULT NULL,
  `cancelled_date` date DEFAULT NULL,
  `notes` text,
  `added_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` varchar(30) NOT NULL DEFAULT 'repair_service',
  `vehicle_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_po_service` (`service_record_id`),
  KEY `idx_po_vendor` (`vendor_id`),
  KEY `fk_po_added_by` (`added_by`),
  CONSTRAINT `fk_po_added_by` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_po_service` FOREIGN KEY (`service_record_id`) REFERENCES `service_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_po_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_records`
--

DROP TABLE IF EXISTS `service_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `service_type_id` int DEFAULT NULL,
  `reported_by` int DEFAULT NULL,
  `assigned_to_admin` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `severity` enum('low','medium','high','critical') DEFAULT 'medium',
  `status` enum('reported','approved','in_progress','completed','rejected','cancelled') DEFAULT 'reported',
  `odometer_at_service` int DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `workshop_name` varchar(255) DEFAULT NULL,
  `mechanic_name` varchar(255) DEFAULT NULL,
  `mechanic_contact` varchar(20) DEFAULT NULL,
  `labor_cost` decimal(10,2) DEFAULT '0.00',
  `parts_cost` decimal(10,2) DEFAULT '0.00',
  `total_cost` decimal(10,2) DEFAULT '0.00',
  `next_service_date` date DEFAULT NULL,
  `next_service_km` int DEFAULT NULL,
  `admin_remarks` text,
  `rejection_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  KEY `assigned_to_admin` (`assigned_to_admin`),
  KEY `idx_service_records_vehicle` (`vehicle_id`),
  KEY `idx_service_records_status` (`status`),
  KEY `idx_service_records_reported_by` (`reported_by`),
  KEY `idx_service_records_scheduled` (`scheduled_date`),
  CONSTRAINT `service_records_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_records_ibfk_2` FOREIGN KEY (`service_type_id`) REFERENCES `service_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_records_ibfk_3` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_records_ibfk_4` FOREIGN KEY (`assigned_to_admin`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_records`
--

LOCK TABLES `service_records` WRITE;
/*!40000 ALTER TABLE `service_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_types`
--

DROP TABLE IF EXISTS `service_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `estimated_duration_hours` decimal(5,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_types`
--

LOCK TABLES `service_types` WRITE;
/*!40000 ALTER TABLE `service_types` DISABLE KEYS */;
INSERT INTO `service_types` VALUES (1,'Oil Change','Engine oil and oil filter replacement',1.00,1,'2026-02-16 09:04:21'),(2,'Brake Service','Brake pad and disc inspection/replacement',2.00,1,'2026-02-16 09:04:21'),(3,'Tyre Replacement','Tyre change, alignment and balancing',1.50,1,'2026-02-16 09:04:21'),(4,'Engine Overhaul','Major engine repair and rebuilding',24.00,1,'2026-02-16 09:04:21'),(5,'Battery Service','Battery testing, charging or replacement',0.50,1,'2026-02-16 09:04:21'),(6,'AC Repair','Air conditioning system repair and gas refill',3.00,1,'2026-02-16 09:04:21'),(7,'Body Repair','Dent removal, painting and body work',8.00,1,'2026-02-16 09:04:21'),(8,'General Maintenance','Routine inspection and preventive maintenance',2.00,1,'2026-02-16 09:04:21'),(9,'Electrical Repair','Wiring, lights, starter and alternator repair',3.00,1,'2026-02-16 09:04:21'),(10,'Accident Repair','Post-accident repair and restoration',48.00,1,'2026-02-16 09:04:21'),(11,'Clutch Service','Clutch plate and pressure plate replacement',4.00,1,'2026-02-16 09:04:21'),(12,'Suspension Repair','Shock absorber and suspension system repair',3.00,1,'2026-02-16 09:04:21');
/*!40000 ALTER TABLE `service_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_slots`
--

DROP TABLE IF EXISTS `shift_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_slots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `shift_id` int NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `slot_order` int NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `shift_id` (`shift_id`),
  KEY `idx_shift_slots_created_by` (`created_by`),
  CONSTRAINT `fk_shift_slots_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `shift_slots_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_slots`
--

LOCK TABLES `shift_slots` WRITE;
/*!40000 ALTER TABLE `shift_slots` DISABLE KEYS */;
INSERT INTO `shift_slots` VALUES (38,43,'06:00:00','10:00:00',1,1),(39,44,'10:01:00','14:00:00',1,1),(40,45,'14:00:00','18:30:00',1,1),(41,41,'05:40:00','08:30:00',1,1),(42,42,'16:40:00','19:30:00',1,1);
/*!40000 ALTER TABLE `shift_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `description` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `shifts_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (41,'Morning Bus Shift','05:40:00','08:30:00','',1,'2026-03-05 04:16:52'),(42,'Evening Bus Shift','16:40:00','19:30:00','',1,'2026-03-05 04:17:24'),(43,'EV Shift A','06:00:00','10:00:00','',1,'2026-03-05 04:18:02'),(44,'EV Shift B','10:01:00','14:00:00','',1,'2026-03-05 04:18:33'),(45,'EV Shift C','14:00:00','18:30:00','',1,'2026-03-05 04:18:58');
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stop_change_requests`
--

DROP TABLE IF EXISTS `stop_change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stop_change_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_transport_id` int NOT NULL,
  `current_stop_id` int NOT NULL,
  `requested_stop_id` int NOT NULL,
  `current_fee` decimal(10,2) NOT NULL,
  `new_fee` decimal(10,2) NOT NULL,
  `fee_difference` decimal(10,2) GENERATED ALWAYS AS ((`new_fee` - `current_fee`)) STORED,
  `reason` text,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_remarks` text,
  `processed_by` int DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_transport_id` (`student_transport_id`),
  KEY `processed_by` (`processed_by`),
  CONSTRAINT `stop_change_requests_ibfk_1` FOREIGN KEY (`student_transport_id`) REFERENCES `student_transport` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stop_change_requests_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stop_change_requests`
--

LOCK TABLES `stop_change_requests` WRITE;
/*!40000 ALTER TABLE `stop_change_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `stop_change_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stops`
--

DROP TABLE IF EXISTS `stops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stops` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stop_name` varchar(255) NOT NULL,
  `location` varchar(512) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stops`
--

LOCK TABLES `stops` WRITE;
/*!40000 ALTER TABLE `stops` DISABLE KEYS */;
INSERT INTO `stops` VALUES (1,'College Main Gate','BIT Campus Entrance','2026-01-06 03:53:03'),(2,'Sathyamangalam Bus Stand','Central Bus Station','2026-01-06 03:53:03'),(3,'Railway Station','Sathy Railway Junction','2026-01-06 03:53:03'),(4,'Gobichettipalayam','Gobi Bus Stand','2026-01-06 03:53:03'),(5,'Bhavani','Bhavani Junction','2026-01-06 03:53:03'),(6,'Erode Bus Stand','Erode Central','2026-01-06 03:53:03'),(7,'Boys Hostel','BIT Boys Hostel Block','2026-01-06 03:53:03'),(8,'Girls Hostel','BIT Girls Hostel Block','2026-01-06 03:53:03'),(9,'Staff Quarters','Faculty Residence Area','2026-01-06 03:53:03'),(10,'Library','Central Library','2026-01-06 03:53:03');
/*!40000 ALTER TABLE `stops` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_transport`
--

DROP TABLE IF EXISTS `student_transport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_transport` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bus_id` int NOT NULL,
  `stop_id` int NOT NULL,
  `transport_fee_id` int DEFAULT NULL,
  `total_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(10,2) GENERATED ALWAYS AS ((`total_fee` - `paid_amount`)) STORED,
  `academic_year` varchar(20) NOT NULL DEFAULT '2025-2026',
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_year` (`user_id`,`academic_year`),
  KEY `bus_id` (`bus_id`),
  KEY `idx_st_user` (`user_id`),
  CONSTRAINT `student_transport_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_transport_ibfk_2` FOREIGN KEY (`bus_id`) REFERENCES `buses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_transport`
--

LOCK TABLES `student_transport` WRITE;
/*!40000 ALTER TABLE `student_transport` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_transport` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `temporary_assignments`
--

DROP TABLE IF EXISTS `temporary_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `temporary_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `original_driver_id` int NOT NULL,
  `replacement_driver_id` int NOT NULL,
  `shift_id` int DEFAULT NULL,
  `vehicle_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text,
  `category` varchar(50) DEFAULT 'driver_replacement',
  `source_request_id` int DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `shift_id` (`shift_id`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `idx_temp_dates` (`start_date`,`end_date`),
  KEY `idx_temp_replacement` (`replacement_driver_id`),
  KEY `idx_temp_original` (`original_driver_id`),
  KEY `idx_ta_dates` (`start_date`,`end_date`,`status`),
  CONSTRAINT `temporary_assignments_ibfk_1` FOREIGN KEY (`original_driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `temporary_assignments_ibfk_2` FOREIGN KEY (`replacement_driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `temporary_assignments_ibfk_3` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `temporary_assignments_ibfk_4` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `temporary_assignments`
--

LOCK TABLES `temporary_assignments` WRITE;
/*!40000 ALTER TABLE `temporary_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `temporary_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transport_fees`
--

DROP TABLE IF EXISTS `transport_fees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transport_fees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stop_id` int NOT NULL,
  `fee_amount` decimal(10,2) NOT NULL,
  `academic_year` varchar(20) NOT NULL DEFAULT '2025-2026',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stop_year` (`stop_id`,`academic_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transport_fees`
--

LOCK TABLES `transport_fees` WRITE;
/*!40000 ALTER TABLE `transport_fees` DISABLE KEYS */;
/*!40000 ALTER TABLE `transport_fees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transport_payments`
--

DROP TABLE IF EXISTS `transport_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transport_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_transport_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('cash','upi','bank_transfer','card','other') DEFAULT 'cash',
  `transaction_id` varchar(100) DEFAULT NULL,
  `receipt_number` varchar(50) DEFAULT NULL,
  `remarks` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_transport_id` (`student_transport_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `transport_payments_ibfk_1` FOREIGN KEY (`student_transport_id`) REFERENCES `student_transport` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_payments_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transport_payments`
--

LOCK TABLES `transport_payments` WRITE;
/*!40000 ALTER TABLE `transport_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `transport_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transport_requests`
--

DROP TABLE IF EXISTS `transport_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transport_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bus_id` int NOT NULL,
  `stop_id` int NOT NULL,
  `academic_year` varchar(20) NOT NULL DEFAULT '2025-2026',
  `reason` text,
  `status` varchar(50) DEFAULT 'pending',
  `admin_remarks` text,
  `processed_by` int DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `bus_id` (`bus_id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_tr_user` (`user_id`,`status`),
  CONSTRAINT `transport_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_requests_ibfk_2` FOREIGN KEY (`bus_id`) REFERENCES `buses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_requests_ibfk_3` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transport_requests`
--

LOCK TABLES `transport_requests` WRITE;
/*!40000 ALTER TABLE `transport_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `transport_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `type` varchar(50) DEFAULT 'general',
  `related_id` int DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notifications`
--

LOCK TABLES `user_notifications` WRITE;
/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `role` enum('ADMIN','DRIVER','INCHARGE','STUDENT','FACULTY') NOT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `password` varchar(255) DEFAULT 'password',
  `department` varchar(100) DEFAULT NULL,
  `year` int DEFAULT '0',
  `roll_number` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','Transport Admin','9999999999','admin@transport.com','ADMIN',NULL,'2026-01-05 06:52:32','2026-02-02 06:03:38','password',NULL,0,NULL,'active'),(67,'driver1','Driver1','9876543211','gopal@gmail.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-05 04:15:45','password',NULL,0,NULL,'present'),(69,'driver2','Driver2','9876543213','murugan_k@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:45','password',NULL,0,NULL,'present'),(71,'driver3','Driver3','9876543215','senthil_v@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:46','password',NULL,0,NULL,'present'),(72,'driver4','Driver4','9876543216','kumar_s@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:48','password',NULL,0,NULL,'present'),(74,'driver5','Driver5','9876543218','arun_p@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:49','password',NULL,0,NULL,'present'),(75,'driver6','Driver6','9876543219','bala_k@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:50','password',NULL,0,NULL,'present'),(76,'driver7','Driver7','7894561230','ganesha@gmail.com','DRIVER',NULL,'2026-01-06 11:18:48','2026-03-05 04:15:56','password',NULL,0,NULL,'present'),(78,'student5','Student5','9876543210','john.doe@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Computer Science',3,'CS2023001','active'),(79,'student4','Student4','9876543211','jane.smith@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Electronics',2,'EC2024015','active'),(80,'student3','Student3','9876543212','mike.wilson@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Mechanical',4,'ME2022042','active'),(81,'student1','Student1','9874561230','student1@gmail.com','STUDENT',NULL,'2026-01-28 09:19:38',NULL,'password','AIDS',2,'2024UAD1010','active'),(82,'student2','Student2','7418529630','student2@gmail.com','STUDENT',NULL,'2026-01-28 10:01:07','2026-01-31 06:29:04','password','AIML',1,'2025UAL1023','active'),(95,'driver8','Driver-08','7418529630','driver8@gmail.com','DRIVER',NULL,'2026-01-31 08:28:32','2026-03-02 05:11:34','password',NULL,0,NULL,'present'),(96,'driver9','Driver-09','7418529630','driver9@gmail.com','DRIVER',NULL,'2026-01-31 08:29:47','2026-03-02 05:11:44','password',NULL,0,NULL,'present'),(97,'faculty1','faculty1','9876543201','rajesh@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-12 04:10:50','password',NULL,0,NULL,'active'),(98,'faculty2','Dr. Priya Sharma','9876543202','priya@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active'),(99,'faculty3','Dr. Anil Verma','9876543203','anil@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active'),(100,'faculty4','Dr. Sunita Patel','9876543204','sunita@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active'),(101,'thiru','Dr.Thirumurugan','7418529630','thirumurugank.al24@bitsathy.ac.in','ADMIN',NULL,'2026-02-11 05:38:13','2026-03-02 09:51:30','password','',0,NULL,'active');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_document_audit_log`
--

DROP TABLE IF EXISTS `vehicle_document_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_document_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `document_type` enum('insurance','fc','permit') NOT NULL,
  `field_name` varchar(50) NOT NULL,
  `old_value` text,
  `new_value` text,
  `changed_by` int NOT NULL,
  `changed_by_name` varchar(100) NOT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_doc` (`vehicle_id`,`document_type`),
  KEY `idx_changed_at` (`changed_at`),
  CONSTRAINT `vehicle_document_audit_log_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_document_audit_log`
--

LOCK TABLES `vehicle_document_audit_log` WRITE;
/*!40000 ALTER TABLE `vehicle_document_audit_log` DISABLE KEYS */;
INSERT INTO `vehicle_document_audit_log` VALUES (29,1,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:06:09'),(30,1,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:06:09'),(31,1,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:06:09'),(32,1,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:06:09'),(33,1,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:06:09'),(34,1,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:06:09'),(35,2,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:07:27'),(36,2,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:07:27'),(37,2,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:07:27'),(38,2,'fc','expire_date',NULL,'05-12-2030',1,'admin','2026-03-05 04:07:27'),(39,2,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:07:27'),(40,2,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:07:27'),(41,3,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:14:26'),(42,3,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:14:26'),(43,3,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:14:26'),(44,3,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:14:26'),(45,3,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:14:26'),(46,3,'permit','expire_date',NULL,'05-12-2030',1,'admin','2026-03-05 04:14:26'),(47,4,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:15:16'),(48,4,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:15:16'),(49,4,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:15:16'),(50,4,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:15:16'),(51,4,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:15:16'),(52,4,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:15:16'),(53,5,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:54:25'),(54,5,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:54:25'),(55,5,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:54:25'),(56,5,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:54:25'),(57,5,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 04:54:25'),(58,5,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 04:54:25'),(59,6,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:01:59'),(60,6,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:01:59'),(61,6,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:01:59'),(62,6,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:01:59'),(63,6,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:01:59'),(64,6,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:01:59'),(65,7,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:03:18'),(66,7,'insurance','expire_date',NULL,'30-12-2030',1,'admin','2026-03-05 06:03:18'),(67,7,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:03:18'),(68,7,'fc','expire_date',NULL,'30-12-2030',1,'admin','2026-03-05 06:03:18'),(69,7,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:03:18'),(70,7,'permit','expire_date',NULL,'05-12-2030',1,'admin','2026-03-05 06:03:18'),(71,8,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:04:21'),(72,8,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:04:21'),(73,8,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:04:21'),(74,8,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:04:21'),(75,8,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:04:21'),(76,8,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:04:21'),(77,9,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:05:38'),(78,9,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:05:38'),(79,9,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:05:38'),(80,9,'fc','expire_date',NULL,'05-12-2030',1,'admin','2026-03-05 06:05:38'),(81,9,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:05:38'),(82,9,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:05:38'),(83,10,'insurance','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:06:30'),(84,10,'insurance','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:06:30'),(85,10,'fc','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:06:30'),(86,10,'fc','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:06:30'),(87,10,'permit','start_date',NULL,'05-03-2026',1,'admin','2026-03-05 06:06:30'),(88,10,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-05 06:06:30');
/*!40000 ALTER TABLE `vehicle_document_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_documents`
--

DROP TABLE IF EXISTS `vehicle_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `document_type` enum('insurance','fc','permit') NOT NULL,
  `start_date` date DEFAULT NULL,
  `expire_date` date DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vehicle_doc_type` (`vehicle_id`,`document_type`),
  CONSTRAINT `fk_vd_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=145 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_documents`
--

LOCK TABLES `vehicle_documents` WRITE;
/*!40000 ALTER TABLE `vehicle_documents` DISABLE KEYS */;
INSERT INTO `vehicle_documents` VALUES (106,1,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 04:06:09','2026-03-05 04:06:09'),(107,1,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 04:06:09','2026-03-05 04:06:09'),(108,1,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 04:06:09','2026-03-05 04:06:09'),(109,2,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 04:07:27','2026-03-05 04:07:27'),(110,2,'fc','2026-03-05','2030-12-05',NULL,'2026-03-05 04:07:27','2026-03-05 04:07:27'),(111,2,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 04:07:27','2026-03-05 04:07:27'),(115,3,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 04:14:26','2026-03-05 04:14:26'),(116,3,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 04:14:26','2026-03-05 04:14:26'),(117,3,'permit','2026-03-05','2030-12-05',NULL,'2026-03-05 04:14:26','2026-03-05 04:14:26'),(118,4,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 04:15:16','2026-03-05 04:15:16'),(119,4,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 04:15:16','2026-03-05 04:15:16'),(120,4,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 04:15:16','2026-03-05 04:15:16'),(121,5,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 04:54:25','2026-03-05 04:54:25'),(122,5,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 04:54:25','2026-03-05 04:54:25'),(123,5,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 04:54:25','2026-03-05 04:54:25'),(127,6,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 06:01:59','2026-03-05 06:01:59'),(128,6,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 06:01:59','2026-03-05 06:01:59'),(129,6,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 06:01:59','2026-03-05 06:01:59'),(130,7,'insurance','2026-03-05','2030-12-30',NULL,'2026-03-05 06:03:18','2026-03-05 06:03:18'),(131,7,'fc','2026-03-05','2030-12-30',NULL,'2026-03-05 06:03:18','2026-03-05 06:03:18'),(132,7,'permit','2026-03-05','2030-12-05',NULL,'2026-03-05 06:03:18','2026-03-05 06:03:18'),(133,8,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 06:04:21','2026-03-05 06:04:21'),(134,8,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 06:04:21','2026-03-05 06:04:21'),(135,8,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 06:04:21','2026-03-05 06:04:21'),(136,9,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 06:05:38','2026-03-05 06:05:38'),(137,9,'fc','2026-03-05','2030-12-05',NULL,'2026-03-05 06:05:38','2026-03-05 06:05:38'),(138,9,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 06:05:38','2026-03-05 06:05:38'),(139,10,'insurance','2026-03-05','2030-12-31',NULL,'2026-03-05 06:06:30','2026-03-05 06:06:30'),(140,10,'fc','2026-03-05','2030-12-31',NULL,'2026-03-05 06:06:30','2026-03-05 06:06:30'),(141,10,'permit','2026-03-05','2030-12-31',NULL,'2026-03-05 06:06:30','2026-03-05 06:06:30');
/*!40000 ALTER TABLE `vehicle_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_group_members`
--

DROP TABLE IF EXISTS `vehicle_group_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_group_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `vehicle_id` int NOT NULL,
  `valid_from` date NOT NULL,
  `valid_to` date NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `vehicle_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `vehicle_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vehicle_group_members_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vehicle_group_members_chk_1` CHECK ((`valid_from` <= `valid_to`))
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_group_members`
--

LOCK TABLES `vehicle_group_members` WRITE;
/*!40000 ALTER TABLE `vehicle_group_members` DISABLE KEYS */;
INSERT INTO `vehicle_group_members` VALUES (50,20,4,'2026-03-01','2026-03-07','2026-03-05 04:16:23'),(51,20,3,'2026-03-01','2026-03-07','2026-03-05 04:16:23');
/*!40000 ALTER TABLE `vehicle_group_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_groups`
--

DROP TABLE IF EXISTS `vehicle_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_groups`
--

LOCK TABLES `vehicle_groups` WRITE;
/*!40000 ALTER TABLE `vehicle_groups` DISABLE KEYS */;
INSERT INTO `vehicle_groups` VALUES (20,'V Group A','','2026-03-01','2026-03-07','2026-03-05 04:16:23','2026-03-05 04:16:23');
/*!40000 ALTER TABLE `vehicle_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_replacements`
--

DROP TABLE IF EXISTS `vehicle_replacements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_replacements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `replacement_vehicle_id` int DEFAULT NULL,
  `driver_id` int NOT NULL,
  `reason` varchar(100) NOT NULL DEFAULT 'maintenance',
  `service_record_id` int DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `notes` text,
  `requested_by_role` varchar(50) DEFAULT 'admin',
  `requested_by_id` int DEFAULT NULL,
  `approved_by_id` int DEFAULT NULL,
  `driver_notified` tinyint DEFAULT '0',
  `replacement_type` varchar(50) NOT NULL DEFAULT 'vehicle',
  `replacement_driver_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vr_vehicle` (`vehicle_id`),
  KEY `idx_vr_replacement` (`replacement_vehicle_id`),
  KEY `idx_vr_driver` (`driver_id`),
  KEY `idx_vr_status` (`status`),
  KEY `idx_vr_service` (`service_record_id`),
  KEY `idx_vr_replacement_driver` (`replacement_driver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_replacements`
--

LOCK TABLES `vehicle_replacements` WRITE;
/*!40000 ALTER TABLE `vehicle_replacements` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_replacements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_service_tracking`
--

DROP TABLE IF EXISTS `vehicle_service_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_service_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `last_serviced_km` int NOT NULL DEFAULT '0' COMMENT 'KM at which vehicle was last serviced',
  `next_service_km` int NOT NULL DEFAULT '10000' COMMENT 'KM at which next service is due',
  `last_service_date` date DEFAULT NULL COMMENT 'Date of last service',
  `next_service_date` date DEFAULT NULL COMMENT 'Expected next service date (optional)',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  KEY `idx_vst_vehicle` (`vehicle_id`),
  CONSTRAINT `vehicle_service_tracking_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_service_tracking`
--

LOCK TABLES `vehicle_service_tracking` WRITE;
/*!40000 ALTER TABLE `vehicle_service_tracking` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_service_tracking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehiclerequests`
--

DROP TABLE IF EXISTS `vehiclerequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehiclerequests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `BookingType` varchar(255) NOT NULL,
  `TripType` varchar(255) NOT NULL,
  `TripMode` varchar(255) NOT NULL,
  `OnwardFromPlace` varchar(255) DEFAULT NULL,
  `OnwardToPlace` varchar(255) DEFAULT NULL,
  `OnwardFromDateTime` datetime DEFAULT NULL,
  `OnwardTodateTime` datetime DEFAULT NULL,
  `CountPerson` int DEFAULT NULL,
  `PurposeOfVisit` text,
  `TravellerName` varchar(255) DEFAULT NULL,
  `Address` text,
  `MobileNumber` varchar(50) DEFAULT NULL,
  `IndenterName` varchar(255) DEFAULT NULL,
  `IndenterDesignation` varchar(255) DEFAULT NULL,
  `IndenterDepartment` varchar(255) DEFAULT NULL,
  `IndenterMobileNo` varchar(50) DEFAULT NULL,
  `TaskID` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Purpose` text,
  `ContactName` varchar(100) DEFAULT NULL,
  `ContactPhone` varchar(20) DEFAULT NULL,
  `vehicle_id` int DEFAULT NULL,
  `driver_id` int DEFAULT NULL,
  `admin_remarks` text,
  `status` enum('pending','approved','rejected','assigned','trip_started','completed','cancelled') DEFAULT 'pending',
  `faculty_id` int NOT NULL,
  `RequestUnder` varchar(100) DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `start_otp` varchar(6) DEFAULT NULL,
  `end_otp` varchar(6) DEFAULT NULL,
  `start_otp_generated_at` timestamp NULL DEFAULT NULL,
  `end_otp_generated_at` timestamp NULL DEFAULT NULL,
  `trip_started_at` timestamp NULL DEFAULT NULL,
  `trip_ended_at` timestamp NULL DEFAULT NULL,
  `Vertical` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vr_status` (`status`),
  KEY `idx_vr_faculty` (`faculty_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehiclerequests`
--

LOCK TABLES `vehiclerequests` WRITE;
/*!40000 ALTER TABLE `vehiclerequests` DISABLE KEYS */;
INSERT INTO `vehiclerequests` VALUES (20,'faculty','faculty_staff_visit','official','BIT','Covai','2026-03-05 06:00:00','2026-03-05 20:40:00',5,'Industry Visit','MR Gambler','','741852963','faculty1','Professor','Computer Science','9876543201','7410d','2026-03-05 06:23:01','Industry Visit','faculty1','9876543201',10,6,'','assigned',1,'academic_department',1,'2026-03-05 14:01:31','2026-03-05 14:01:31','670564',NULL,'2026-03-05 08:31:31',NULL,NULL,NULL,'AIML');
/*!40000 ALTER TABLE `vehiclerequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_name` varchar(255) DEFAULT NULL,
  `vehicle_number` varchar(64) NOT NULL,
  `vehicle_type` varchar(50) NOT NULL,
  `fuel_type` enum('PETROL','DIESEL','EV','CNG','OTHER') NOT NULL DEFAULT 'DIESEL',
  `seating_capacity` int DEFAULT '0',
  `status` varchar(50) DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_number` (`vehicle_number`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
INSERT INTO `vehicles` VALUES (1,'BUS1','TN 36 G 1589','BUS','PETROL',40,'available','2026-03-05 04:06:09'),(2,'BUS2','TN 36 G 1234','BUS','DIESEL',40,'available','2026-03-05 04:07:27'),(3,'EV 1','EV-01','BATTERY_VEHICLE','EV',12,'available','2026-03-05 04:14:26'),(4,'EV 2','EV-02','BATTERY_VEHICLE','DIESEL',12,'available','2026-03-05 04:15:16'),(5,'Innova 1','CAR 01','CAR','DIESEL',7,'available','2026-03-05 04:54:25'),(6,'BUS 3','TN 36 G 7845','BUS','DIESEL',40,'available','2026-03-05 06:01:59'),(7,'Bus 4 ','TN 36 A 1234','BUS','PETROL',40,'available','2026-03-05 06:03:18'),(8,'JCB','TN 36 O 1234','OTHER','DIESEL',0,'available','2026-03-05 06:04:21'),(9,'EV 3','EV 03','BATTERY_VEHICLE','EV',12,'available','2026-03-05 06:05:38'),(10,'Innova 2','CAR 2','CAR','DIESEL',7,'available','2026-03-05 06:06:30');
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `address` text,
  `contact` varchar(50) DEFAULT NULL,
  `gst_number` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vendor_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'ASM Seat covers','rv street,\nrkv road,\nErode','147258369','963258741','asmvendor@gmail.com',1,'2026-02-23 04:00:08','2026-02-23 04:00:08'),(2,'JCB Parts','Thindal\nErode','7412589630','','',1,'2026-02-23 09:42:12','2026-02-23 09:42:12'),(3,'Indian Oils','Sathyamangalam','7418529630','741852963','',1,'2026-02-23 12:40:56','2026-02-23 12:40:56'),(4,'GAR Garment','tiruppur','7418529630','GST-142536','gar@gmail.com',1,'2026-02-24 10:30:29','2026-02-24 10:30:29');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-05 14:10:03
