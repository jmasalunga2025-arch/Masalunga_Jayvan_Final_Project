# DAMS: Document Automation Management System

An Object-Oriented Programming (OOP) project developed using Python. The system helps users create, edit, and manage documents using ready-made templates.

## Technologies Used

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Frontend:** React, Vite, Tailwind CSS
- **Document Generation:** Python-based Word and PDF generation

## Features

- **User Accounts:** Users can register and log in using their accounts. Passwords are securely hashed.
- **User Roles:** The system has three roles: Administrator, Staff, and Approver. Each role has different access and permissions.
- **Document Templates:** Includes 13 built-in templates for school and administrative documents.
- **Document Generator:** Users can fill out a template and generate a document without creating one from scratch.
- **Live Preview:** Users can see how their document looks while entering information.
- **AI Assistant:** Provides options to improve, rewrite, shorten, and correct text. Users can review the suggested changes before applying them.
- **Approval System:** Documents can be submitted for approval, with options to approve or reject them and leave comments.
- **Document Management:** Users can save, edit, delete, and download their documents in Word and PDF formats.
- **Version History:** Keeps track of previous document versions.
- **Notifications and Activity Logs:** Shows document updates and other important activities.
- **Other Features:** Includes favorites, recently used templates, light and dark mode, and a collapsible sidebar.

The system also includes an owl character named Dami, which appears in different situations, such as loading, welcoming users, showing errors, and confirming actions.

## How to Run the Project

### Backend Setup

Open a terminal and run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example .env
uvicorn main:app --reload
```

### Frontend Setup

Open another terminal and run:

```powershell
cd frontend
npm install
npm run dev
```

Open the application in your browser:

http://localhost:5173

**Note:** The first account registered will automatically become the administrator.

## AI Configuration (Optional)

To use the AI Assistant, add the following settings to `backend/.env`:

- `AI_PROVIDER` – Choose `anthropic` or `openai`.
- `AI_API_KEY` – Your API key.
- `AI_MODEL` – Required when using OpenAI.

The other system features can still be used without an AI configuration.

## Testing the System

You can check the main features by following these steps:

1. Create an account and log in.
2. Go to Templates and select a document template.
3. Enter the required information and check the live preview.
4. Save the document and try downloading it in Word and PDF formats.
5. Create another account and assign it the Approver role.
6. Submit a document for approval.
7. Log in using the Approver account and try approving or rejecting the document.
8. Check if the document owner receives a notification.

## Testing and Verification

Some parts of the system were checked during development, including the Python files, document templates, and frontend build.

However, the backend API, automated tests, and complete frontend functionality still need to be tested in a running environment.

It is recommended to install the required dependencies, run the application, and test the main features to make sure everything works properly.