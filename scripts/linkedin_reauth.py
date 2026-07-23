#!/usr/bin/env python3
"""Re-authenticate LinkedIn with read+write scopes.

Run: python scripts/linkedin_reauth.py
Paste the auth code when prompted.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qs

import requests

CLIENT_ID = "***REMOVED***"
CLIENT_SECRET = "***REMOVED***="
REDIRECT_URI = "http://localhost:8888/callback"
CREDENTIALS_FILE = Path("linkedin_credentials.json")
SCOPES = "openid profile w_member_social r_member_social"


def main():
    auth_params = urlencode({
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": "mm_reauth",
    })
    auth_url = f"https://www.linkedin.com/oauth/v2/authorization?{auth_params}"

    print(f"\n{'='*60}")
    print("STEP 1: Open this URL in your browser:")
    print(f"{'='*60}")
    print(f"\n{auth_url}\n")
    print(f"{'='*60}")
    print("\nSTEP 2: After you authorize, LinkedIn will redirect to a URL like:")
    print("  http://localhost:8888/callback?code=XXXXX&state=mm_reauth")
    print("\nThe page will fail to load (that's OK).")
    print("Copy the ENTIRE URL from your browser's address bar and paste it below.\n")

    redirect_url = input("Paste the redirect URL here: ").strip()

    if not redirect_url:
        print("No URL provided. Exiting.")
        sys.exit(1)

    # Extract code from URL
    parsed = urlparse(redirect_url)
    params = parse_qs(parsed.query)

    if "code" not in params:
        # Maybe they pasted just the code
        auth_code = redirect_url
    else:
        auth_code = params["code"][0]

    print(f"\nExchanging code for token...")

    resp = requests.post("https://www.linkedin.com/oauth/v2/accessToken", data={
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    })

    if resp.status_code != 200:
        print(f"ERROR: Token exchange failed ({resp.status_code}): {resp.text}")
        sys.exit(1)

    token_data = resp.json()
    print(f"Token obtained! Scope: {token_data.get('scope')}")
    print(f"Expires in: {token_data.get('expires_in', 0) / 86400:.0f} days")

    # Get person info
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me = requests.get("https://api.linkedin.com/v2/userinfo", headers=headers)
    person_sub = me.json().get("sub", "") if me.status_code == 200 else ""

    # Update credentials
    creds = json.loads(CREDENTIALS_FILE.read_text()) if CREDENTIALS_FILE.exists() else {}
    creds["personal"] = {
        "access_token": token_data["access_token"],
        "expires_in": token_data.get("expires_in"),
        "scope": token_data.get("scope", SCOPES),
        "token_type": "Bearer",
        "id_token": token_data.get("id_token", ""),
        "expires_at": datetime.now(timezone.utc).timestamp() + token_data.get("expires_in", 0),
        "obtained_at": datetime.now(timezone.utc).isoformat(),
        "person_urn": f"urn:li:person:{person_sub}" if person_sub else creds.get("personal", {}).get("person_urn", ""),
    }
    creds["client_id"] = CLIENT_ID
    CREDENTIALS_FILE.write_text(json.dumps(creds, indent=2))
    print(f"\nCredentials saved to {CREDENTIALS_FILE}")
    print("LinkedIn read+write access is now configured!")


if __name__ == "__main__":
    main()
