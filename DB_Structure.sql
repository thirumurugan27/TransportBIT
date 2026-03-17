-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: transport_new
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assignments`
--

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` VALUES (74,36,1,2,'2026-03-15','assigned','2026-03-13 03:30:10',1,NULL,0,'2026-03-15','2026-03-21','',0,NULL,NULL),(82,40,32,6,'2026-03-16','assigned','2026-03-16 05:33:27',1,NULL,0,'2026-03-16','2026-03-16','',0,NULL,NULL),(83,40,11,11,'2026-03-16','assigned','2026-03-16 05:33:48',1,NULL,0,'2026-03-16','2026-03-16','',0,NULL,NULL),(88,35,1,2,'2026-03-16','cancelled','2026-03-16 06:30:51',1,NULL,0,'2026-03-16','2026-03-16','',0,NULL,'2026-03-16 06:30:56');
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_user_date` (`user_id`,`date`),
  KEY `idx_att_user_date` (`user_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (30,67,'2026-02-04','absent',NULL,NULL,NULL,'2026-01-31 10:35:35',NULL,0,NULL),(31,95,'2026-02-04','absent',NULL,NULL,NULL,'2026-02-02 03:29:22',NULL,0,NULL),(35,67,'2026-02-07','absent',NULL,NULL,NULL,'2026-02-04 05:31:11',NULL,0,NULL),(36,96,'2026-02-04','present','2026-02-04 09:42:04',NULL,12,'2026-02-04 09:42:04',NULL,0,NULL),(37,69,'2026-02-04','present','2026-02-04 09:42:05',NULL,12,'2026-02-04 09:42:05',NULL,0,NULL),(38,71,'2026-02-04','present','2026-02-04 09:42:07',NULL,12,'2026-02-04 09:42:07',NULL,0,NULL),(39,72,'2026-02-04','present','2026-02-04 09:42:09',NULL,12,'2026-02-04 09:42:09',NULL,0,NULL),(40,74,'2026-02-04','present','2026-02-04 09:42:10',NULL,12,'2026-02-04 09:42:10',NULL,0,NULL),(41,75,'2026-02-04','present','2026-02-04 09:42:12',NULL,12,'2026-02-04 09:42:12',NULL,0,NULL),(42,76,'2026-02-04','present','2026-02-04 09:42:13',NULL,12,'2026-02-04 09:42:13',NULL,0,NULL),(43,95,'2026-02-18','present','2026-02-18 10:21:41',NULL,NULL,'2026-02-18 10:21:41',NULL,0,NULL),(44,96,'2026-02-18','present','2026-02-18 10:21:43',NULL,NULL,'2026-02-18 10:21:43',NULL,0,NULL),(45,67,'2026-02-18','present','2026-02-18 10:21:44',NULL,NULL,'2026-02-18 10:21:44',NULL,0,NULL),(46,69,'2026-02-18','present','2026-02-18 10:21:46',NULL,NULL,'2026-02-18 10:21:46',NULL,0,NULL),(47,71,'2026-02-18','present','2026-02-18 10:21:49',NULL,NULL,'2026-02-18 10:21:49',NULL,0,NULL),(91,67,'2026-03-02','absent',NULL,NULL,NULL,'2026-03-02 05:13:05',1,0,NULL),(92,74,'2026-03-02','present','2026-03-02 05:13:25',NULL,NULL,'2026-03-02 05:13:25',1,0,NULL),(93,95,'2026-03-05','present','2026-03-05 09:22:05',NULL,NULL,'2026-03-05 09:22:05',1,0,NULL),(94,96,'2026-03-05','present','2026-03-05 09:22:07',NULL,NULL,'2026-03-05 09:22:07',1,0,NULL),(95,69,'2026-03-05','present','2026-03-05 09:22:09',NULL,NULL,'2026-03-05 09:22:09',1,0,NULL),(96,71,'2026-03-05','present','2026-03-05 09:22:12',NULL,NULL,'2026-03-05 09:22:12',1,0,NULL),(97,67,'2026-03-05','present','2026-03-05 09:22:34',NULL,NULL,'2026-03-05 09:22:34',1,0,NULL),(98,74,'2026-03-05','present','2026-03-05 09:30:10',NULL,NULL,'2026-03-05 09:30:10',1,0,NULL),(99,95,'2026-03-10','present','2026-03-10 04:53:48',NULL,NULL,'2026-03-10 04:53:48',1,0,NULL),(100,96,'2026-03-10','present','2026-03-10 04:53:48',NULL,NULL,'2026-03-10 04:53:48',1,0,NULL),(101,67,'2026-03-10','present','2026-03-10 04:53:50',NULL,NULL,'2026-03-10 04:53:50',1,0,NULL),(102,69,'2026-03-10','present','2026-03-10 04:53:52',NULL,NULL,'2026-03-10 04:53:52',1,0,NULL),(103,72,'2026-03-10','present','2026-03-10 04:53:54',NULL,NULL,'2026-03-10 04:53:54',1,0,NULL),(104,74,'2026-03-10','present','2026-03-10 04:53:55',NULL,NULL,'2026-03-10 04:53:55',1,0,NULL),(105,71,'2026-03-10','present','2026-03-10 04:53:56',NULL,NULL,'2026-03-10 04:53:56',1,0,NULL),(106,75,'2026-03-10','present','2026-03-10 04:53:58',NULL,NULL,'2026-03-10 04:53:58',1,0,NULL),(107,76,'2026-03-10','present','2026-03-10 04:53:59',NULL,NULL,'2026-03-10 04:53:59',1,0,NULL),(108,95,'2026-03-11','absent',NULL,NULL,NULL,'2026-03-11 03:28:48',1,0,NULL),(109,96,'2026-03-11','absent',NULL,NULL,NULL,'2026-03-11 03:28:49',1,0,NULL),(110,67,'2026-03-11','absent',NULL,NULL,NULL,'2026-03-11 03:28:50',1,0,NULL),(111,69,'2026-03-11','present','2026-03-11 03:28:50',NULL,NULL,'2026-03-11 03:28:50',1,0,NULL),(112,74,'2026-03-11','present','2026-03-11 03:28:52',NULL,NULL,'2026-03-11 03:28:52',1,0,NULL),(113,72,'2026-03-11','present','2026-03-11 03:28:53',NULL,NULL,'2026-03-11 03:28:53',1,0,NULL),(114,71,'2026-03-11','present','2026-03-11 03:28:54',NULL,NULL,'2026-03-11 03:28:54',1,0,NULL),(115,76,'2026-03-11','present','2026-03-11 03:28:55',NULL,NULL,'2026-03-11 03:28:55',1,0,NULL),(116,75,'2026-03-11','present','2026-03-11 03:28:56',NULL,NULL,'2026-03-11 03:28:56',1,0,NULL),(120,67,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(121,69,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(122,71,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(123,72,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(124,74,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(125,75,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(126,76,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(127,95,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(128,96,'2026-03-12','present','2026-03-12 06:21:54',NULL,NULL,'2026-03-12 06:21:54',1,0,NULL),(129,74,'2026-03-13','present','2026-03-13 03:42:26',NULL,NULL,'2026-03-13 03:27:23',1,0,NULL),(130,74,'2026-03-14','present','2026-03-14 10:06:10',NULL,NULL,'2026-03-13 03:27:23',1,0,NULL),(131,67,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(132,69,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(133,71,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(134,72,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(135,75,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(136,95,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(137,96,'2026-03-13','present','2026-03-13 03:39:11',NULL,NULL,'2026-03-13 03:39:11',1,0,NULL),(138,76,'2026-03-13','present','2026-03-13 03:40:52',NULL,NULL,'2026-03-13 03:40:52',1,0,NULL),(141,67,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(142,69,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(143,71,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(144,72,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(145,74,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(146,75,'2026-03-16','present','2026-03-16 03:36:13',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(147,76,'2026-03-16','present','2026-03-16 03:36:13',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(148,95,'2026-03-16','absent',NULL,NULL,NULL,'2026-03-16 03:27:14',1,0,NULL),(149,96,'2026-03-16','present','2026-03-16 03:27:14',NULL,NULL,'2026-03-16 03:27:14',1,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stop` (`vehicle_id`,`stop_order`),
  CONSTRAINT `bus_stops_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bus_stops`
--

LOCK TABLES `bus_stops` WRITE;
/*!40000 ALTER TABLE `bus_stops` DISABLE KEYS */;
INSERT INTO `bus_stops` VALUES (3,1,'Busstand',0,10000.00,0.00,'2026-01-07 08:44:36','06:30:00',0,NULL),(7,1,'stop A',2,10000.00,4.00,'2026-01-07 08:46:54','06:45:00',0,NULL),(8,1,'Stop B',3,10000.00,6.00,'2026-01-07 08:47:10','07:05:00',0,NULL),(13,4,'Busstop',1,20000.00,80.00,'2026-01-29 06:21:22','07:00:00',0,NULL),(14,1,'Stop C',4,10000.00,10.00,'2026-01-29 06:22:03','07:10:00',0,NULL),(15,3,'Pollachi Bus Stand',1,25000.00,80.00,'2026-01-29 06:22:50','06:30:00',0,NULL),(16,2,'Covai Bus Stand',1,25000.00,65.00,'2026-01-29 06:23:32','06:30:00',0,NULL),(17,18,'Erode Bus Stand',1,25000.00,65.00,'2026-01-29 06:23:57','06:40:00',0,NULL),(18,1,'STOP D',5,120000.00,14.00,'2026-02-12 09:51:35','07:23:00',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `buses_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=636 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buses`
--

LOCK TABLES `buses` WRITE;
/*!40000 ALTER TABLE `buses` DISABLE KEYS */;
INSERT INTO `buses` VALUES (1,1,'Campus','Sathy','2026-01-06 04:45:20',NULL,0,NULL),(2,2,'Campus','Covai','2026-01-06 04:45:20',NULL,0,NULL),(3,3,'Campus','Pollachi','2026-01-06 04:45:20',NULL,0,NULL),(4,4,'Campus','Avinasi','2026-01-06 04:45:20',NULL,0,NULL),(74,18,'Campus','Erode','2026-01-07 06:06:45',NULL,0,NULL),(635,30,'Main Gate','Town Bus Stand','2026-03-13 06:36:03',NULL,0,NULL);
/*!40000 ALTER TABLE `buses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `default_vehicle_drivers`
--

DROP TABLE IF EXISTS `default_vehicle_drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `default_vehicle_drivers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `driver_id` int NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  KEY `fk_dvd_driver` (`driver_id`),
  KEY `fk_dvd_created_by` (`created_by`),
  CONSTRAINT `fk_dvd_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_dvd_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`),
  CONSTRAINT `fk_dvd_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `default_vehicle_drivers`
--

LOCK TABLES `default_vehicle_drivers` WRITE;
/*!40000 ALTER TABLE `default_vehicle_drivers` DISABLE KEYS */;
INSERT INTO `default_vehicle_drivers` VALUES (1,1,2,NULL,NULL,'2026-03-14 04:03:03','2026-03-14 04:03:03',0,NULL),(2,4,4,NULL,NULL,'2026-03-14 04:03:14','2026-03-14 04:03:14',0,NULL),(3,3,6,NULL,NULL,'2026-03-14 04:03:24','2026-03-14 04:03:24',0,NULL),(4,2,7,NULL,NULL,'2026-03-14 04:03:43','2026-03-14 04:03:43',0,NULL);
/*!40000 ALTER TABLE `default_vehicle_drivers` ENABLE KEYS */;
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cluster_id` (`cluster_id`),
  KEY `driver_id` (`driver_id`),
  CONSTRAINT `driver_cluster_members_ibfk_1` FOREIGN KEY (`cluster_id`) REFERENCES `driver_clusters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driver_cluster_members_ibfk_2` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driver_cluster_members_chk_1` CHECK ((`valid_from` <= `valid_to`))
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_cluster_members`
--

LOCK TABLES `driver_cluster_members` WRITE;
/*!40000 ALTER TABLE `driver_cluster_members` DISABLE KEYS */;
INSERT INTO `driver_cluster_members` VALUES (69,33,4,'2026-03-15','2026-03-21','2026-03-16 03:29:50',0,NULL),(70,33,6,'2026-03-15','2026-03-21','2026-03-16 03:29:50',0,NULL),(71,33,7,'2026-03-15','2026-03-21','2026-03-16 03:29:50',0,NULL),(72,33,2,'2026-03-15','2026-03-21','2026-03-16 03:29:50',0,NULL),(73,34,14,'2026-03-16','2026-03-17','2026-03-16 08:20:11',0,NULL),(74,34,15,'2026-03-16','2026-03-17','2026-03-16 08:20:11',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_clusters`
--

LOCK TABLES `driver_clusters` WRITE;
/*!40000 ALTER TABLE `driver_clusters` DISABLE KEYS */;
INSERT INTO `driver_clusters` VALUES (33,'Group A','','2026-03-09 03:15:11','08:00:00','17:00:00','2026-03-15','2026-03-21',0,NULL),(34,'Group Test','','2026-03-16 08:20:11','08:00:00','17:00:00','2026-03-16','2026-03-17',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `home_vehicle_id` (`home_vehicle_id`),
  KEY `home_stop_id` (`home_stop_id`),
  CONSTRAINT `drivers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `drivers_ibfk_2` FOREIGN KEY (`home_vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drivers_ibfk_3` FOREIGN KEY (`home_stop_id`) REFERENCES `stops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (2,67,'TN-DL-2019-002345','HMV','2027-12-31',8,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01','2030-01-31',0,NULL),(4,69,'TN-DL-2017-004567','HEAVY','2027-12-31',12,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL,0,NULL),(6,71,'TN-DL-2019-006789','HEAVY','2027-12-31',7,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL,0,NULL),(7,72,'TN-DL-2020-007890','LIGHT','2027-12-31',5,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL,0,NULL),(9,74,'TN-DL-2022-009012','LIGHT','2027-12-31',3,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL,0,NULL),(10,75,'TN-DL-2021-010123','LIGHT','2027-12-31',4,'BUS',NULL,NULL,0,'2026-01-06 03:53:04','2026-01-01',NULL,0,NULL),(11,76,'TN-DL-2021-010125','MCWG','2030-12-29',4,'BUS',NULL,NULL,0,'2026-01-06 11:18:48','2026-01-01',NULL,0,NULL),(14,95,'TN-DL-2021-202612','HMV','2030-12-31',10,'BUS',NULL,NULL,0,'2026-01-31 08:28:32','2026-01-01',NULL,0,NULL),(15,96,'TN-DL-2021-010126','HMV','2030-12-31',10,'CAR',NULL,NULL,0,'2026-01-31 08:29:47','2026-01-01',NULL,0,NULL);
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cluster_id` (`cluster_id`),
  KEY `fk_ev_assignments_vehicle_group` (`vehicle_group_id`),
  KEY `idx_eva_dates` (`start_date`,`end_date`,`status`),
  CONSTRAINT `ev_assignments_ibfk_2` FOREIGN KEY (`cluster_id`) REFERENCES `driver_clusters` (`id`),
  CONSTRAINT `fk_ev_assignments_vehicle_group` FOREIGN KEY (`vehicle_group_id`) REFERENCES `vehicle_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ev_assignments`
--

LOCK TABLES `ev_assignments` WRITE;
/*!40000 ALTER TABLE `ev_assignments` DISABLE KEYS */;
INSERT INTO `ev_assignments` VALUES (63,33,37,'2026-03-15','2026-03-21','active','2026-03-16 04:50:39',22,0,NULL),(64,33,39,'2026-03-15','2026-03-21','active','2026-03-16 04:50:39',22,0,NULL),(65,33,38,'2026-03-15','2026-03-21','active','2026-03-16 04:50:39',22,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
INSERT INTO `faculty` VALUES (1,97,'Computer Science','Professor','2026-02-03 04:15:12','2026-02-03 04:15:12',0,NULL),(2,98,'Electronics','Associate Professor','2026-02-03 04:15:12','2026-02-03 04:15:12',0,NULL),(3,99,'Mechanical','Professor','2026-02-03 04:15:12','2026-02-03 04:15:12',0,NULL),(4,100,'Civil','Assistant Professor','2026-02-03 04:15:12','2026-02-03 04:15:12',0,NULL);
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
INSERT INTO `fc_replacement_requests` VALUES (1,5,6,6,'2026-01-13','2026-01-30','fc_renewal','completed','admin',1,NULL,'',1,'2026-01-12 06:15:39','2026-01-31 03:24:31');
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
  `fuel_indent_number` varchar(100) DEFAULT '',
  `vehicle_type` varchar(100) DEFAULT '',
  `fuel_type` varchar(100) DEFAULT '',
  `filled_date` varchar(20) DEFAULT '',
  `filled_time` varchar(20) DEFAULT '',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fuel_vehicle` (`vehicle_id`),
  KEY `idx_fuel_driver` (`driver_id`),
  KEY `idx_fuel_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fuel_indents`
--

LOCK TABLES `fuel_indents` WRITE;
/*!40000 ALTER TABLE `fuel_indents` DISABLE KEYS */;
INSERT INTO `fuel_indents` VALUES (1,2,7,1.80,1.80,232,'completed','2026-03-09 04:19:36','2026-03-09 04:31:35','76','','DIESEL','2026-03-09','11:46',0,NULL),(2,8,2,2.00,2.00,12,'completed','2026-03-09 04:32:00','2026-03-09 04:32:07','234','CAR','PETROL','2026-03-09','10:01',0,NULL),(3,1,2,88.00,88.00,875,'completed','2026-03-14 10:22:31','2026-03-14 10:22:44','8','BUS','DIESEL','2026-03-14','',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_km_logs_driver_date` (`driver_id`,`date`),
  KEY `idx_km_logs_vehicle_date` (`vehicle_id`,`date`),
  KEY `idx_km_logs_assignment` (`assignment_id`),
  KEY `fk_km_logs_recorded_by_user` (`recorded_by_user_id`),
  KEY `idx_km_driver_date` (`driver_id`,`date`),
  KEY `idx_km_vehicle_date` (`vehicle_id`,`date`),
  KEY `idx_km_status` (`status`),
  CONSTRAINT `fk_km_logs_recorded_by_user` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `km_logs_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `km_logs`
--

LOCK TABLES `km_logs` WRITE;
/*!40000 ALTER TABLE `km_logs` DISABLE KEYS */;
INSERT INTO `km_logs` VALUES (1,2,'2026-02-17',100.00,180.00,80.00,'','2026-02-17 04:20:07',1,57,67,NULL,'approved',NULL,NULL,NULL,0,NULL),(2,4,'2026-02-26',10.00,53.00,43.00,'','2026-02-26 06:07:52',4,NULL,1,3,'approved',1,'2026-02-26 11:37:52',NULL,0,NULL),(3,2,'2026-02-27',0.00,30.00,30.00,'','2026-02-27 04:05:09',1,61,1,2.4,'approved',1,'2026-02-27 09:35:09',NULL,0,NULL),(4,2,'2026-03-10',30.00,125.00,95.00,'','2026-03-10 09:14:15',1,69,67,NULL,'approved',1,'2026-03-10 14:51:27',NULL,0,NULL),(5,14,'2026-03-11',56.00,90.00,34.00,'','2026-03-11 04:01:25',25,71,1,NULL,'approved',1,'2026-03-11 09:31:25',36,0,NULL),(8,2,'2026-03-11',125.00,161.90,36.90,'','2026-03-11 04:02:30',1,69,67,NULL,'approved',1,'2026-03-11 09:32:51',NULL,0,NULL),(11,2,'2026-03-11',161.90,190.00,28.10,'','2026-03-11 04:12:13',1,69,67,NULL,'approved',1,'2026-03-12 08:42:50',NULL,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `driver_id` (`driver_id`),
  KEY `idx_lr_driver_status` (`driver_id`,`status`),
  KEY `idx_lr_dates` (`start_date`,`end_date`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
INSERT INTO `leave_requests` VALUES (22,9,'OD','2026-03-13','09:46:00','2026-03-13','21:46:00','','rejected',NULL,NULL,NULL,1,'2026-03-14 05:36:21','','2026-03-13 04:16:25',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_recipient` (`recipient_role`,`recipient_id`),
  KEY `idx_notif_read` (`is_read`),
  KEY `idx_notif_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=186 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'ADMIN',0,'fc_completion','FC Replacement Auto-Completed','Temporary assignment for driver Senthil Velan has ended. Vehicle EV-01 is back from fc_renewal and is now available. Driver has been reassigned to their original vehicle.',NULL,0,'2026-01-31 03:24:31',0,NULL),(2,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #4 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-09 09:41:05',0,NULL),(3,'ADMIN',0,'trip_started','Trip Started','Trip for request #4 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-09 09:42:07',0,NULL),(4,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #4 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-09 09:43:16',0,NULL),(5,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #5 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-09 10:40:02',0,NULL),(6,'ADMIN',0,'trip_started','Trip Started','Trip for request #5 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-09 10:54:55',0,NULL),(7,'ADMIN',0,'trip_completed','Trip Completed','Vehicle request #5 has been manually marked as completed by admin.',NULL,0,'2026-02-09 11:01:44',0,NULL),(8,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #9 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-10 06:07:31',0,NULL),(9,'ADMIN',0,'trip_started','Trip Started','Trip for request #9 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-10 06:08:52',0,NULL),(10,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #9 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-10 06:10:49',0,NULL),(11,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #10 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-10 10:39:58',0,NULL),(12,'ADMIN',0,'trip_started','Trip Started','Trip for request #10 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-10 10:42:08',0,NULL),(13,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #10 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-10 10:42:27',0,NULL),(14,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #12 by Dr. Rajesh Kumar. Start OTP sent to requester.',NULL,0,'2026-02-11 03:39:12',0,NULL),(15,'ADMIN',0,'trip_started','Trip Started','Trip for request #12 by Dr. Rajesh Kumar has started.',NULL,0,'2026-02-11 05:16:41',0,NULL),(16,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #12 by Dr. Rajesh Kumar has been completed.',NULL,0,'2026-02-11 05:17:08',0,NULL),(17,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #15 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-12 06:39:24',0,NULL),(18,'ADMIN',0,'trip_started','Trip Started','Trip for request #15 by faculty1 has started.',NULL,0,'2026-02-12 06:41:00',0,NULL),(19,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #16 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-12 08:32:07',0,NULL),(32,'DRIVER',6,'vehicle_change','Vehicle Change Notification','Your vehicle EV-VAN-01 is going for fc_renewal from 2026-01-13 to 2026-01-31. You have been assigned EV-VAN-02 for 19 days during this period. Your original vehicle will be automatically reassigned after this period.',1,0,'2026-01-12 06:15:39',0,NULL),(33,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,1,'2026-01-30 08:40:32',0,NULL),(34,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:33',0,NULL),(35,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:33',0,NULL),(36,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:35',0,NULL),(37,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,1,'2026-01-30 08:40:37',0,NULL),(38,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,0,'2026-01-30 08:40:38',0,NULL),(39,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Thirumurugan K has marked your attendance as Present for 2026-01-30.',NULL,1,'2026-01-30 08:40:40',0,NULL),(40,'DRIVER',6,'vehicle_change','Vehicle Reassignment - Back to Original','Your original vehicle EV-01 is back from fc_renewal. The temporary assignment has ended and you are now reassigned to your original vehicle.',1,0,'2026-01-31 03:24:31',0,NULL),(41,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,1,'2026-01-31 04:53:52',0,NULL),(42,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:53:55',0,NULL),(43,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-01-31.',NULL,1,'2026-01-31 04:53:57',0,NULL),(44,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-01-31.',NULL,1,'2026-01-31 04:54:02',0,NULL),(45,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:04',0,NULL),(46,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:05',0,NULL),(47,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-01-31.',NULL,0,'2026-01-31 04:54:07',0,NULL),(48,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 to 2026-01-31. Status: Pending approval.',5,1,'2026-01-31 04:55:56',0,NULL),(49,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-02-01 to 2026-01-01. Status: Pending approval.',6,1,'2026-01-31 04:57:25',0,NULL),(50,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a SICK leave request on your behalf from 2026-02-01 to 2026-02-01. Status: Pending approval.',7,1,'2026-01-31 04:58:27',0,NULL),(51,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 16:20 to 2026-02-02 20:45. Status: Pending approval.',8,1,'2026-01-31 05:39:25',0,NULL),(52,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ok',8,1,'2026-01-31 05:39:57',0,NULL),(53,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ok',9,1,'2026-01-31 06:12:09',0,NULL),(54,'DRIVER',2,'leave','Leave Request Submitted by Incharge','Incharge Head Incharge has submitted a CASUAL leave request on your behalf from 2026-01-31 16:40 to 2026-02-02 08:45. Status: Pending approval.',10,1,'2026-01-31 06:21:40',0,NULL),(55,'DRIVER',2,'leave','Leave Request Rejected by Incharge','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by incharge Head Incharge. Reason: ',10,1,'2026-01-31 06:21:52',0,NULL),(56,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 2026-01-31 to 2026-02-02 has been approved by incharge Head Incharge. Waiting for admin approval.',11,1,'2026-01-31 06:33:06',0,NULL),(57,'DRIVER',2,'leave','Leave Request Rejected by Admin','Your leave request from 2026-01-31 to 2026-02-02 has been rejected by admin. Reason: ',11,1,'2026-01-31 06:39:14',0,NULL),(58,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',12,1,'2026-01-31 09:10:41',0,NULL),(59,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 2026-02-04 to 2026-02-04 has been fully approved. Attendance will be automatically marked as absent.',12,1,'2026-01-31 09:39:41',0,NULL),(60,'DRIVER',10,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',13,0,'2026-02-02 03:12:04',0,NULL),(61,'DRIVER',10,'leave','Leave Request Rejected by Admin','Your leave request from 2026-02-04 to 2026-02-04 has been rejected by admin. Reason: ',13,0,'2026-02-02 03:20:16',0,NULL),(62,'DRIVER',14,'leave','Leave Request - Incharge Approved','Your leave request from 2026-02-04 to 2026-02-04 has been approved by incharge Head Incharge. Waiting for admin approval.',14,0,'2026-02-02 03:22:15',0,NULL),(63,'DRIVER',14,'leave','Leave Request Approved','Your leave request from 2026-02-04 to 2026-02-04 has been fully approved. Attendance will be automatically marked as absent.',14,0,'2026-02-02 03:29:22',0,NULL),(64,'DRIVER',14,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,0,'2026-02-02 06:19:25',0,NULL),(65,'DRIVER',15,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,0,'2026-02-02 06:19:27',0,NULL),(66,'DRIVER',2,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Absent for 2026-02-02.',NULL,1,'2026-02-02 06:19:28',0,NULL),(67,'DRIVER',2,'leave','Leave Request - Incharge Approved','Your leave request from 07-02-2026 to 07-02-2026 has been approved by incharge Head Incharge. Waiting for admin approval.',15,1,'2026-02-04 05:31:00',0,NULL),(68,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 07-02-2026 to 07-02-2026 has been fully approved. Attendance will be automatically marked as absent.',15,1,'2026-02-04 05:31:11',0,NULL),(69,'DRIVER',15,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:04',0,NULL),(70,'DRIVER',4,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,1,'2026-02-04 09:42:05',0,NULL),(71,'DRIVER',6,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:07',0,NULL),(72,'DRIVER',7,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:09',0,NULL),(73,'DRIVER',9,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,1,'2026-02-04 09:42:10',0,NULL),(74,'DRIVER',10,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:12',0,NULL),(75,'DRIVER',11,'info','Attendance Marked by Incharge','Incharge Head Incharge has marked your attendance as Present for 2026-02-04.',NULL,0,'2026-02-04 09:42:13',0,NULL),(95,'STUDENT',99,'car_booking_cancelled','Your Car Booking Has Been Cancelled','Your car booking for 2026-02-03T00:00:00Z (Vehicle: CAR-5S-01) has been cancelled by the transport admin. Reason: Cancelled by admin',3,0,'2026-02-03 06:49:06',0,NULL),(96,'STUDENT',97,'warning','Vehicle Request Cancelled','Your vehicle request #16 for \"Faculty visit to industry\" has been cancelled by admin. Reason: Cancelled by admin',16,0,'2026-02-12 08:38:30',0,NULL),(97,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #17 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-14 09:38:57',0,NULL),(98,'ADMIN',0,'trip_started','Trip Started','Trip for request #17 by faculty1 has started.',NULL,0,'2026-02-14 09:40:19',0,NULL),(99,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #17 by faculty1 has been completed.',NULL,0,'2026-02-14 09:40:51',0,NULL),(100,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Window Glass Broken (Severity: medium)',1,0,'2026-02-16 09:05:19',0,NULL),(101,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Window Glass Broken (Severity: medium)',2,0,'2026-02-16 09:11:13',0,NULL),(102,'DRIVER',2,'vehicle_change','Vehicle Change - Danger Zone Service','Your vehicle EV-01 is going for service (Danger Zone - service_due) from 2026-02-19 to 2026-02-25. You have been assigned CAR-5S-02 for 7 days during this period. Your original vehicle will be automatically reassigned after this period.',1,1,'2026-02-17 08:57:17',0,NULL),(103,'DRIVER',2,'leave','Leave Request - Admin Approved','Your leave request from 11-02-2026 to 11-02-2026 has been approved by admin. Waiting for incharge approval.',16,1,'2026-02-18 10:28:04',0,NULL),(104,'DRIVER',4,'leave','Leave Applied by Admin','Admin has applied Permission leave on your behalf from 2026-02-18 to 2026-02-19. Reason: ',17,1,'2026-02-18 10:28:28',0,NULL),(105,'DRIVER',4,'leave','Leave Request Approved','Your leave request from 18-02-2026 to 19-02-2026 has been fully approved by both incharge Head Incharge and admin.',17,1,'2026-02-18 10:29:00',0,NULL),(106,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 11-02-2026 to 11-02-2026 has been fully approved by both incharge Head Incharge and admin.',16,1,'2026-02-18 10:29:02',0,NULL),(107,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle CAR-5S-02: Front Wheel Dent (Severity: low)',11,0,'2026-02-24 05:27:37',0,NULL),(108,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #18 by faculty1. Start OTP sent to requester.',NULL,0,'2026-02-24 08:25:16',0,NULL),(109,'ADMIN',0,'trip_started','Trip Started','Trip for request #18 by faculty1 has started.',NULL,0,'2026-02-24 08:26:09',0,NULL),(110,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #18 by faculty1 has been completed.',NULL,0,'2026-02-24 08:26:25',0,NULL),(111,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Brake Noise (Severity: medium)',14,0,'2026-02-25 04:11:17',0,NULL),(112,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for service_repair from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',2,1,'2026-02-25 06:00:06',0,NULL),(113,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for service_repair from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',3,1,'2026-02-25 06:21:35',0,NULL),(114,'DRIVER',0,'vehicle_change','Vehicle Replacement','Your vehicle TN36JC2026 is going for service_repair from 2026-02-26 to 2026-02-28. You have been assigned TRUCK for 3 days. Your original vehicle will be reassigned after this period.',4,0,'2026-02-25 08:37:28',0,NULL),(115,'DRIVER',0,'info','Replacement Cancelled','The replacement for TN36JC2026 has been cancelled by admin.',NULL,0,'2026-02-25 09:46:03',0,NULL),(116,'DRIVER',4,'info','Replacement Cancelled','The replacement for TN-36-GN-7894 has been cancelled by admin.',NULL,1,'2026-02-25 09:46:10',0,NULL),(117,'DRIVER',4,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for insurance_renewal from 2026-02-25 to 2026-02-25. You have been assigned TN-36-GN-1988 for 1 days. Your original vehicle will be reassigned after this period.',5,1,'2026-02-25 09:47:25',0,NULL),(118,'DRIVER',4,'vehicle_change','Vehicle Back - Replacement Ended','Your original vehicle TN-36-GN-7894 is back from insurance_renewal. The temporary replacement has ended.',5,0,'2026-02-26 03:30:56',0,NULL),(119,'ADMIN',0,'replacement_completed','Replacement Auto-Completed','Vehicle TN-36-GN-7894 auto-completed from insurance_renewal. Driver Driver2 reassigned.',NULL,0,'2026-02-26 03:30:56',0,NULL),(120,'DRIVER',2,'leave','Leave Request Approved','Your leave request from 28-02-2026 to 28-02-2026 has been approved. Attendance will be automatically marked as absent.',18,1,'2026-02-26 06:24:56',0,NULL),(121,'ADMIN',0,'group_expiry','Driver Group Expiring: Driver group A','Driver group \'Driver group A\' validity expires on 07-03-2026. Please review and renew.',NULL,0,'2026-03-06 04:15:31',0,NULL),(122,'ADMIN',0,'group_expiry','Vehicle Group Expiring: Group A','Vehicle group \'Group A\' validity expires on 07-03-2026. Please review and renew.',NULL,0,'2026-03-06 04:15:31',0,NULL),(123,'ADMIN',0,'group_expiry','Driver Group Expiring: test batch','Driver group \'test batch\' validity expires on 06-03-2026. Please review and renew.',NULL,0,'2026-03-06 09:43:42',0,NULL),(124,'ADMIN',0,'group_expiry','Driver Group Expiring: Driver group A','Driver group \'Driver group A\' validity expires on 07-03-2026. Please review and renew.',NULL,0,'2026-03-07 04:53:01',0,NULL),(125,'ADMIN',0,'group_expiry','Driver Group Expired: test batch','Driver group \'test batch\' validity expired on 06-03-2026. Immediate attention required.',NULL,0,'2026-03-07 04:53:01',0,NULL),(126,'ADMIN',0,'group_expiry','Vehicle Group Expiring: Group A','Vehicle group \'Group A\' validity expires on 07-03-2026. Please review and renew.',NULL,0,'2026-03-07 04:53:01',0,NULL),(127,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #21 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-07 10:07:20',0,NULL),(128,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #22 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-07 10:36:03',0,NULL),(129,'ADMIN',0,'trip_started','Trip Started','Trip for request #22 by faculty1 has started.',NULL,0,'2026-03-07 10:37:32',0,NULL),(130,'ADMIN',0,'group_expiry','Driver Group Expired: Driver group A','Driver group \'Driver group A\' validity expired on 07-03-2026. Immediate attention required.',NULL,0,'2026-03-08 11:52:22',0,NULL),(131,'ADMIN',0,'group_expiry','Driver Group Expired: test batch','Driver group \'test batch\' validity expired on 06-03-2026. Immediate attention required.',NULL,0,'2026-03-08 11:52:22',0,NULL),(132,'ADMIN',0,'group_expiry','Vehicle Group Expired: Group A','Vehicle group \'Group A\' validity expired on 07-03-2026. Immediate attention required.',NULL,0,'2026-03-08 11:52:22',0,NULL),(133,'ADMIN',0,'group_expiry','Driver Group Expired: Driver group A','Driver group \'Driver group A\' validity expired on 07-03-2026. Immediate attention required.',NULL,0,'2026-03-09 03:13:40',0,NULL),(134,'ADMIN',0,'group_expiry','Driver Group Expired: test batch','Driver group \'test batch\' validity expired on 06-03-2026. Immediate attention required.',NULL,0,'2026-03-09 03:13:40',0,NULL),(135,'ADMIN',0,'group_expiry','Vehicle Group Expired: Group A','Vehicle group \'Group A\' validity expired on 07-03-2026. Immediate attention required.',NULL,0,'2026-03-09 03:13:40',0,NULL),(136,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-09 03:25:49',0,NULL),(137,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-09 03:25:49',0,NULL),(138,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #23 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-09 03:35:27',0,NULL),(139,'ADMIN',0,'trip_started','Trip Started','Trip for request #23 by faculty1 has started.',NULL,0,'2026-03-09 03:36:46',0,NULL),(140,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #23 by faculty1 has been completed.',NULL,0,'2026-03-09 03:37:15',0,NULL),(141,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #25 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-09 05:22:55',0,NULL),(142,'ADMIN',0,'trip_started','Trip Started','Trip for request #25 by faculty1 has started.',NULL,0,'2026-03-09 05:24:43',0,NULL),(143,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #25 by faculty1 has been completed.',NULL,0,'2026-03-09 05:25:23',0,NULL),(144,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #26 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-09 06:52:01',0,NULL),(145,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-10 03:23:13',0,NULL),(146,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-10 03:23:13',0,NULL),(147,'ADMIN',0,'trip_started','Trip Started','Trip for request #26 by faculty1 has started.',NULL,0,'2026-03-10 04:56:15',0,NULL),(148,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #26 by faculty1 has been completed.',NULL,0,'2026-03-10 04:56:39',0,NULL),(149,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #27 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-10 05:57:13',0,NULL),(150,'DRIVER',2,'leave','Leave Request Rejected','Your leave request from 09-03-2026 to 09-03-2026 has been rejected. Reason: ',19,1,'2026-03-10 08:40:52',0,NULL),(151,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle TN-36-GN-7894: Brake Noise (Severity: low)',18,0,'2026-03-10 09:11:28',0,NULL),(152,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-11 03:23:14',0,NULL),(153,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-11 03:23:14',0,NULL),(154,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #30 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-11 05:09:23',0,NULL),(155,'DRIVER',2,'warning','Vehicle Request Cancelled','Vehicle request #30 for \"avav\" has been cancelled by admin. Your assignment to vehicle BUS-1 has been removed. Reason: Sorry',30,1,'2026-03-11 05:35:46',0,NULL),(156,'FACULTY',97,'warning','Vehicle Request Cancelled','Your vehicle request #30 for \"avav\" has been cancelled by admin. Reason: Sorry',30,0,'2026-03-11 05:35:46',0,NULL),(157,'DRIVER',2,'warning','Vehicle Request Cancelled','Vehicle request #27 for \"I adfadf\" has been cancelled by admin. Your assignment to vehicle Inova-1 has been removed. Reason: sorry',27,1,'2026-03-11 05:36:26',0,NULL),(158,'FACULTY',97,'warning','Vehicle Request Cancelled','Your vehicle request #27 for \"I adfadf\" has been cancelled by admin. Reason: sorry',27,0,'2026-03-11 05:36:26',0,NULL),(159,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #32 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-11 05:52:22',0,NULL),(160,'ADMIN',0,'trip_started','Trip Started','Vehicle request #32 trip started by admin override for faculty1.',NULL,0,'2026-03-11 05:59:51',0,NULL),(161,'ADMIN',0,'trip_completed','Trip Completed','Vehicle request #32 trip ended by admin override for faculty1.',NULL,0,'2026-03-11 06:00:04',0,NULL),(162,'ADMIN',0,'service_reported','New Service Request','Driver Driver1 reported an issue for vehicle CAR-5S-02: dasds (Severity: low)',19,0,'2026-03-11 06:01:01',0,NULL),(163,'DRIVER',67,'service_rejected','Service Request Rejected','Your service request \'dasds\' has been rejected. Reason: ',NULL,0,'2026-03-11 06:01:26',0,NULL),(164,'DRIVER',0,'vehicle_change','Vehicle Replacement','Your vehicle TN34E7162 is going for insurance_renewal from 2026-03-11 to 2026-03-12. You have been assigned TN36JC2026 for 2 days. Your original vehicle will be reassigned after this period.',7,0,'2026-03-11 06:15:13',0,NULL),(165,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-12 03:10:49',0,NULL),(166,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-12 03:10:49',0,NULL),(167,'DRIVER',0,'info','Replacement Cancelled','The replacement for TN34E7162 has been cancelled by admin.',NULL,0,'2026-03-12 04:43:11',0,NULL),(168,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-13 03:21:03',0,NULL),(169,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-13 03:21:03',0,NULL),(170,'DRIVER',9,'leave','Leave Request Approved','Your leave request from 13-03-2026 to 14-03-2026 has been approved. Attendance will be automatically marked as absent.',21,0,'2026-03-13 03:27:23',0,NULL),(171,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-14 03:24:01',0,NULL),(172,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 14-03-2026. Please review and renew.',NULL,0,'2026-03-14 03:24:01',0,NULL),(173,'DRIVER',9,'leave','Leave Request Rejected','Your leave request from 13-03-2026 to 13-03-2026 has been rejected. Reason: ',22,0,'2026-03-14 05:36:21',0,NULL),(174,'ADMIN',0,'group_expiry','Driver Group Expired: Group A','Driver group \'Group A\' validity expired on 14-03-2026. Immediate attention required.',NULL,0,'2026-03-16 03:17:14',0,NULL),(175,'ADMIN',0,'group_expiry','Vehicle Group Expired: EV Group A','Vehicle group \'EV Group A\' validity expired on 14-03-2026. Immediate attention required.',NULL,0,'2026-03-16 03:17:14',0,NULL),(176,'ADMIN',0,'vehicle_assigned','Vehicle Assigned','Vehicle assigned to request #34 by faculty1. Start OTP sent to requester.',NULL,0,'2026-03-16 03:17:42',0,NULL),(177,'ADMIN',0,'trip_started','Trip Started','Trip for request #34 by faculty1 has started.',NULL,0,'2026-03-16 03:19:05',0,NULL),(178,'ADMIN',0,'trip_completed','Trip Completed','Trip for request #34 by faculty1 has been completed.',NULL,0,'2026-03-16 03:19:27',0,NULL),(179,'ADMIN',0,'group_expiry','Driver Group Expiring: Group A','Driver group \'Group A\' validity expires on 21-03-2026. Please review and renew.',NULL,0,'2026-03-16 03:35:40',0,NULL),(180,'ADMIN',0,'group_expiry','Vehicle Group Expiring: EV Group A','Vehicle group \'EV Group A\' validity expires on 21-03-2026. Please review and renew.',NULL,0,'2026-03-16 03:35:40',0,NULL),(181,'DRIVER',2,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for service_repair from 2026-03-16 to 2026-03-16. You have been assigned TN-36-GN-8877 for 1 days. Your original vehicle will be reassigned after this period.',8,0,'2026-03-16 03:48:47',0,NULL),(182,'DRIVER',2,'vehicle_change','Vehicle Back - Replacement Ended','Your original vehicle TN-36-GN-7894 is back from service_repair. The temporary replacement has ended.',8,0,'2026-03-16 04:09:18',0,NULL),(183,'ADMIN',0,'replacement_completed','Vehicle Replacement Completed','Vehicle TN-36-GN-7894 is back from service_repair. Driver Driver1 reassigned to original vehicle.',NULL,0,'2026-03-16 04:09:18',0,NULL),(184,'DRIVER',2,'vehicle_change','Vehicle Replacement','Your vehicle TN-36-GN-7894 is going for fc_renewal from 2026-03-16 to 2026-03-16. You have been assigned TN36AB1234 for 1 days. Your original vehicle will be reassigned after this period.',9,0,'2026-03-16 04:14:00',0,NULL),(185,'DRIVER',2,'info','Replacement Cancelled','The replacement for TN-36-GN-7894 has been cancelled by admin.',NULL,0,'2026-03-16 05:14:49',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
INSERT INTO `parts_purchased` VALUES (5,1,6,'Suspension',2,2,88425.00,176850.00,8,'INV-1021',NULL,'received','2026-02-23','2026-02-23',NULL,NULL,1,'2026-02-23 10:02:46','repair_service',20,0,NULL),(6,1,6,'Suspension Greeze',2,5,2200.00,11000.00,3,'INV-1021',NULL,'received','2026-02-23','2026-02-23','2026-02-23',NULL,1,'2026-02-23 10:02:46','repair_service',20,0,NULL),(10,4,10,'Oil',3,1,850.00,850.00,0,'INV-1425','2026-02-24','received','2026-02-24','2026-02-24',NULL,NULL,1,'2026-02-24 05:46:24','repair_service',22,0,NULL),(11,5,NULL,'Uniform Shirt',4,12,550.00,6600.00,0,'INV-1012','2026-02-24','pending','2026-02-24',NULL,NULL,NULL,1,'2026-02-24 10:32:08','general',NULL,0,NULL),(12,5,NULL,'Uniform Pant',4,12,850.00,10200.00,0,'INV-1012','2026-02-24','pending','2026-02-24',NULL,NULL,NULL,1,'2026-02-24 10:32:08','general',NULL,0,NULL),(13,6,NULL,'Oil',3,8,500.00,4000.00,0,'INV-14250','2026-02-24','received','2026-02-24','2026-03-16',NULL,NULL,1,'2026-02-24 10:52:26','vehicle',NULL,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
INSERT INTO `purchase_invoices` VALUES (3,1,'invoice_1_1771843987622376900.pdf','Transport App.pdf','pdf',223364,'Documents\\Purchase\\invoice_1_1771843987622376900.pdf',1,'2026-02-23 10:53:07','2026-02-23 10:53:07',0,NULL),(5,4,'invoice_4_1771911984290374400.pdf','7376242AL210 - UI003.pdf','pdf',403497,'Documents\\Purchase\\invoice_4_1771911984290374400.pdf',1,'2026-02-24 05:46:24','2026-02-24 05:46:24',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
INSERT INTO `purchase_orders` VALUES (1,6,2,'INV-1021',NULL,'received','2026-02-23','2026-02-23',NULL,NULL,NULL,1,'2026-02-23 10:02:46','2026-02-24 09:52:15','repair_service',20,0,NULL),(4,10,3,'INV-1425','2026-02-24','received','2026-02-24','2026-02-24',NULL,NULL,NULL,1,'2026-02-24 05:46:24','2026-02-24 09:52:15','repair_service',22,0,NULL),(5,NULL,4,'INV-1012','2026-02-24','pending','2026-02-24',NULL,NULL,NULL,'Uniform For Drivers',1,'2026-02-24 10:32:08','2026-02-24 10:32:08','general',NULL,0,NULL),(6,NULL,3,'INV-14250','2026-02-24','received','2026-02-24','2026-03-16',NULL,NULL,'For safety',1,'2026-02-24 10:52:26','2026-03-16 04:17:44','vehicle',NULL,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `assigned_to_admin` (`assigned_to_admin`),
  KEY `idx_service_records_vehicle` (`vehicle_id`),
  KEY `idx_service_records_status` (`status`),
  KEY `idx_service_records_reported_by` (`reported_by`),
  KEY `idx_service_records_scheduled` (`scheduled_date`),
  CONSTRAINT `service_records_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_records_ibfk_3` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_records_ibfk_4` FOREIGN KEY (`assigned_to_admin`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_records`
--

LOCK TABLES `service_records` WRITE;
/*!40000 ALTER TABLE `service_records` DISABLE KEYS */;
INSERT INTO `service_records` VALUES (6,20,NULL,1,'Suspension Broken','Suspension broken because of the heavy lifting','medium','completed',NULL,'2026-02-23','2026-02-23 10:17:52','2026-02-23 10:19:23','BIT','Sundharam','',0.00,187850.00,187850.00,'2026-06-23',20100,'BIT',NULL,'2026-02-23 09:41:03','2026-02-24 03:22:17',0,NULL),(10,22,NULL,1,'Testing','Testing','medium','completed',NULL,'2026-02-24','2026-02-24 05:45:33','2026-02-24 05:46:55','','','',450.00,850.00,1300.00,'2026-02-24',0,'',NULL,'2026-02-24 05:25:04','2026-02-24 05:46:55',0,NULL),(11,8,67,1,'Front Wheel Dent','Accidentally crashed','low','completed',NULL,'2026-02-25','2026-02-24 05:42:41','2026-02-24 05:42:55','','','',500.00,0.00,500.00,'2026-02-25',0,'',NULL,'2026-02-24 05:27:37','2026-02-24 05:42:55',0,NULL),(17,22,NULL,1,'Broken Mirror','','medium','completed',NULL,'2026-03-10','2026-03-10 08:47:47','2026-03-10 08:48:08','BIT','Muthukumar','',400.00,0.00,400.00,NULL,0,'',NULL,'2026-03-10 08:47:15','2026-03-10 08:48:08',0,NULL),(18,1,67,1,'Brake Noise','I dont why this noise comes from','low','approved',NULL,'2026-03-10',NULL,NULL,NULL,NULL,NULL,0.00,0.00,0.00,NULL,NULL,'',NULL,'2026-03-10 09:11:28','2026-03-10 09:11:41',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_types`
--

LOCK TABLES `service_types` WRITE;
/*!40000 ALTER TABLE `service_types` DISABLE KEYS */;
INSERT INTO `service_types` VALUES (1,'Oil Change','Engine oil and oil filter replacement',1.00,1,'2026-02-16 09:04:21',0,NULL),(2,'Brake Service','Brake pad and disc inspection/replacement',2.00,1,'2026-02-16 09:04:21',0,NULL),(3,'Tyre Replacement','Tyre change, alignment and balancing',1.50,1,'2026-02-16 09:04:21',0,NULL),(4,'Engine Overhaul','Major engine repair and rebuilding',24.00,1,'2026-02-16 09:04:21',0,NULL),(5,'Battery Service','Battery testing, charging or replacement',0.50,1,'2026-02-16 09:04:21',0,NULL),(6,'AC Repair','Air conditioning system repair and gas refill',3.00,1,'2026-02-16 09:04:21',0,NULL),(7,'Body Repair','Dent removal, painting and body work',8.00,1,'2026-02-16 09:04:21',0,NULL),(8,'General Maintenance','Routine inspection and preventive maintenance',2.00,1,'2026-02-16 09:04:21',0,NULL),(9,'Electrical Repair','Wiring, lights, starter and alternator repair',3.00,1,'2026-02-16 09:04:21',0,NULL),(10,'Accident Repair','Post-accident repair and restoration',48.00,1,'2026-02-16 09:04:21',0,NULL),(11,'Clutch Service','Clutch plate and pressure plate replacement',4.00,1,'2026-02-16 09:04:21',0,NULL),(12,'Suspension Repair','Shock absorber and suspension system repair',3.00,1,'2026-02-16 09:04:21',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `shift_id` (`shift_id`),
  KEY `idx_shift_slots_created_by` (`created_by`),
  CONSTRAINT `fk_shift_slots_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `shift_slots_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_slots`
--

LOCK TABLES `shift_slots` WRITE;
/*!40000 ALTER TABLE `shift_slots` DISABLE KEYS */;
INSERT INTO `shift_slots` VALUES (30,35,'06:45:00','08:45:00',1,1,0,NULL),(31,36,'16:45:00','19:30:00',1,1,0,NULL),(32,37,'09:00:00','10:30:00',1,1,0,NULL),(33,38,'10:31:00','11:45:00',1,1,0,NULL),(34,39,'12:30:00','14:00:00',1,1,0,NULL),(35,40,'14:00:00','16:50:00',1,1,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `shifts_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (35,'Morning shift','06:45:00','08:45:00','bus shift',1,'2026-02-27 03:46:55',0,NULL),(36,'Evening shift','16:45:00','19:30:00','Bus shift',1,'2026-02-27 03:47:46',0,NULL),(37,'A shift','09:00:00','10:30:00','EV-shift',1,'2026-02-27 03:48:30',0,NULL),(38,'B-shift','10:31:00','11:45:00','EV-shift',1,'2026-02-27 03:48:57',0,NULL),(39,'C-Shift','12:30:00','14:00:00','EV-Shift',1,'2026-02-27 03:49:39',0,NULL),(40,'D-shift','14:00:00','16:50:00','EV-shift',1,'2026-02-27 03:50:14',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
INSERT INTO `stop_change_requests` (`id`, `student_transport_id`, `current_stop_id`, `requested_stop_id`, `current_fee`, `new_fee`, `reason`, `status`, `admin_remarks`, `processed_by`, `processed_at`, `created_at`, `is_deleted`, `deleted_at`) VALUES (16,13,7,8,10000.00,10000.00,'','approved','',1,'2026-03-03 10:47:48','2026-03-03 10:47:28',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stops`
--

LOCK TABLES `stops` WRITE;
/*!40000 ALTER TABLE `stops` DISABLE KEYS */;
INSERT INTO `stops` VALUES (1,'College Main Gate','BIT Campus Entrance','2026-01-06 03:53:03',0,NULL),(2,'Sathyamangalam Bus Stand','Central Bus Station','2026-01-06 03:53:03',0,NULL),(3,'Railway Station','Sathy Railway Junction','2026-01-06 03:53:03',0,NULL),(4,'Gobichettipalayam','Gobi Bus Stand','2026-01-06 03:53:03',0,NULL),(5,'Bhavani','Bhavani Junction','2026-01-06 03:53:03',0,NULL),(6,'Erode Bus Stand','Erode Central','2026-01-06 03:53:03',0,NULL),(7,'Boys Hostel','BIT Boys Hostel Block','2026-01-06 03:53:03',0,NULL),(8,'Girls Hostel','BIT Girls Hostel Block','2026-01-06 03:53:03',0,NULL),(9,'Staff Quarters','Faculty Residence Area','2026-01-06 03:53:03',0,NULL),(10,'Library','Central Library','2026-01-06 03:53:03',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_year` (`user_id`,`academic_year`),
  KEY `bus_id` (`bus_id`),
  KEY `idx_st_user` (`user_id`),
  CONSTRAINT `student_transport_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_transport_ibfk_2` FOREIGN KEY (`bus_id`) REFERENCES `buses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_transport`
--

LOCK TABLES `student_transport` WRITE;
/*!40000 ALTER TABLE `student_transport` DISABLE KEYS */;
INSERT INTO `student_transport` (`id`, `user_id`, `bus_id`, `stop_id`, `transport_fee_id`, `total_fee`, `paid_amount`, `academic_year`, `status`, `created_at`, `updated_at`, `is_deleted`, `deleted_at`) VALUES (12,82,4,13,NULL,20000.00,20000.00,'2025-2026','active','2026-03-03 10:02:11','2026-03-11 04:23:01',0,NULL),(13,81,1,8,NULL,10000.00,0.00,'2026-2027','active','2026-03-03 10:46:52','2026-03-03 10:47:48',0,NULL),(15,78,2,16,NULL,25000.00,0.00,'2024-2025','active','2026-03-14 06:28:07','2026-03-14 06:28:07',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `temporary_assignments`
--

LOCK TABLES `temporary_assignments` WRITE;
/*!40000 ALTER TABLE `temporary_assignments` DISABLE KEYS */;
INSERT INTO `temporary_assignments` VALUES (19,2,4,36,1,'2026-03-16','2026-03-16','','driver_replacement',NULL,'active','2026-03-16 03:46:50',1,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
  `payment_type` varchar(20) NOT NULL DEFAULT 'payment',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_transport_id` (`student_transport_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `transport_payments_ibfk_1` FOREIGN KEY (`student_transport_id`) REFERENCES `student_transport` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_payments_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transport_payments`
--

LOCK TABLES `transport_payments` WRITE;
/*!40000 ALTER TABLE `transport_payments` DISABLE KEYS */;
INSERT INTO `transport_payments` VALUES (4,12,2000.00,'2026-03-03','cash','','','',1,'2026-03-03 10:02:46','payment',0,NULL),(5,12,1010.00,'2026-03-03','cash','','','',1,'2026-03-03 10:02:59','payment',0,NULL),(6,12,853620.00,'2026-03-03','cash','','','',1,'2026-03-03 10:03:08','payment',0,NULL),(8,12,836630.00,'2026-03-11','cash','','','',1,'2026-03-11 04:23:01','refund',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `bus_id` (`bus_id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_tr_user` (`user_id`,`status`),
  CONSTRAINT `transport_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_requests_ibfk_2` FOREIGN KEY (`bus_id`) REFERENCES `buses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transport_requests_ibfk_3` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transport_requests`
--

LOCK TABLES `transport_requests` WRITE;
/*!40000 ALTER TABLE `transport_requests` DISABLE KEYS */;
INSERT INTO `transport_requests` VALUES (5,81,1,7,'2026-2027','','approved','',1,'2026-03-03 10:46:52','2026-03-03 10:24:43','2026-03-03 10:46:52',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
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
  `username` varchar(100) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `role` enum('ADMIN','DRIVER','INCHARGE','STUDENT','FACULTY') NOT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `password` varchar(255) DEFAULT 'password',
  `department` varchar(100) DEFAULT NULL,
  `year` int DEFAULT '0',
  `roll_number` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','Transport Admin','9999999999','admin@transport.com','ADMIN',NULL,'2026-01-05 06:52:32','2026-02-02 06:03:38','password',NULL,0,NULL,'active',0,NULL),(67,'driver1','Driver1','9876543211','gopal@gmail.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-12 06:21:54','password',NULL,0,NULL,'present',0,NULL),(69,'driver2','Driver2','9876543213','murugan_k@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:45','password',NULL,0,NULL,'present',0,NULL),(71,'driver3','Driver3','9876543215','senthil_v@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:46','password',NULL,0,NULL,'present',0,NULL),(72,'driver4','Driver4','9876543216','kumar_s@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:48','password',NULL,0,NULL,'present',0,NULL),(74,'driver5','Driver5','9876543218','arun_p@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-02 05:11:49','password',NULL,0,NULL,'present',0,NULL),(75,'driver6','Driver6','9876543219','bala_k@transport.com','DRIVER',NULL,'2026-01-06 03:53:04','2026-03-16 03:36:13','password',NULL,0,NULL,'present',0,NULL),(76,'driver7','Driver7','7894561230','ganesha@gmail.com','DRIVER',NULL,'2026-01-06 11:18:48','2026-03-16 03:36:13','password',NULL,0,NULL,'present',0,NULL),(78,'student5','Student5','9876543210','john.doe@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Computer Science',3,'CS2023001','active',0,NULL),(79,'student4','Student4','9876543211','jane.smith@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Electronics',2,'EC2024015','active',0,NULL),(80,'student3','Student3','9876543212','mike.wilson@bit.edu','STUDENT',NULL,'2026-01-20 09:24:17','2026-01-31 06:29:04','password','Mechanical',4,'ME2022042','active',0,NULL),(81,'student1','Student1','9874561230','student1@gmail.com','STUDENT',NULL,'2026-01-28 09:19:38',NULL,'password','AIDS',2,'2024UAD1010','active',0,NULL),(82,'student2','Student2','7418529630','student2@gmail.com','STUDENT',NULL,'2026-01-28 10:01:07','2026-01-31 06:29:04','password','AIML',1,'2025UAL1023','active',0,NULL),(95,'driver8','Driver-08','7418529630','driver8@gmail.com','DRIVER',NULL,'2026-01-31 08:28:32','2026-03-16 05:08:40','password',NULL,0,NULL,'absent',0,NULL),(96,'driver9','Driver-09','7418529630','driver9@gmail.com','DRIVER',NULL,'2026-01-31 08:29:47','2026-03-12 06:21:54','password',NULL,0,NULL,'present',0,NULL),(97,'faculty1','faculty1','9876543201','rajesh@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-12 04:10:50','password',NULL,0,NULL,'active',0,NULL),(98,'faculty2','Dr. Priya Sharma','9876543202','priya@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active',0,NULL),(99,'faculty3','Dr. Anil Verma','9876543203','anil@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active',0,NULL),(100,'faculty4','Dr. Sunita Patel','9876543204','sunita@bit.edu','FACULTY',NULL,'2026-02-03 04:15:12','2026-02-03 08:30:23','password',NULL,0,NULL,'active',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_doc` (`vehicle_id`,`document_type`),
  KEY `idx_changed_at` (`changed_at`),
  CONSTRAINT `vehicle_document_audit_log_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_document_audit_log`
--

LOCK TABLES `vehicle_document_audit_log` WRITE;
/*!40000 ALTER TABLE `vehicle_document_audit_log` DISABLE KEYS */;
INSERT INTO `vehicle_document_audit_log` VALUES (16,6,'insurance','start_date',NULL,'04-03-2026',1,'admin','2026-03-04 05:19:09',0,NULL),(17,6,'insurance','expire_date','14-05-2026','28-11-2030',1,'admin','2026-03-04 05:19:09',0,NULL),(18,6,'insurance','remarks',NULL,'testing',1,'admin','2026-03-04 05:19:09',0,NULL),(19,6,'fc','start_date',NULL,'04-03-2026',1,'admin','2026-03-04 05:19:09',0,NULL),(20,6,'fc','expire_date','06-08-2027','06-12-2030',1,'admin','2026-03-04 05:19:09',0,NULL),(21,6,'fc','remarks',NULL,'testing',1,'admin','2026-03-04 05:19:09',0,NULL),(22,6,'permit','start_date',NULL,'04-03-2026',1,'admin','2026-03-04 05:19:09',0,NULL),(23,6,'permit','expire_date','13-08-2029','31-12-2033',1,'admin','2026-03-04 05:19:09',0,NULL),(24,6,'permit','remarks',NULL,'testing',1,'admin','2026-03-04 05:19:09',0,NULL),(31,24,'insurance','start_date',NULL,'09-03-2026',1,'admin','2026-03-09 09:07:07',0,NULL),(32,24,'insurance','expire_date',NULL,'09-12-2030',1,'admin','2026-03-09 09:07:07',0,NULL),(33,24,'fc','start_date',NULL,'09-03-2026',1,'admin','2026-03-09 09:07:07',0,NULL),(34,24,'fc','expire_date',NULL,'09-12-2030',1,'admin','2026-03-09 09:07:07',0,NULL),(35,24,'permit','start_date',NULL,'09-03-2026',1,'admin','2026-03-09 09:07:07',0,NULL),(36,24,'permit','expire_date',NULL,'31-12-2030',1,'admin','2026-03-09 09:07:07',0,NULL);
/*!40000 ALTER TABLE `vehicle_document_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_document_types`
--

DROP TABLE IF EXISTS `vehicle_document_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_document_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_mandatory` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_name` (`document_name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_document_types`
--

LOCK TABLES `vehicle_document_types` WRITE;
/*!40000 ALTER TABLE `vehicle_document_types` DISABLE KEYS */;
INSERT INTO `vehicle_document_types` VALUES (1,'RC','Registration Certificate',1,'2026-03-14 04:46:26',0,NULL),(2,'FC','Fitness Certificate',1,'2026-03-14 04:46:26',0,NULL),(3,'Insurance','',1,'2026-03-14 04:46:26',0,NULL),(4,'Permit',NULL,0,'2026-03-14 04:46:26',0,NULL),(5,'Green Tax',NULL,0,'2026-03-14 04:46:26',0,NULL),(6,'MV Tax',NULL,0,'2026-03-14 04:46:26',0,NULL),(7,'PUC','Pollution Under Control',0,'2026-03-14 04:48:11',0,NULL);
/*!40000 ALTER TABLE `vehicle_document_types` ENABLE KEYS */;
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
  `document_type_id` int NOT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `issue_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('valid','expired','pending') DEFAULT 'pending',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_vehicle_document_vehicle` (`vehicle_id`),
  KEY `fk_vehicle_document_type` (`document_type_id`),
  KEY `fk_vehicle_document_user` (`uploaded_by`),
  CONSTRAINT `fk_vehicle_document_type` FOREIGN KEY (`document_type_id`) REFERENCES `vehicle_document_types` (`id`),
  CONSTRAINT `fk_vehicle_document_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_vehicle_document_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_documents`
--

LOCK TABLES `vehicle_documents` WRITE;
/*!40000 ALTER TABLE `vehicle_documents` DISABLE KEYS */;
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `vehicle_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `vehicle_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vehicle_group_members_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vehicle_group_members_chk_1` CHECK ((`valid_from` <= `valid_to`))
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_group_members`
--

LOCK TABLES `vehicle_group_members` WRITE;
/*!40000 ALTER TABLE `vehicle_group_members` DISABLE KEYS */;
INSERT INTO `vehicle_group_members` VALUES (54,22,6,'2026-03-15','2026-03-21','2026-03-16 03:28:52',0,NULL),(55,22,21,'2026-03-15','2026-03-21','2026-03-16 03:28:52',0,NULL),(56,22,22,'2026-03-15','2026-03-21','2026-03-16 03:28:52',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_groups`
--

LOCK TABLES `vehicle_groups` WRITE;
/*!40000 ALTER TABLE `vehicle_groups` DISABLE KEYS */;
INSERT INTO `vehicle_groups` VALUES (22,'EV Group A','','2026-03-15','2026-03-21','2026-03-09 03:22:53','2026-03-16 03:28:52',0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vr_vehicle` (`vehicle_id`),
  KEY `idx_vr_replacement` (`replacement_vehicle_id`),
  KEY `idx_vr_driver` (`driver_id`),
  KEY `idx_vr_status` (`status`),
  KEY `idx_vr_service` (`service_record_id`),
  KEY `idx_vr_replacement_driver` (`replacement_driver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_replacements`
--

LOCK TABLES `vehicle_replacements` WRITE;
/*!40000 ALTER TABLE `vehicle_replacements` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_replacements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_request_trips`
--

DROP TABLE IF EXISTS `vehicle_request_trips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_request_trips` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `trip_order` tinyint NOT NULL DEFAULT '1',
  `from_place` varchar(255) NOT NULL,
  `to_place` varchar(255) NOT NULL,
  `from_datetime` datetime NOT NULL,
  `to_datetime` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_request_trip_order` (`request_id`,`trip_order`),
  KEY `idx_vrt_request_id` (`request_id`),
  KEY `idx_vrt_from_datetime` (`from_datetime`),
  CONSTRAINT `fk_vrt_request` FOREIGN KEY (`request_id`) REFERENCES `vehiclerequests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_request_trips`
--

LOCK TABLES `vehicle_request_trips` WRITE;
/*!40000 ALTER TABLE `vehicle_request_trips` DISABLE KEYS */;
INSERT INTO `vehicle_request_trips` VALUES (18,34,1,'dafd','adfadf','2026-03-14 04:53:00','2026-03-14 15:53:00','2026-03-14 10:23:35',0,NULL),(19,35,1,'BIT','Covai','2026-03-16 06:00:00','2026-03-16 08:00:00','2026-03-16 03:25:29',0,NULL),(20,35,2,'Covai','BIT','2026-03-16 10:00:00','2026-03-16 12:00:00','2026-03-16 03:25:29',0,NULL);
/*!40000 ALTER TABLE `vehicle_request_trips` ENABLE KEYS */;
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  KEY `idx_vst_vehicle` (`vehicle_id`),
  CONSTRAINT `vehicle_service_tracking_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_service_tracking`
--

LOCK TABLES `vehicle_service_tracking` WRITE;
/*!40000 ALTER TABLE `vehicle_service_tracking` DISABLE KEYS */;
INSERT INTO `vehicle_service_tracking` VALUES (1,12,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(2,7,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(3,8,0,10000,'2026-02-24',NULL,NULL,'2026-02-17 04:04:45','2026-02-24 05:42:55',0,NULL),(4,10,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(5,11,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(6,5,0,101,NULL,NULL,'','2026-02-17 04:04:45','2026-02-17 04:17:41',0,NULL),(7,6,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(8,21,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(9,18,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(10,4,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(11,3,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(12,1,0,300,'2026-03-10',NULL,'','2026-02-17 04:04:45','2026-03-10 08:45:27',0,NULL),(13,2,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(14,22,0,10000,'2026-03-10',NULL,NULL,'2026-02-17 04:04:45','2026-03-10 08:48:08',0,NULL),(15,20,0,10000,'2026-02-23',NULL,NULL,'2026-02-17 04:04:45','2026-02-23 10:19:23',0,NULL),(16,19,0,10000,NULL,NULL,NULL,'2026-02-17 04:04:45','2026-02-17 04:04:45',0,NULL),(33,24,0,10000,NULL,NULL,NULL,'2026-03-10 08:45:31','2026-03-10 08:45:31',0,NULL),(34,30,0,10000,NULL,NULL,NULL,'2026-03-13 06:42:00','2026-03-13 06:42:00',0,NULL),(35,31,0,10000,NULL,NULL,NULL,'2026-03-13 06:42:00','2026-03-13 06:42:00',0,NULL),(36,32,0,10000,NULL,NULL,NULL,'2026-03-13 06:42:00','2026-03-13 06:42:00',0,NULL);
/*!40000 ALTER TABLE `vehicle_service_tracking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_types`
--

DROP TABLE IF EXISTS `vehicle_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  `label` varchar(50) DEFAULT NULL,
  `is_active` int DEFAULT '1',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_UNIQUE` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_types`
--

LOCK TABLES `vehicle_types` WRITE;
/*!40000 ALTER TABLE `vehicle_types` DISABLE KEYS */;
INSERT INTO `vehicle_types` VALUES (1,'BUS','College Bus',1,0,NULL),(2,'CAR','Car',1,0,NULL),(3,'BATTERY_VEHICLE','Battery Vehicle',1,0,NULL),(4,'OTHER','Others',1,0,NULL);
/*!40000 ALTER TABLE `vehicle_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehiclerequests`
--

DROP TABLE IF EXISTS `vehiclerequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehiclerequests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requester_id` int DEFAULT NULL,
  `BookingType` varchar(255) NOT NULL,
  `TripType` varchar(255) NOT NULL,
  `OnwardFromPlace` varchar(255) DEFAULT NULL,
  `OnwardToPlace` varchar(255) DEFAULT NULL,
  `OnwardFromDateTime` datetime DEFAULT NULL,
  `OnwardTodateTime` datetime DEFAULT NULL,
  `CountPerson` int DEFAULT NULL,
  `PurposeOfVisit` text,
  `TravellerName` varchar(255) DEFAULT NULL,
  `Address` text,
  `MobileNumber` varchar(50) DEFAULT NULL,
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
  `Guestname` varchar(255) DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vr_status` (`status`),
  KEY `idx_vr_faculty` (`faculty_id`),
  KEY `idx_vehiclerequests_requester_id` (`requester_id`),
  CONSTRAINT `fk_vehiclerequests_requester_user` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehiclerequests`
--

LOCK TABLES `vehiclerequests` WRITE;
/*!40000 ALTER TABLE `vehiclerequests` DISABLE KEYS */;
INSERT INTO `vehiclerequests` VALUES (34,97,'faculty','guest_drop','dafd','adfadf','2026-03-14 04:53:00','2026-03-14 15:53:00',1,'adfad','adfadf','','4158852','dfaf','2026-03-14 10:23:35','adfad','faculty1','9876543201',7,9,'','completed',1,'students_training',1,'2026-03-16 08:47:42','2026-03-16 08:47:42','851586','252292','2026-03-16 03:17:42','2026-03-16 03:19:05','2026-03-16 03:19:05','2026-03-16 03:19:27','GURUGULAM',NULL,0,NULL),(35,97,'faculty','round_trip','BIT','Covai','2026-03-16 06:00:00','2026-03-16 08:00:00',5,'Faculty Staff visit','Mr Guna','','123654789','TA4512','2026-03-16 03:25:29','Faculty Staff visit','faculty1','9876543201',NULL,NULL,NULL,'pending',1,'supporting_department',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Administrative Purpose',NULL,0,NULL);
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
  `fuel_type` enum('PETROL','DIESEL','EV','CNG','OTHER') NOT NULL DEFAULT 'DIESEL',
  `seating_capacity` int DEFAULT '0',
  `status` varchar(50) DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `chassis_number` varchar(100) DEFAULT NULL,
  `engine_number` varchar(100) DEFAULT NULL,
  `permit_number` varchar(100) DEFAULT NULL,
  `additional_permit` varchar(255) DEFAULT NULL,
  `insurance_amount` decimal(12,2) DEFAULT NULL,
  `road_tax_amount` decimal(12,2) DEFAULT NULL,
  `pollution_expire` date DEFAULT NULL,
  `green_tax_expire` date DEFAULT NULL,
  `mv_tax_expire` date DEFAULT NULL,
  `insurance_expire_date` date DEFAULT NULL,
  `insurance_start_date` date DEFAULT NULL,
  `fc_expire_date` date DEFAULT NULL,
  `fc_start_date` date DEFAULT NULL,
  `permit_expire_date` date DEFAULT NULL,
  `permit_start_date` date DEFAULT NULL,
  `vehicle_type_id` int NOT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_number` (`vehicle_number`),
  KEY `idx_vehicles_vehicle_type_id` (`vehicle_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
INSERT INTO `vehicles` VALUES (1,'BUS-1','TN-36-GN-7894','DIESEL',52,'active','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-08-06',NULL,'2028-03-11',NULL,1,0,NULL),(2,'BUS-4','TN-36-GN-8877','DIESEL',52,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-07-14',NULL,'2028-05-29',NULL,1,0,NULL),(3,'BUS-3','TN-36-GN-1996','DIESEL',45,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-07-16',NULL,'2028-05-29',NULL,1,0,NULL),(4,'BUS-2','TN-36-GN-1995','CNG',40,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-07-21',NULL,'2028-06-06',NULL,1,0,NULL),(5,'EV-01','EV-01','EV',12,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-05',NULL,'2027-07-07',NULL,'2029-01-10',NULL,3,0,NULL),(6,'EV-02','EV-02','EV',12,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-11-28','2026-03-04','2030-12-06','2026-03-04','2033-12-31','2026-03-04',3,0,NULL),(7,'Inova-1','CAR-5S-01','PETROL',5,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-01-30','2026-03-04','2030-01-30','2026-03-04','2030-01-30','2026-03-04',2,0,NULL),(8,'Inova-2','CAR-5S-02','PETROL',5,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-11-30','2026-03-16','2030-12-28','2026-03-19','2030-11-08','2026-05-08',2,0,NULL),(10,'Inova-3','CAR-7S-01','DIESEL',7,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-07-07',NULL,'2026-12-04',NULL,2,0,NULL),(11,'Inova-4','CAR-7S-02','DIESEL',7,'active','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-12-26',NULL,'2028-10-26',NULL,2,0,NULL),(12,'Ambulance01','AMBULANCE-01','DIESEL',4,'available','2026-01-06 03:53:03',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-30',NULL,'2026-12-12',NULL,'2028-10-26',NULL,4,0,NULL),(18,'BUS-5','TN-36-GN-1988','PETROL',40,'available','2026-01-07 06:06:45',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-11-29',NULL,'2030-11-29',NULL,'2030-11-29',NULL,1,0,NULL),(19,'Truck','TRUCK','PETROL',0,'available','2026-01-08 04:48:29',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-12-31',NULL,'2030-12-31',NULL,'2027-03-20',NULL,4,0,NULL),(20,'JCB','TN36JC2026','DIESEL',0,'available','2026-02-02 04:02:32',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-12-31',NULL,'2030-12-31',NULL,'2026-12-31',NULL,4,0,NULL),(21,'EV-03','EV-03','EV',12,'available','2026-02-02 08:36:05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2030-12-31',NULL,'2030-12-30',NULL,'2030-12-02',NULL,3,0,NULL),(22,'EV-04','TN36EV04','EV',12,'available','2026-02-02 08:36:58',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-28',NULL,'2030-10-23',NULL,'2030-11-23',NULL,3,0,NULL),(24,'JCB','JCB-1108','DIESEL',0,'available','2026-03-09 09:07:07','CHASIS451','ENGIN7845','TN7458211102','',25000.00,50000.00,'2030-11-28','2030-12-31','2030-12-24','2030-12-09','2026-03-09','2030-12-09','2026-03-09','2030-12-31','2026-03-09',4,0,NULL),(30,'BUS-11','TN36AB1234','DIESEL',52,'available','2026-03-13 06:36:03','CHASSIS001','ENG001','PERMIT001','Regional Permit',120000.00,30000.00,'2026-12-31','2027-03-31','2027-06-30','2026-12-31','2026-01-01','2027-01-01','2026-01-01','2026-12-31','2026-01-01',1,0,NULL),(31,'Crysta-07','TN36CD5678','PETROL',5,'available','2026-03-13 06:36:03','CHASSIS001','ENG001','PERMIT001',NULL,12045.00,40000.00,'2026-12-31','2026-12-31','2027-01-01','2027-01-01','2027-01-01','2027-01-01','2027-01-01','2026-12-31','2026-12-31',2,0,NULL),(32,'JCB','TN36JC7845','EV',1,'active','2026-03-13 06:36:03','CHASSIS001','ENG001','PERMIT001',NULL,12045.00,40000.00,'2026-12-31','2026-12-31','2027-01-01','2027-01-01','2027-01-01','2027-01-01','2027-01-01','2026-12-31','2026-12-31',4,0,NULL);
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
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vendor_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'ASM Seat covers','rv street,\nrkv road,\nErode','147258369','963258741','asmvendor@gmail.com',1,'2026-02-23 04:00:08','2026-02-23 04:00:08',0,NULL),(2,'JCB Parts','Thindal\nErode','7412589630','','',1,'2026-02-23 09:42:12','2026-02-23 09:42:12',0,NULL),(3,'Indian Oils','Sathyamangalam','7418529630','741852963','',1,'2026-02-23 12:40:56','2026-02-23 12:40:56',0,NULL),(4,'GAR Garment','tiruppur','7418529630','GST-142536','gar@gmail.com',1,'2026-02-24 10:30:29','2026-02-24 10:30:29',0,NULL);
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

-- Dump completed on 2026-03-16 13:52:34
