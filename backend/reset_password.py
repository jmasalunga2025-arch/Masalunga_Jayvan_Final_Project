from getpass import getpass
from security import hash_password

new_password = getpass("Enter your new DAMS password: ")
confirm_password = getpass("Confirm your new password: ")

if new_password != confirm_password:
    print("Passwords do not match!")
else:
    hashed = hash_password(new_password)
    print("\nNew password hash generated successfully:")
    print(hashed)