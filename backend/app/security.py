import bcrypt 
def hash_password(password):
    password=password.encode()
    salt=bcrypt.gensalt()
    hash=bcrypt.hashpw(password, salt)
    return hash.decode()
def verify_password(password,hash):
    return bcrypt.checkpw(password.encode(),hash.encode())    
