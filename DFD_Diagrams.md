# DATAFLOW DIAGRAMS — Transport Management System

---

## DATAFLOW DIAGRAM LEVEL-0

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]
    Student[/"**Student / Passenger**"\]

    System(("**Transport\nManagement\nSystem**"))

    Admin -- "Transport management data" --> System
    System -- "Reports and system status" --> Admin

    Student -- "Transport requests" --> System
    System -- "Route information and notifications" --> Student

    Driver -- "Trip and vehicle updates" --> System
    System -- "Route and schedule details" --> Driver
```

---

## DATAFLOW DIAGRAM LEVEL-1

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]
    Student[/"**Student / Staff**"\]

    P1(("**1.0**\nVehicle & Route\nManagement"))
    P2(("**2.0**\nDuty & Shift\nManagement"))
    P3(("**3.0**\nAttendance &\nLeave Management"))
    P4(("**4.0**\nVehicle Service\nManagement"))
    P5(("**5.0**\nStudent & Staff\nTransport"))

    D1[("Vehicle\nDetails")]
    D2[("Route & Shift\nData")]
    D3[("Duty & Leave\nData")]
    D4[("Vehicle Service\nData")]
    D5[("Student / Staff\nData")]

    Admin -- "Manage vehicles" --> P1
    Admin -- "Create / update routes" --> P1
    P1 -- "Stores" --> D1

    Admin -- "Assign shift and allot duties" --> P2
    P2 -- "Stores" --> D2
    Driver -- "View duties and shift" --> P2

    Admin -- "Approve / reject leave" --> P3
    Driver -- "Submit leave request" --> P3
    P3 -- "Stores" --> D3

    Admin -- "Request purchase / service" --> P4
    Driver -- "Report vehicle issue" --> P4
    P4 -- "Stores" --> D4

    Student -- "Request stop change / request vehicle booking" --> P5
    Admin -- "Process requests / assign transport" --> P5
    P5 -- "Stores" --> D5
```

---

## DATAFLOW DIAGRAM LEVEL-2

### 1.0 Vehicle & Route Management

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]

    P1(("**1.1**\nAdd / Update\nVehicle"))
    P2(("**1.2**\nView Vehicle\nDetails & Alerts"))
    P3(("**1.3**\nManage Bus\nRoutes & Stops"))
    P4(("**1.4**\nVehicle\nReplacement"))
    P5(("**1.5**\nDriver Cluster &\nVehicle Groups"))

    D1[("Vehicle\nData")]
    D2[("Bus Route &\nStop Data")]
    D3[("Replacement\nData")]
    D4[("Cluster &\nGroup Data")]

    Admin -- "Vehicle details" --> P1
    P1 -- "Stores / retrieves" --> D1
    Admin -- "Update vehicle details" --> P2
    P2 -- "Reads" --> D1
    Driver -- "View vehicle & alerts" --> P2
    P2 -- "Vehicle info & alerts" --> Driver

    Admin -- "Define routes & stops" --> P3
    P3 -- "Stores / retrieves" --> D2
    Driver -- "View route info" --> P3
    P3 -- "Route & schedule" --> Driver

    Admin -- "Request / Approve replacement" --> P4
    P4 -- "Stores / retrieves" --> D3
    P4 -- "Reads vehicle info" --> D1

    Admin -- "Manage clusters & groups" --> P5
    P5 -- "Stores / retrieves" --> D4
    P5 -- "Reads driver / vehicle" --> D1
```

---

### 2.0 Duty & Shift Management

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]

    P1(("**2.1**\nCreate / Update\nAssignment"))
    P2(("**2.2**\nManage\nShifts"))
    P3(("**2.3**\nTemporary\nAssignment"))
    P4(("**2.4**\nManage\nDuties"))
    P5(("**2.5**\nCheck Driver &\nVehicle Conflict"))

    D1[("Assignment\nData")]
    D2[("Shift\nData")]
    D3[("Duty\nData")]
    D4[("Vehicle &\nDriver Data")]

    Admin -- "Assignment details" --> P1
    P1 -- "Stores / retrieves" --> D1
    P1 -- "Validate" --> P5
    P5 -- "Reads existing" --> D1
    P5 -- "Reads vehicles / drivers" --> D4

    Admin -- "Create / update shift" --> P2
    P2 -- "Stores / retrieves" --> D2

    Admin -- "Create temp assignment" --> P3
    P3 -- "Stores / retrieves" --> D1
    P3 -- "Reads shift info" --> D2

    Admin -- "Create / approve duty" --> P4
    P4 -- "Stores / retrieves" --> D3
    Driver -- "View duties & shifts" --> P4
    P4 -- "Duty & schedule info" --> Driver
    Driver -- "View today's assignment" --> P1
    P1 -- "Assignment details" --> Driver
```

