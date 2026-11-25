from getpass import getpass

from database import SessionLocal
from models import User
from security import hash_password

db = SessionLocal()

try:
    email = input("Enter your existing DAMS account email: ").strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user:
        print("Account not found. Check your email address.")
    else:
        print("\nAccount found!")
        print("Username:", user.username)
        print("Email:", user.email)
        print("Role:", user.role)

        new_password = getpass("\nEnter your new password: ")
        confirm_password = getpass("Confirm your new password: ")

        if not new_password:
            print("Password cannot be empty.")

        elif new_password != confirm_password:
            print("Passwords do not match.")

        else:
            user.password_hash = hash_password(new_password)
            db.commit()

            print("\nSUCCESS! Your existing account password has been updated.")
            print("You can now log in using your existing email.")

except Exception as e:
    db.rollback()
    print("Error:", e)

finally:
    db.close()