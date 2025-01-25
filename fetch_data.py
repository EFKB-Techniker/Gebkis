import os
from dotenv import load_dotenv
import requests
from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import BackendApplicationClient
import logging

def setup_logger():
    log_dir = '/usr/share/nginx/html/logs'
    os.makedirs(log_dir, exist_ok=True)
    
    logger = logging.getLogger('fetch_data')
    logger.setLevel(logging.DEBUG)
    
    # Handler für Datei
    file_handler = logging.FileHandler(f'{log_dir}/fetch_data.log')
    file_handler.setLevel(logging.DEBUG)
    
    # Handler für Konsole
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Logger global initialisieren
logger = setup_logger()

# Lade die .env-Datei
load_dotenv()

# Setze die Umgebungsvariablen aus der .env-Datei
client_id = os.getenv('CLIENT_ID')
client_secret = os.getenv('CLIENT_SECRET')
tenant_id = os.getenv('TENANT_ID')
site_id = os.getenv('SITE_ID')
drive_id = os.getenv('DRIVE_ID')
item_id = os.getenv('ITEM_ID')

# Die URL für den Microsoft OAuth 2.0 Token-Endpunkt
token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'

# Scope für die Microsoft Graph API, um auf SharePoint zuzugreifen
scope = ['https://graph.microsoft.com/.default']

# Erstelle einen OAuth2 Session-Client
client = BackendApplicationClient(client_id=client_id)
oauth = OAuth2Session(client=client)

# Hole das Zugangstoken
def get_access_token():
    logger.debug("Versuche Token zu holen...")
    logger.debug(f"Token URL: {token_url}")
    logger.debug(f"Scope: {scope}")
    try:
        token = oauth.fetch_token(token_url, client_id=client_id, client_secret=client_secret, scope=scope)
        logger.info("Token erfolgreich geholt")
        return token['access_token']
    except Exception as e:
        logger.error(f"Fehler beim Token-Abruf: {str(e)}")
        raise

# Abrufen der XLS-Datei von SharePoint
def download_xls(access_token):
    logger.debug("Starte XLS Download...")
    sharepoint_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{item_id}/content'
    # headers = {'Authorization': 'Bearer <TOKEN_HIDDEN>'}  # Sicheres Logging
    headers = {"Authorization": f"Bearer {access_token}"}  # NACHHER LÖSCHEN !!!! Sicheres Logging
    
    logger.debug(f"SharePoint URL: {sharepoint_url}")
    logger.debug(f"Request Headers: {headers}")
    
    try:
        response = requests.get(sharepoint_url, headers=headers)
        logger.debug(f"SharePoint API Status: {response.status_code}")

        if response.status_code == 200:
            save_path = '/usr/share/nginx/html/data/Geburtstagsliste.xls'
            with open(save_path, 'wb') as file:
                file.write(response.content)
            logger.info(f"XLS-Datei erfolgreich gespeichert: {save_path}")
        else:
            logger.error(f"Download fehlgeschlagen. Status: {response.status_code}")
    except Exception as e:
        logger.error(f"Fehler beim XLS-Download: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        logger.info("Starte Datenabruf...")
        token = get_access_token()
        download_xls(token)
        logger.info("Datenabruf erfolgreich beendet")
    except Exception as e:
        logger.error(f"Programmfehler: {str(e)}")
