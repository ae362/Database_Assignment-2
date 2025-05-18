# 🏥 Health Clinic Appointment Management System (HCAMS)

## 📋 Project Overview

The **Health Clinic Appointment Management System (HCAMS)** is a full-stack web application designed and implemented as part of the *Advanced Databases and Big Data (U14440)* module. This system supports both administrative and patient-facing functionality to improve the efficiency and usability of clinical appointment scheduling.

HCAMS is tailored to the requirements of the fictional **City Health Clinic**, aiming to solve real-world problems such as appointment clashes, inefficient record keeping, and lack of centralized digital systems.

---
## 📧 Module Leader: Dr. Amina Souag (amina.souag@canterbury.ac.uk)

## 👥 Team Members

- Ayoub Elghayati 
- Osama Sharkia
- Rifaat Hossain
- Indigo Basagoiti
- Alex Fraile Villamil

---

## 🎯 Key Objectives

- Enable patients to book, reschedule, or cancel appointments via a user-friendly interface.
- Provide clinic staff with a robust admin dashboard.
- Ensure data integrity, scalability, and responsiveness using MongoDB and modern web tools.

---

## ⚙️ Technology Stack

| Layer        | Technology            |
|--------------|------------------------|
| Frontend     | Nextjs (react) |
| Backend      | Django, PyMongo (MongoDB driver) |
| Database     | MongoDB Atlas |
| Package Mgmt | npm, pip |
| Deployment   | Local (development-ready) |


---

## 🧠 System Architecture

The system follows a **modular MVC architecture**:

- **Frontend**: A responsive SPA (Single Page Application) built using React.js.
- **Backend**: RESTful API developed with Django, interfacing MongoDB through PyMongo.
- **Database**: MongoDB NoSQL structure using embedded and referenced documents for scalability and performance.

---

## 🧩 Features

### Patients
- Create, read, update, delete (CRUD) patient records
- View and edit personal medical information
- Book and cancel appointments

### Doctors
- View and manage schedule availability
- Assign specialization and roles
- Access patient appointments

### Appointments
- Time-slot booking with conflict resolution checks
- Automatic linking of patient and doctor records
- Real-time updates via frontend interface

---

## 💻 Installation & Usage Guide

> ⚠️ Recommended: Use **Visual Studio Code** and ensure **Python 3.11** is installed.

### 1️⃣ Download project /clone it


### 2️⃣ Set Up the Backend (Terminal 1)
```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```
The backend will run at: http://localhost:8000

### Fix the email-notification function (due to security reasons I couldn't commit the key but i managed to find a workaround)
- Copy the content of the file in backend/key.txt
- Navigate to backend/backend/settings.py ( line 147 )
- Paste the content after the dot (SG.content here)
- Save the changes
  
### 3️⃣ Set Up the Frontend (Terminal 2)
```bash
cd frontend
npm install --legacy-peer-deps
npm install framer-motion --legacy-peer-deps
npm run server
```
The frontend will run at: http://localhost:3000

## Database Access
### MongoDB Compass
mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/

## 🧪 Testing
Testing includes manual validation of:

Frontend responsiveness across devices

Backend REST API endpoints

Appointment conflict handling

CRUD operations for patients and doctors

Query performance and indexing strategies in MongoDB

Automated tests can be added using:

Pytest or unittest for backend logic


## 🚀 Deployment
This project is currently configured for local development only.

For production deployment, consider:

Hosting frontend on Vercel or Netlify

Hosting backend on Heroku or Railway

Using MongoDB Atlas for cloud-based data persistence

Adding environment variables for secure credentials



## 📄 License
This repository is provided for academic purposes only as part of coursework submission to CCCU. Redistribution or reuse without permission is strictly prohibited.

