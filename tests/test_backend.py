
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"
TEST_USER = "test_verification_user"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def test_login():
    url = f"{BASE_URL}/login"
    payload = {"userId": TEST_USER}
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200 and response.json().get("success"):
            log("Login test passed.", "PASS")
            return True
        else:
            log(f"Login failed: {response.text}", "FAIL")
            return False
    except Exception as e:
        log(f"Login exception: {e}", "FAIL")
        return False

def test_save_and_get():
    # 1. Save Data
    save_url = f"{BASE_URL}/data/{TEST_USER}"
    test_data = {
        "timestamp": int(time.time() * 1000),
        "courses": [{"id": 1, "name": "Test Course"}],
        "students": [],
        "teachers": []
    }
    
    # Wrap in the structure expected by the server (or legacy)
    # The server handles both, but let's use the robust one with force=True
    payload = {
        "data": test_data,
        "lastSyncedTimestamp": 0,
        "force": True
    }

    try:
        log("Attempting to save data...")
        response = requests.post(save_url, json=payload)
        if response.status_code != 200 or not response.json().get("success"):
            log(f"Save failed: {response.text}", "FAIL")
            return False
        log("Save successful.", "PASS")
    except Exception as e:
        log(f"Save exception: {e}", "FAIL")
        return False

    # 2. Get Data
    get_url = f"{BASE_URL}/data/{TEST_USER}"
    try:
        log("Attempting to retrieve data...")
        response = requests.get(get_url)
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                returned_data = result.get("data")
                # Check if course name matches
                if returned_data and returned_data.get("courses")[0].get("name") == "Test Course":
                    log("Data verification passed.", "PASS")
                    return True
                else:
                    log(f"Data verification mismatch: {returned_data}", "FAIL")
                    return False
            else:
                log(f"Get returned success=False: {result}", "FAIL")
                return False
        else:
            log(f"Get failed with status {response.status_code}", "FAIL")
            return False
    except Exception as e:
        log(f"Get exception: {e}", "FAIL")
        return False

if __name__ == "__main__":
    log("Starting Backend Verification...")
    if test_login():
        if test_save_and_get():
            log("All backend tests passed!", "SUCCESS")
            exit(0)
    
    log("Some tests failed.", "ERROR")
    exit(1)