---

### 3.0 Attendance & Leave Management

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]

    P1(("**3.1**\nMark\nAttendance"))
    P2(("**3.2**\nDriver Apply\nLeave"))
    P3(("**3.3**\nAdmin Apply\nLeave for Driver"))
    P4(("**3.4**\nApprove Leave\nwith Reassignment"))
    P5(("**3.5**\nAuto-Mark\nAbsent"))
    P6(("**3.6**\nView Leave\nHistory & Stats"))

    D1[("Attendance\nData")]
    D2[("Leave\nData")]
    D3[("Assignment\nData")]

    Admin -- "Attendance data" --> P1
    P1 -- "Stores / retrieves" --> D1

    Driver -- "Submit leave request" --> P2
    P2 -- "Stores" --> D2

    Admin -- "Apply leave on behalf" --> P3
    P3 -- "Stores" --> D2

    Admin -- "Approve / reject leave" --> P4
    P4 -- "Updates leave status" --> D2
    P4 -- "Reassign affected assignments" --> D3
    P4 -- "Triggers" --> P5
    P5 -- "Marks absent" --> D1

    Admin -- "View history" --> P6
    P6 -- "Reads" --> D2
    P6 -- "Leave stats & history" --> Admin

    Driver -- "View my leaves" --> P6
    P6 -- "Leave status" --> Driver
```

---

### 4.0 Vehicle Service Management

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Driver[/"**Driver**"\]

    P1(("**4.1**\nDriver Reports\nVehicle Issue"))
    P2(("**4.2**\nCreate Service\nRecord"))
    P3(("**4.3**\nService Workflow\nApprove → Complete"))
    P4(("**4.4**\nManage\nParts"))
    P5(("**4.5**\nPurchase Orders\n& Invoices"))
    P6(("**4.6**\nManage\nVendors"))

    D1[("Service\nRecords")]
    D2[("Parts\nData")]
    D3[("Purchase Order\nData")]
    D4[("Vendor\nData")]

    Driver -- "Report vehicle issue" --> P1
    P1 -- "Stores" --> D1
    Driver -- "View my service requests" --> P1
    P1 -- "Request status" --> Driver

    Admin -- "Create service record" --> P2
    P2 -- "Stores" --> D1
    P2 -- "Reads vehicle info" --> D1

    Admin -- "Approve / start / complete" --> P3
    P3 -- "Updates status" --> D1
    P3 -- "Reads parts linked" --> D2

    Admin -- "Add / update parts" --> P4
    P4 -- "Stores / retrieves" --> D2
    P4 -- "Links to service" --> D1

    Admin -- "Create PO / upload invoice" --> P5
    P5 -- "Stores / retrieves" --> D3
    P5 -- "Links to vendor" --> D4

    Admin -- "CRUD vendor info" --> P6
    P6 -- "Stores / retrieves" --> D4
```

---

### 5.0 Student & Staff Transport

```mermaid
flowchart LR
    Admin[/"**Admin**"\]
    Student[/"**Student**"\]
    Faculty[/"**Faculty**"\]
    Driver[/"**Driver**"\]

    P1(("**5.1**\nStudent Requests\nTransport"))
    P2(("**5.2**\nProcess Transport\nRequest"))
    P3(("**5.3**\nAssign Student\nTransport"))
    P4(("**5.4**\nRequest\nStop Change"))
    P5(("**5.5**\nProcess Stop\nChange"))
    P6(("**5.6**\nRecord\nPayment"))
    P7(("**5.7**\nFaculty Vehicle\nBooking"))

    D1[("Transport\nRequest Data")]
    D2[("Student\nTransport Data")]
    D3[("Stop Change\nData")]
    D4[("Payment\nData")]
    D5[("Vehicle\nRequest Data")]

    Student -- "Submit transport request" --> P1
    P1 -- "Stores" --> D1
    Student -- "View request status" --> P1
    P1 -- "Request status" --> Student

    Admin -- "Approve / reject request" --> P2
    P2 -- "Updates" --> D1
    P2 -- "Creates transport entry" --> D2

    Admin -- "Direct assign / update" --> P3
    P3 -- "Stores / retrieves" --> D2

    Student -- "Request stop change" --> P4
    P4 -- "Stores" --> D3

    Admin -- "Process stop change" --> P5
    P5 -- "Updates" --> D3
    P5 -- "Updates transport" --> D2

    Admin -- "Record payment" --> P6
    P6 -- "Stores" --> D4
    P6 -- "Reads student info" --> D2

    Faculty -- "Book vehicle / cancel" --> P7
    Admin -- "Approve / assign / complete" --> P7
    Driver -- "Verify start / end OTP" --> P7
    P7 -- "Stores / retrieves" --> D5
    P7 -- "Booking status & OTP" --> Faculty
```
