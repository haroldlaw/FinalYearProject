# AI Image Analyzer

A full-stack web application that analyses the aesthetic quality of photographs using a custom deep learning model trained on the Aesthetic Attributes Database (AADB). Users can upload an image and receive a detailed, attribute-level quality assessment covering composition, colour, focus, and exposure.

---

## Features

- **User Authentication** — Secure registration, login, and logout using JSON Web Tokens stored in HTTP-only cookies. Includes a forgot-password flow.
- **Image Upload** — Drag-and-drop or file-picker interface supporting JPEG and PNG files up to 10 MB.
- **AI-Powered Aesthetic Evaluation** — A ResNet-50 model fine-tuned on the AADB dataset predicts four aesthetic attribute scores (composition, colour, focus, exposure) and an overall quality score, each on a 0–100 scale.
- **Cloud Image Storage** — Uploaded images are stored and served via Cloudinary.
- **Results Dashboard** — A visual breakdown of all attribute scores displayed on the results page.
- **Upload History** — The profile page lists all previously analysed images for the authenticated user.

---

## Project Structure

```
FYP/
├── frontend/          # React (Vite) single-page application
├── backend/           # Node.js / Express REST API
│   └── python_service/  # Python inference script called by the backend
└── ai-service/        # Model architecture, datasets, and training scripts
    └── outputs/       # Saved model checkpoints and evaluation results
```

---

## Prerequisites

Ensure the following are installed before proceeding:

| Requirement | Recommended Version |
|---|---|
| Node.js | v18 or later |
| npm | v9 or later |
| Python | 3.9 or later |
| pip | Latest |

You will also need accounts and credentials for:

- **MongoDB Atlas** — cloud-hosted database
- **Cloudinary** — image storage and delivery
- **Google Cloud** — Vision API with a service account key (JSON)

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd FYP
```

### 2. Obtain the model weights

The trained model weights are not included in this repository due to their large file size. They are available on request. Once obtained, place `best_model.pth` at:

```
ai-service/outputs/ava_finetuned_3/best_model.pth
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5. Set up the Python environment

```bash
cd ..
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

pip install -r ai-service/requirements.txt
```

---

## Configuration

Create a `.env` file inside the `backend/` directory. A template is provided below — replace all placeholder values with your own credentials.

```env
# Server
PORT=9000

# MongoDB
MONGO_URI=your_mongodb_atlas_connection_string

# Authentication
JWT_SECRET=your_long_random_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Cloud Vision API
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Custom Photography Model
USE_CUSTOM_MODEL=true
PYTHON_PATH=python
MODEL_TIMEOUT=60000
CUSTOM_MODEL_PATH=../../ai-service/outputs/ava_finetuned_3/best_model.pth
MODEL_BACKBONE=resnet50
```

Place your Google Cloud service account key file at `backend/credentials.json`.

> **Note:** The `.env` file and `credentials.json` are excluded from version control. Never commit these files.

---

## Running the Application

Open two terminal windows from the project root.

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

The API server will start on `http://localhost:9000`.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Building for Production

### Frontend

```bash
cd frontend
npm run build
```

The compiled output will be written to `frontend/dist/`.

### Backend

```bash
cd backend
npm start
```

Ensure all environment variables are set correctly in the production environment before starting.

---

## Model Information

| Property | Value |
|---|---|
| Checkpoint | `ava_finetuned_3` |
| Architecture | ResNet-50 |
| Training dataset | AADB (Aesthetic Attributes Database) |
| Pre-training | AVA (Aesthetic Visual Analysis) |
| PLCC (overall score) | 0.638 |
| SRCC (overall score) | 0.619 |

The model predicts four aesthetic attributes independently and derives an overall score as their mean:

| Attribute | Source features |
|---|---|
| Composition | Rule of Thirds, Symmetry, Balancing Elements, Repetition, Object |
| Colour | Colour Harmony, Vivid Colour |
| Focus | Depth of Field |
| Exposure | Lighting |

---

## Project Demo
(https://youtu.be/F2vMDRK5gVc)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| AI Model | PyTorch, ResNet-50 (via `torchvision`) |
| Image Storage | Cloudinary |
| Vision API | Google Cloud Vision |
| Authentication | JSON Web Tokens (HTTP-only cookies) |
